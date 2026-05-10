import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
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

const servers: Server[] = [];

after(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
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
