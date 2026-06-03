import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { generateKeyPairSync } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import type {
  EventBus,
  EventEnvelope,
  EventHandler,
  EventName,
  EventPayload,
  PublishOptions,
  Subscription
} from "@ai-platform/events";
import { env } from "../config/env";
import { authenticate, requireRoles } from "../middleware/auth";
import { createRateLimiter, type RedisRateLimitClient } from "../middleware/rateLimit";
import { eventRoutes } from "../routes/event.routes";
import { requestIdMiddleware } from "../utils/requestId";
import { Logger } from "../observability/logger";
import { MetricsRegistry, metricsMiddleware } from "../observability/metrics";
import { docsRoutes } from "../routes/docs.routes";
import { observabilityRoutes } from "../routes/observability.routes";
import { orchestrationRoutes } from "../routes/orchestration.routes";
import { authRoutes } from "../routes/auth.routes";
import { ClaimsBasedProvider } from "../auth/AuthProvider";
import { dashboardRoutes } from "../routes/dashboard.routes";
import { chatRoutes } from "../routes/chat.routes";
import { onboardingFrontendRoutes } from "../routes/onboardingFrontend.routes";
import { createCrmRecord, associateCrmDocument } from "../services/crmState.service";
import { provisionDataRoom } from "../services/dataRoomState.service";
import {
  createClient,
  getOnboardingProgress
} from "../services/frontendMockData.service";
import {
  initializeOnboardingState,
  updateOnboardingProgress
} from "../services/onboardingState.service";
import { disconnectDatabase, prisma } from "../services/database.service";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
  hashPassword
} from "../services/auth.service";
import { resetTestDatabase } from "./databaseTestSetup";

const servers: Server[] = [];

before(async () => {
  await resetTestDatabase();
});

after(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
  await disconnectDatabase();
});

describe("gateway auth and RBAC", () => {
  it("rejects requests without a bearer token or service API key", async () => {
    const baseUrl = await startApp((app) => {
      app.use(requestIdMiddleware);
      app.get("/admin-only", authenticate, requireRoles(["admin"]), (_req, res) => {
        res.json({ ok: true });
      });
    });

    const response = await fetch(`${baseUrl}/admin-only`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "unauthorized");
  });

  it("returns token_expired for expired JWTs", async () => {
    const baseUrl = await startApp((app) => {
      app.use(requestIdMiddleware);
      app.get("/admin-only", authenticate, requireRoles(["admin"]), (_req, res) => {
        res.json({ ok: true });
      });
    });
    const token = jwt.sign({ sub: "admin-1", roles: ["admin"] }, env.JWT_SECRET, {
      expiresIn: "-1s"
    });

    const response = await fetch(`${baseUrl}/admin-only`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "token_expired");
  });

  it("blocks users from admin-only routes and allows admins", async () => {
    const baseUrl = await startApp((app) => {
      app.use(requestIdMiddleware);
      app.get("/admin-only", authenticate, requireRoles(["admin"]), (_req, res) => {
        res.json({ ok: true });
      });
    });

    const userToken = jwt.sign({ sub: "user-1", roles: ["user"] }, env.JWT_SECRET, {
      expiresIn: "15m"
    });
    const adminToken = jwt.sign({ sub: "admin-1", roles: ["admin"] }, env.JWT_SECRET, {
      expiresIn: "15m"
    });

    const forbidden = await fetch(`${baseUrl}/admin-only`, {
      headers: { authorization: `Bearer ${userToken}` }
    });
    const allowed = await fetch(`${baseUrl}/admin-only`, {
      headers: { authorization: `Bearer ${adminToken}` }
    });

    assert.equal(forbidden.status, 403);
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), { ok: true });
  });

  it("protects orchestration commands with JWT auth", async () => {
    const orchestrator = {
      run: async () => ({ workflow: "onboard_client", status: "accepted" })
    };
    const baseUrl = await startApp((app) => {
      app.use(express.json());
      app.use(requestIdMiddleware);
      app.use(orchestrationRoutes(orchestrator as never));
    });

    const missingAuth = await fetch(`${baseUrl}/api/ai/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "Onboard Company X" })
    });
    const token = jwt.sign({ sub: "user-1", roles: ["user"] }, env.JWT_SECRET, {
      expiresIn: "15m"
    });
    const allowed = await fetch(`${baseUrl}/api/ai/commands`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ command: "Onboard Company X" })
    });

    assert.equal(missingAuth.status, 401);
    assert.equal(allowed.status, 202);
  });

  it("verifies bcrypt passwords and rotates refresh tokens", async () => {
    const baseUrl = await startApp((app) => {
      app.use(express.json());
      app.use(requestIdMiddleware);
      app.use(authRoutes());
    });

    const weakRegister = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "weak@example.com", name: "Weak", password: "password" })
    });
    assert.equal(weakRegister.status, 400);
    assert.equal((await weakRegister.json()).error, "weak_password");

    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "refresh@example.com",
        name: "Refresh User",
        password: "Stronger1!"
      })
    });
    assert.equal(register.status, 201);

    const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "refresh@example.com", password: "Wronger1!" })
    });
    assert.equal(invalidLogin.status, 401);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "refresh@example.com", password: "Stronger1!" })
    });
    const loginBody = await login.json();
    assert.equal(login.status, 200);
    assert.ok(loginBody.token);
    assert.ok(loginBody.refreshToken);

    const refresh = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: loginBody.refreshToken })
    });
    const refreshBody = await refresh.json();
    assert.equal(refresh.status, 200);
    assert.ok(refreshBody.token);
    assert.ok(refreshBody.refreshToken);
    assert.notEqual(refreshBody.refreshToken, loginBody.refreshToken);

    const reused = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: loginBody.refreshToken })
    });
    assert.equal(reused.status, 401);

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: refreshBody.refreshToken })
    });
    assert.equal(logout.status, 204);

    const afterLogout = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: refreshBody.refreshToken })
    });
    assert.equal(afterLogout.status, 401);
  });

  it("handles password reset without account enumeration and rejects token replay", async () => {
    const baseUrl = await startApp((app) => {
      app.use(express.json());
      app.use(requestIdMiddleware);
      app.use(authRoutes());
    });

    await prisma.user.create({
      data: {
        id: "user-password-reset",
        email: "reset@example.com",
        name: "Reset User",
        passwordHash: await hashPassword("OldPass1!"),
        roles: "user",
        emailVerifiedAt: new Date()
      }
    });

    const forgotExisting = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "reset@example.com" })
    });
    const forgotMissing = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "missing-reset@example.com" })
    });
    assert.equal(forgotExisting.status, 202);
    assert.equal(forgotMissing.status, 202);

    const stored = await prisma.passwordResetToken.findFirst({
      where: { userId: "user-password-reset" }
    });
    assert.ok(stored);
    assert.equal(stored?.tokenHash.length, 64);

    const issued = await createPasswordResetToken({ email: "reset@example.com" });
    assert.ok(issued?.token);
    const reset = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: issued?.token, password: "NewPass12!" })
    });
    assert.equal(reset.status, 204);

    const replay = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: issued?.token, password: "OtherPass1!" })
    });
    assert.equal(replay.status, 400);

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "reset@example.com", password: "NewPass12!" })
    });
    assert.equal(login.status, 200);
  });

  it("verifies email tokens, handles resend, and rejects token replay", async () => {
    const baseUrl = await startApp((app) => {
      app.use(express.json());
      app.use(requestIdMiddleware);
      app.use(authRoutes());
    });

    await prisma.user.create({
      data: {
        id: "user-email-verification",
        email: "verify@example.com",
        name: "Verify User",
        passwordHash: await hashPassword("VerifyPass1!"),
        roles: "user"
      }
    });

    const resend = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "verify@example.com" })
    });
    const resendMissing = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "missing-verify@example.com" })
    });
    assert.equal(resend.status, 202);
    assert.equal(resendMissing.status, 202);

    const issued = await createEmailVerificationToken({ userId: "user-email-verification" });
    assert.ok(issued?.token);
    const verified = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: issued?.token })
    });
    assert.equal(verified.status, 200);
    assert.equal((await verified.json()).user.emailVerified, true);

    const user = await prisma.user.findUnique({ where: { id: "user-email-verification" } });
    assert.ok(user?.emailVerifiedAt);

    const replay = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: issued?.token })
    });
    assert.equal(replay.status, 400);
  });
});

describe("identity federation JWKS verification", () => {
  it("accepts Auth0, Cognito, and Keycloak ID tokens only after JWKS signature, issuer, audience, and expiration verification", async () => {
    const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicJwk = keyPair.publicKey.export({ format: "jwk" });
    const jwksBaseUrl = await startApp((app) => {
      app.get("/.well-known/jwks.json", (_req, res) => {
        res.json({
          keys: [{ ...publicJwk, kid: "federated-key-1", alg: "RS256", use: "sig" }]
        });
      });
    });
    const providers = [
      new ClaimsBasedProvider({
        name: "auth0",
        issuer: "https://tenant.example.auth0.com/",
        audience: "api://gateway",
        jwksUri: `${jwksBaseUrl}/.well-known/jwks.json`
      }),
      new ClaimsBasedProvider({
        name: "cognito",
        issuer: "https://cognito-idp.us-east-1.amazonaws.com/pool-id",
        audience: "cognito-client-id",
        jwksUri: `${jwksBaseUrl}/.well-known/jwks.json`
      }),
      new ClaimsBasedProvider({
        name: "keycloak",
        issuer: "https://keycloak.example.com/realms/platform",
        audience: "gateway-client",
        jwksUri: `${jwksBaseUrl}/.well-known/jwks.json`
      })
    ];

    for (const provider of providers) {
      const idToken = jwt.sign(
        {
          sub: `${provider.name}-subject`,
          email: `${provider.name}@example.com`,
          name: `${provider.name} User`,
          roles: ["user"]
        },
        keyPair.privateKey,
        {
          algorithm: "RS256",
          expiresIn: "15m",
          issuer: issuerFor(provider),
          audience: audienceFor(provider),
          keyid: "federated-key-1"
        }
      );

      const user = await provider.verifyFederatedLogin({ idToken }, {});

      assert.equal(user.email, `${provider.name}@example.com`);
      assert.deepEqual(user.roles, ["user"]);
    }
  });

  it("rejects unsigned, expired, wrong issuer, wrong audience, and unknown-key federated tokens", async () => {
    const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicJwk = keyPair.publicKey.export({ format: "jwk" });
    const jwksBaseUrl = await startApp((app) => {
      app.get("/.well-known/jwks.json", (_req, res) => {
        res.json({
          keys: [{ ...publicJwk, kid: "federated-key-2", alg: "RS256", use: "sig" }]
        });
      });
    });
    const provider = new ClaimsBasedProvider({
      name: "keycloak",
      issuer: "https://keycloak.example.com/realms/platform",
      audience: "gateway-client",
      jwksUri: `${jwksBaseUrl}/.well-known/jwks.json`
    });

    const validPayload = {
      sub: "keycloak-subject",
      email: "keycloak-negative@example.com",
      roles: ["user"]
    };
    const validOptions = {
      algorithm: "RS256" as const,
      issuer: "https://keycloak.example.com/realms/platform",
      audience: "gateway-client",
      keyid: "federated-key-2"
    };
    const unsigned = [
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ ...validPayload, iss: validOptions.issuer, aud: validOptions.audience })).toString(
        "base64url"
      ),
      ""
    ].join(".");
    const expired = jwt.sign(validPayload, keyPair.privateKey, { ...validOptions, expiresIn: "-1s" });
    const wrongIssuer = jwt.sign(validPayload, keyPair.privateKey, {
      ...validOptions,
      issuer: "https://issuer.example.invalid",
      expiresIn: "15m"
    });
    const wrongAudience = jwt.sign(validPayload, keyPair.privateKey, {
      ...validOptions,
      audience: "other-client",
      expiresIn: "15m"
    });
    const unknownKey = jwt.sign(validPayload, keyPair.privateKey, {
      ...validOptions,
      keyid: "missing-key",
      expiresIn: "15m"
    });

    for (const idToken of [unsigned, expired, wrongIssuer, wrongAudience, unknownKey]) {
      await assert.rejects(() => provider.verifyFederatedLogin({ idToken }, {}), /External identity token/);
    }
  });
});

describe("gateway rate limiting", () => {
  it("uses Redis-compatible counters and returns 429 after the limit", async () => {
    const redis = new MemoryRedisRateLimitClient();
    const baseUrl = await startApp((app) => {
      app.use(requestIdMiddleware);
      app.use(createRateLimiter(60_000, 2, { redis }));
      app.get("/limited", (_req, res) => res.json({ ok: true }));
    });

    const first = await fetch(`${baseUrl}/limited`);
    const second = await fetch(`${baseUrl}/limited`);
    const third = await fetch(`${baseUrl}/limited`);
    const body = await third.json();

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
    assert.equal(body.error, "rate_limit_exceeded");
    assert.equal(third.headers.get("x-ratelimit-limit"), "2");
    assert.equal(third.headers.get("x-ratelimit-remaining"), "0");
  });

  it("does not trust spoofed x-user-id for rate limit identity", async () => {
    const redis = new MemoryRedisRateLimitClient();
    const baseUrl = await startApp((app) => {
      app.use(requestIdMiddleware);
      app.use(createRateLimiter(60_000, 1, { redis }));
      app.get("/limited", (_req, res) => res.json({ ok: true }));
    });

    const first = await fetch(`${baseUrl}/limited`, {
      headers: { "x-user-id": "spoof-a" }
    });
    const second = await fetch(`${baseUrl}/limited`, {
      headers: { "x-user-id": "spoof-b" }
    });

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
  });
});

describe("gateway event routes", () => {
  it("publishes document.uploaded with the authenticated request correlation ID", async () => {
    const eventBus = new CapturingEventBus();
    const baseUrl = await startApp((app) => {
      app.use(express.json());
      app.use(requestIdMiddleware);
      app.use(eventRoutes(eventBus, new Logger("test-gateway")));
    });
    const token = jwt.sign({ sub: "user-1", roles: ["user"] }, env.JWT_SECRET, {
      expiresIn: "15m"
    });

    const response = await fetch(`${baseUrl}/api/events/document-uploaded`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-request-id": "req-test-document"
      },
      body: JSON.stringify({
        clientId: "client-12345",
        fileName: "msa.pdf",
        uploadedBy: "user-1"
      })
    });
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.event, "document.uploaded");
    assert.equal(eventBus.published.length, 1);
    assert.equal(eventBus.published[0]?.eventName, "document.uploaded");
    assert.equal(eventBus.published[0]?.options?.correlationId, "req-test-document");
    assert.deepEqual(eventBus.published[0]?.options?.targets, [
      "crm-service",
      "onboarding-service"
    ]);

  });
});

describe("frontend-facing gateway routes", () => {
  it("issues JWTs from mock auth and serves dashboard data", async () => {
    const baseUrl = await startApp((app) => {
      app.use(express.json());
      app.use(requestIdMiddleware);
      app.use(authRoutes());
      app.use(dashboardRoutes(new CapturingEventBus()));
    });

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password" })
    });
    const loginBody = await loginResponse.json();
    const dashboardResponse = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { authorization: `Bearer ${loginBody.token}` }
    });
    const clientsResponse = await fetch(`${baseUrl}/api/dashboard/clients`, {
      headers: { authorization: `Bearer ${loginBody.token}` }
    });
    const activityResponse = await fetch(`${baseUrl}/api/dashboard/activity`, {
      headers: { authorization: `Bearer ${loginBody.token}` }
    });

    assert.equal(loginResponse.status, 200);
    assert.equal(dashboardResponse.status, 200);
    assert.equal(clientsResponse.status, 200);
    assert.equal(activityResponse.status, 200);
    assert.equal(typeof (await dashboardResponse.json()).totalClients, "number");
    assert.ok(Array.isArray(await clientsResponse.json()));
    assert.ok(Array.isArray(await activityResponse.json()));
  });

  it("supports client creation, onboarding progress, documents, and chat", async () => {
    const baseUrl = await startApp((app) => {
      app.use(express.json());
      app.use(requestIdMiddleware);
      app.use(authRoutes());
      app.use(dashboardRoutes(new CapturingEventBus()));
      app.use(onboardingFrontendRoutes(new CapturingEventBus()));
      app.use(chatRoutes());
    });

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password" })
    });
    const { token } = await loginResponse.json();
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    };
    const clientResponse = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        companyName: "NewCo",
        contactPerson: "Nina Shah",
        email: "nina@example.com",
        jurisdiction: "India",
        serviceTier: "Starter",
        clientType: "Startup"
      })
    });
    const client = await clientResponse.json();
    const progressResponse = await fetch(`${baseUrl}/api/onboarding/${client.id}/progress`, {
      headers
    });
    const documentsResponse = await fetch(
      `${baseUrl}/api/onboarding/${client.id}/documents?step=identity`,
      { headers }
    );
    const chatResponse = await fetch(`${baseUrl}/api/ai/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        clientId: client.id,
        stepKey: "identity",
        message: "What is missing?"
      })
    });

    assert.equal(clientResponse.status, 201);
    assert.equal(progressResponse.status, 200);
    assert.equal(documentsResponse.status, 200);
    assert.equal(chatResponse.status, 200);
    assert.equal((await progressResponse.json()).clientId, client.id);
    assert.ok(Array.isArray(await documentsResponse.json()));
    assert.equal((await chatResponse.json()).message.role, "assistant");
  });

  it("publishes client.created from frontend client creation without changing response shape", async () => {
    const eventBus = new CapturingEventBus();
    const baseUrl = await startApp((app) => {
      app.use(express.json());
      app.use(requestIdMiddleware);
      app.use(authRoutes());
      app.use(dashboardRoutes(eventBus));
    });

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password" })
    });
    const { token } = await loginResponse.json();
    const response = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-request-id": "req-client-created"
      },
      body: JSON.stringify({
        companyName: "PublishCo",
        contactPerson: "Pia Singh",
        email: "pia@example.com",
        jurisdiction: "Singapore",
        serviceTier: "Professional",
        clientType: "Corporate"
      })
    });
    const client = await response.json();

    assert.equal(response.status, 201);
    assert.equal(client.name, "PublishCo");
    assert.equal(eventBus.published.length, 1);
    assert.equal(eventBus.published[0]?.eventName, "client.created");
    const payload = eventBus.published[0]?.payload as EventPayload<"client.created">;
    assert.equal(payload.clientId, client.id);
    assert.equal(payload.companyName, "PublishCo");
    assert.match(payload.createdBy, /^user-/);
    assert.equal(payload.plan, "growth");
    assert.deepEqual(eventBus.published[0]?.options?.targets, [
      "crm-service",
      "data-room-service",
      "onboarding-service"
    ]);
    assert.equal(eventBus.published[0]?.options?.correlationId, "req-client-created");
  });

  it("publishes document.uploaded from frontend upload without changing response shape", async () => {
    const eventBus = new CapturingEventBus();
    const baseUrl = await startApp((app) => {
      app.use(express.json());
      app.use(requestIdMiddleware);
      app.use(authRoutes());
      app.use(dashboardRoutes(eventBus));
      app.use(onboardingFrontendRoutes(eventBus));
    });

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password" })
    });
    const { token } = await loginResponse.json();
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    };
    const clientResponse = await fetch(`${baseUrl}/api/clients`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        companyName: "UploadCo",
        contactPerson: "Uma Rao",
        email: "uma@example.com",
        jurisdiction: "India",
        serviceTier: "Starter",
        clientType: "Startup"
      })
    });
    const client = await clientResponse.json();

    eventBus.published.length = 0;
    const uploadResponse = await fetch(
      `${baseUrl}/api/onboarding/${client.id}/documents/upload`,
      {
        method: "POST",
        headers: {
          ...headers,
          "x-request-id": "req-document-uploaded"
        },
        body: JSON.stringify({
          stepKey: "company_documents",
          fileName: "incorporation.pdf"
        })
      }
    );
    const upload = await uploadResponse.json();

    assert.equal(uploadResponse.status, 201);
    assert.equal(upload.document.fileName, "incorporation.pdf");
    assert.equal(eventBus.published.length, 1);
    assert.equal(eventBus.published[0]?.eventName, "document.uploaded");
    const payload = eventBus.published[0]?.payload as EventPayload<"document.uploaded">;
    assert.equal(payload.clientId, client.id);
    assert.equal(payload.documentId, upload.document.id);
    assert.equal(payload.fileName, "incorporation.pdf");
    assert.match(payload.uploadedBy, /^user-/);
    assert.equal(eventBus.published[0]?.options?.metadata?.stepKey, "company_documents");
    assert.deepEqual(eventBus.published[0]?.options?.targets, [
      "crm-service",
      "onboarding-service"
    ]);

    const downloadResponse = await fetch(
      `${baseUrl}/api/onboarding/${client.id}/documents/${upload.document.id}/download-url?expiresIn=120`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    const download = await downloadResponse.json();
    assert.equal(downloadResponse.status, 200);
    assert.equal(download.expiresIn, 120);
    assert.equal(download.document.id, upload.document.id);
    assert.match(download.url, /^local:\/\//);

    const form = new FormData();
    form.set("stepKey", "identity");
    form.set("file", new Blob([Buffer.from("%PDF-1.4\n")], { type: "application/pdf" }), "identity.pdf");
    const multipartResponse = await fetch(
      `${baseUrl}/api/onboarding/${client.id}/documents/upload`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form
      }
    );
    const multipart = await multipartResponse.json();
    assert.equal(multipartResponse.status, 201);
    assert.equal(multipart.document.fileName, "identity.pdf");
    assert.equal(multipart.document.fileSize, 9);
    assert.equal(multipart.document.mimeType, "application/pdf");
  });
});

describe("worker business side effects", () => {
  it("creates CRM records and associates uploaded documents", async () => {
    await prisma.client.create({
      data: {
        id: "client-worker-crm",
        name: "Worker CRM",
        contactPerson: "Casey CRM",
        contactEmail: "casey.crm@example.com",
        jurisdiction: "India",
        serviceTier: "Professional",
        clientType: "Corporate",
        status: "pending",
        progressPercent: 0,
        updatedAt: new Date()
      }
    });
    const created = testEvent("client.created", {
      clientId: "client-worker-crm",
      companyName: "Worker CRM",
      createdBy: "user@example.com",
      plan: "growth"
    });
    const record = await createCrmRecord(created);
    const uploaded = testEvent("document.uploaded", {
      clientId: "client-worker-crm",
      documentId: "doc-worker-crm",
      fileName: "passport.pdf",
      uploadedBy: "user@example.com"
    });
    const updated = await associateCrmDocument(uploaded);

    assert.equal(record.crmId, "crm-client-worker-crm");
    assert.equal(updated?.documents.length, 1);
    assert.equal(updated?.documents[0]?.documentId, "doc-worker-crm");
  });

  it("provisions data-room metadata for client.created", async () => {
    await prisma.client.create({
      data: {
        id: "client-worker-room",
        name: "Worker Room",
        contactPerson: "Casey Room",
        contactEmail: "casey.room@example.com",
        jurisdiction: "Singapore",
        serviceTier: "Enterprise",
        clientType: "SME",
        status: "pending",
        progressPercent: 0,
        updatedAt: new Date()
      }
    });
    const room = await provisionDataRoom(
      testEvent("client.created", {
        clientId: "client-worker-room",
        companyName: "Worker Room",
        createdBy: "user@example.com",
        plan: "enterprise"
      })
    );

    assert.equal(room.roomId, "room-client-worker-room");
    assert.equal(room.clientId, "client-worker-room");
    assert.match(room.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("updates frontend onboarding progress from onboarding worker state", async () => {
    const client = await createClient({
      companyName: "Worker Onboarding",
      contactPerson: "Ona Shah",
      email: "ona@example.com",
      jurisdiction: "India",
      serviceTier: "Starter",
      clientType: "Startup"
    });

    await initializeOnboardingState(
      testEvent("client.created", {
        clientId: client.id,
        companyName: client.name,
        createdBy: "user@example.com",
        plan: "starter"
      })
    );
    await updateOnboardingProgress(
      testEvent(
        "document.uploaded",
        {
          clientId: client.id,
          documentId: "doc-worker-onboarding",
          fileName: "passport.pdf",
          uploadedBy: "user@example.com"
        },
        { stepKey: "identity", uploadedAt: new Date().toISOString() }
      )
    );

    const progress = await getOnboardingProgress(client.id);
    assert.equal(progress?.progressPercent, 20);
    assert.equal(progress?.overallStatus, "in_progress");
    assert.equal(progress?.steps[0]?.status, "completed");
  });
});

describe("production readiness E2E scenarios", () => {
  it("Scenario 1: startup client identity document advances onboarding", async () => {
    const eventBus = new CapturingEventBus();
    const baseUrl = await frontendApp(eventBus);
    const token = authToken("startup-user", ["user"]);

    const created = await postJson(`${baseUrl}/api/clients`, token, {
      companyName: "E2E Startup",
      contactPerson: "Sia Rao",
      email: "sia.startup@example.com",
      jurisdiction: "India",
      serviceTier: "Starter",
      clientType: "Startup"
    });
    assert.equal(created.response.status, 201);
    assert.equal(eventBus.published[0]?.eventName, "client.created");

    const clientId = created.body.id;
    await initializeOnboardingState(
      testEvent("client.created", {
        clientId,
        companyName: created.body.name,
        createdBy: "startup-user",
        plan: "starter"
      })
    );
    const uploaded = await postJson(`${baseUrl}/api/onboarding/${clientId}/documents/upload`, token, {
      stepKey: "identity",
      fileName: "founder-id.pdf"
    });
    assert.equal(uploaded.response.status, 201);

    await updateOnboardingProgress(
      testEvent(
        "document.uploaded",
        {
          clientId,
          documentId: uploaded.body.document.id,
          fileName: uploaded.body.document.fileName,
          uploadedBy: "startup-user"
        },
        { stepKey: "identity" }
      )
    );

    const progress = await getJson(`${baseUrl}/api/onboarding/${clientId}/progress`, token);
    assert.equal(progress.response.status, 200);
    assert.equal(progress.body.progressPercent, 20);
    assert.equal(progress.body.steps[0].status, "completed");
  });

  it("Scenario 2: corporate client multiple documents create CRM associations", async () => {
    const client = await createClient({
      companyName: "E2E Corporate",
      contactPerson: "Cora Lee",
      email: "cora.corporate@example.com",
      jurisdiction: "Singapore",
      serviceTier: "Professional",
      clientType: "Corporate"
    });
    await createCrmRecord(
      testEvent("client.created", {
        clientId: client.id,
        companyName: client.name,
        createdBy: "corporate-user",
        plan: "growth"
      })
    );

    await associateCrmDocument(
      testEvent("document.uploaded", {
        clientId: client.id,
        documentId: "doc-corp-identity",
        fileName: "director-id.pdf",
        uploadedBy: "corporate-user"
      })
    );
    const record = await associateCrmDocument(
      testEvent("document.uploaded", {
        clientId: client.id,
        documentId: "doc-corp-incorporation",
        fileName: "incorporation.pdf",
        uploadedBy: "corporate-user"
      })
    );

    assert.equal(record?.documents.length, 2);
  });

  it("Scenario 3: enterprise client completes onboarding and updates dashboard metrics", async () => {
    const client = await createClient({
      companyName: "E2E Enterprise",
      contactPerson: "Enzo Park",
      email: "enzo.enterprise@example.com",
      jurisdiction: "United States",
      serviceTier: "Enterprise",
      clientType: "Corporate"
    });
    await initializeOnboardingState(
      testEvent("client.created", {
        clientId: client.id,
        companyName: client.name,
        createdBy: "enterprise-user",
        plan: "enterprise"
      })
    );

    for (const stepKey of ["identity", "company_documents", "financial_documents", "compliance", "review"] as const) {
      await updateOnboardingProgress(
        testEvent(
          "document.uploaded",
          {
            clientId: client.id,
            documentId: `doc-${stepKey}`,
            fileName: `${stepKey}.pdf`,
            uploadedBy: "enterprise-user"
          },
          { stepKey }
        )
      );
    }

    const progress = await getOnboardingProgress(client.id);
    assert.equal(progress?.progressPercent, 100);
    assert.equal(progress?.overallStatus, "completed");

    const baseUrl = await frontendApp(new CapturingEventBus());
    const summary = await getJson(`${baseUrl}/api/dashboard/summary`, authToken("enterprise-user", ["admin"]));
    assert.equal(summary.response.status, 200);
    assert.ok(summary.body.completedOnboarding >= 1);
  });

  it("Scenario 4: invalid auth, invalid document step, missing client, and retry path fail gracefully", async () => {
    const baseUrl = await frontendApp(new CapturingEventBus());
    const missingAuth = await fetch(`${baseUrl}/api/dashboard/summary`);
    assert.equal(missingAuth.status, 401);

    const token = authToken("failure-user", ["user"]);
    const missingClient = await getJson(`${baseUrl}/api/clients/client-missing`, token);
    assert.equal(missingClient.response.status, 404);

    const client = await createClient({
      companyName: "E2E Failure",
      contactPerson: "Fay Kim",
      email: "fay.failure@example.com",
      jurisdiction: "India",
      serviceTier: "Starter",
      clientType: "Startup"
    });
    const invalidDocument = await postJson(`${baseUrl}/api/onboarding/${client.id}/documents/upload`, token, {
      stepKey: "not-a-step",
      fileName: "bad.exe"
    });
    assert.equal(invalidDocument.response.status, 400);
    assert.equal(invalidDocument.body.error, "validation_error");

    const first = await associateCrmDocument(
      testEvent("document.uploaded", {
        clientId: "client-without-crm",
        documentId: "doc-retry-missing-crm",
        fileName: "missing-crm.pdf",
        uploadedBy: "failure-user"
      })
    );
    assert.equal(first, undefined);
  });
});

describe("gateway documentation and metrics", () => {
  it("serves OpenAPI documentation", async () => {
    const baseUrl = await startApp((app) => {
      app.use(docsRoutes());
    });

    const response = await fetch(`${baseUrl}/openapi.json`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.openapi, "3.0.3");
    assert.ok(body.paths["/api/events/client-created"]);
    assert.ok(body.paths["/api/events/document-uploaded"]);
  });

  it("serves Prometheus-style metrics", async () => {
    const metrics = new MetricsRegistry();
    const baseUrl = await startApp((app) => {
      app.use(metricsMiddleware(metrics));
      app.get("/ping", (_req, res) => res.json({ ok: true }));
      app.use(observabilityRoutes(metrics));
    });

    await fetch(`${baseUrl}/ping`);
    const response = await fetch(`${baseUrl}/metrics`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /gateway_uptime_seconds/);
    assert.match(body, /gateway_http_requests_total/);
    assert.match(body, /route="\/ping"/);
  });
});

async function startApp(configure: (app: express.Express) => void): Promise<string> {
  const app = express();
  configure(app);
  const server = app.listen(0);
  servers.push(server);

  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function frontendApp(eventBus: EventBus): Promise<string> {
  return startApp((app) => {
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use(authRoutes());
    app.use(dashboardRoutes(eventBus));
    app.use(onboardingFrontendRoutes(eventBus));
    app.use(chatRoutes());
    const testErrorHandler: express.ErrorRequestHandler = (error, req, res, _next) => {
      if (error?.issues) {
        res.status(400).json({
          error: "validation_error",
          message: "Invalid request payload",
          issues: error.issues,
          requestId: req.requestId
        });
        return;
      }
      res.status(500).json({ error: "internal_server_error", requestId: req.requestId });
    };
    app.use(testErrorHandler);
  });
}

function authToken(sub: string, roles: Array<"admin" | "user" | "service">): string {
  return jwt.sign({ sub, roles }, env.JWT_SECRET, { algorithm: "HS256", expiresIn: "15m" });
}

function issuerFor(provider: ClaimsBasedProvider): string {
  switch (provider.name) {
    case "auth0":
      return "https://tenant.example.auth0.com/";
    case "cognito":
      return "https://cognito-idp.us-east-1.amazonaws.com/pool-id";
    case "keycloak":
      return "https://keycloak.example.com/realms/platform";
    default:
      throw new Error("Unsupported federated provider");
  }
}

function audienceFor(provider: ClaimsBasedProvider): string {
  switch (provider.name) {
    case "auth0":
      return "api://gateway";
    case "cognito":
      return "cognito-client-id";
    case "keycloak":
      return "gateway-client";
    default:
      throw new Error("Unsupported federated provider");
  }
}

async function postJson(url: string, token: string, body: unknown): Promise<{ response: Response; body: any }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

async function getJson(url: string, token: string): Promise<{ response: Response; body: any }> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` }
  });
  return { response, body: await response.json() };
}

class MemoryRedisRateLimitClient implements RedisRateLimitClient {
  private readonly values = new Map<string, { count: number; expiresAt?: number }>();

  async incr(key: string): Promise<number> {
    const entry = this.current(key);
    entry.count += 1;
    this.values.set(key, entry);
    return entry.count;
  }

  async pexpire(key: string, milliseconds: number): Promise<number> {
    const entry = this.current(key);
    entry.expiresAt = Date.now() + milliseconds;
    this.values.set(key, entry);
    return 1;
  }

  async pttl(key: string): Promise<number> {
    const entry = this.current(key);
    if (!entry.expiresAt) {
      return -1;
    }
    return Math.max(0, entry.expiresAt - Date.now());
  }

  private current(key: string): { count: number; expiresAt?: number } {
    const existing = this.values.get(key);
    if (!existing || (existing.expiresAt && existing.expiresAt <= Date.now())) {
      return { count: 0 };
    }
    return existing;
  }
}

class CapturingEventBus implements EventBus {
  readonly published: Array<{
    eventName: EventName;
    payload: EventPayload<EventName>;
    options?: PublishOptions;
  }> = [];

  async publish<N extends EventName>(
    eventName: N,
    payload: EventPayload<N>,
    options?: PublishOptions
  ): Promise<EventEnvelope<N>> {
    this.published.push({
      eventName,
      payload: payload as EventPayload<EventName>,
      options
    });

    return {
      id: "event-test-1",
      name: eventName,
      version: 1,
      occurredAt: new Date().toISOString(),
      producer: "test-gateway",
      correlationId: options?.correlationId ?? "req-test",
      idempotencyKey: options?.idempotencyKey ?? `${eventName}:test`,
      payload
    };
  }

  async subscribe<N extends EventName>(
    _eventName: N,
    _consumerName: string,
    _handler: EventHandler<N>
  ): Promise<Subscription> {
    return {
      close: async () => undefined
    };
  }

  async close(): Promise<void> {
    return undefined;
  }
}

function testEvent<N extends EventName>(
  name: N,
  payload: EventPayload<N>,
  metadata?: Record<string, unknown>
): EventEnvelope<N> {
  return {
    id: `event-${name}`,
    name,
    version: 1,
    occurredAt: new Date().toISOString(),
    producer: "test",
    correlationId: "req-test-worker",
    idempotencyKey: `${name}:test`,
    payload,
    metadata
  };
}
