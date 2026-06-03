import { createPublicKey } from "node:crypto";
import jwt, { type JwtHeader, type JwtPayload, type SigningKeyCallback } from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "../middleware/auth";
import { writeAuditLog } from "../services/audit.service";
import type { AuthUserView } from "../services/auth.service";
import { syncFederatedUser, verifyPasswordLogin } from "../services/auth.service";

export interface AuthContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface FederatedLoginInput {
  idToken: string;
  accessToken?: string;
}

export interface AuthProvider {
  name: "local" | "auth0" | "cognito" | "keycloak";
  verifyLocalLogin?(email: string, password: string, context: AuthContext): Promise<AuthUserView | undefined>;
  verifyFederatedLogin?(input: FederatedLoginInput, context: AuthContext): Promise<AuthUserView>;
}

interface ExternalProviderOptions {
  name: AuthProvider["name"];
  issuer?: string;
  audience?: string;
  jwksUri?: string;
}

interface ExternalClaims {
  sub?: string;
  email?: string;
  name?: string;
  iss?: string;
  aud?: string | string[];
  [claim: string]: unknown;
}

type JwksKey = JsonWebKey & { kid?: string };

const allowedRoles = new Set<Role>(["admin", "user", "service"]);
const allowedFederatedAlgorithms = ["RS256"] as const;
const jwksCache = new Map<string, string>();

export class LocalAuthProvider implements AuthProvider {
  name = "local" as const;

  verifyLocalLogin(email: string, password: string): Promise<AuthUserView | undefined> {
    return verifyPasswordLogin(email, password);
  }
}

export class ClaimsBasedProvider implements AuthProvider {
  name: AuthProvider["name"];
  private issuer?: string;
  private audience?: string;
  private jwksUri?: string;

  constructor(options: ExternalProviderOptions) {
    this.name = options.name;
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.jwksUri = options.jwksUri;
  }

  async verifyFederatedLogin(input: FederatedLoginInput, context: AuthContext): Promise<AuthUserView> {
    const claims = await this.verifyIdentityToken(input.idToken);
    if (!claims?.sub || !claims.email) {
      throw providerError("invalid_external_token", "External identity token is missing required subject or email claims");
    }

    const user = await syncFederatedUser({
      provider: this.name,
      providerSubject: claims.sub,
      email: claims.email,
      name: typeof claims.name === "string" ? claims.name : claims.email.split("@")[0],
      roles: mapRoles(claims)
    });

    await writeAuditLog({
      action: "auth.federated_login",
      actorId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { provider: this.name, issuer: claims.iss, mfaReady: true }
    });

    return user;
  }

  private async verifyIdentityToken(idToken: string): Promise<ExternalClaims> {
    if (!this.issuer || !this.audience || !this.jwksUri) {
      throw providerError("federated_provider_not_configured", "External identity provider verification is not configured");
    }

    return new Promise((resolve, reject) => {
      jwt.verify(
        idToken,
        this.getSigningKey,
        {
          algorithms: [...allowedFederatedAlgorithms],
          issuer: this.issuer,
          audience: this.audience
        },
        (error, decoded) => {
          if (error || !decoded || typeof decoded === "string") {
            reject(providerError("invalid_external_token", "External identity token could not be verified"));
            return;
          }
          resolve(decoded as JwtPayload & ExternalClaims);
        }
      );
    });
  }

  private getSigningKey = async (header: JwtHeader, callback: SigningKeyCallback): Promise<void> => {
    try {
      if (
        !header.kid ||
        !header.alg ||
        !allowedFederatedAlgorithms.includes(header.alg as (typeof allowedFederatedAlgorithms)[number])
      ) {
        callback(providerError("invalid_external_token", "External identity token uses an untrusted signing key"));
        return;
      }

      const cacheKey = `${this.jwksUri}:${header.kid}`;
      const cached = jwksCache.get(cacheKey);
      if (cached) {
        callback(null, cached);
        return;
      }

      const key = await fetchJwksKey(this.jwksUri as string, header.kid);
      const publicKey = createPublicKey({ key, format: "jwk" })
        .export({ type: "spki", format: "pem" })
        .toString();
      jwksCache.set(cacheKey, publicKey);
      callback(null, publicKey);
    } catch {
      callback(providerError("invalid_external_token", "External identity signing key could not be loaded"));
    }
  };
}

export class Auth0Provider extends ClaimsBasedProvider {
  constructor() {
    super({
      name: "auth0",
      issuer: env.AUTH0_DOMAIN ? `https://${env.AUTH0_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "")}/` : undefined,
      audience: env.AUTH0_AUDIENCE,
      jwksUri: env.AUTH0_DOMAIN
        ? `https://${env.AUTH0_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "")}/.well-known/jwks.json`
        : undefined
    });
  }
}

export class CognitoProvider extends ClaimsBasedProvider {
  constructor() {
    const issuer =
      env.COGNITO_REGION && env.COGNITO_USER_POOL_ID
        ? `https://cognito-idp.${env.COGNITO_REGION}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`
        : undefined;
    super({
      name: "cognito",
      issuer,
      audience: env.COGNITO_CLIENT_ID,
      jwksUri: issuer ? `${issuer}/.well-known/jwks.json` : undefined
    });
  }
}

export class KeycloakProvider extends ClaimsBasedProvider {
  constructor() {
    super({
      name: "keycloak",
      issuer: env.KEYCLOAK_ISSUER,
      audience: env.KEYCLOAK_AUDIENCE,
      jwksUri: env.KEYCLOAK_ISSUER ? `${env.KEYCLOAK_ISSUER.replace(/\/$/, "")}/protocol/openid-connect/certs` : undefined
    });
  }
}

export function createAuthProvider(): AuthProvider {
  switch (env.AUTH_PROVIDER) {
    case "auth0":
      return new Auth0Provider();
    case "cognito":
      return new CognitoProvider();
    case "keycloak":
      return new KeycloakProvider();
    default:
      return new LocalAuthProvider();
  }
}

function mapRoles(claims: ExternalClaims): Role[] {
  const raw = claims[env.AUTH_ROLE_CLAIM] ?? claims.roles ?? claims["cognito:groups"] ?? [];
  const roles = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
  const mapped = roles.filter((role): role is Role => typeof role === "string" && allowedRoles.has(role as Role));
  return mapped.length > 0 ? mapped : [env.AUTH_DEFAULT_ROLE];
}

function providerError(code: string, message: string): Error {
  const error = new Error(message);
  (error as any).statusCode = 401;
  (error as any).code = code;
  return error;
}

async function fetchJwksKey(jwksUri: string, kid: string): Promise<JwksKey> {
  const response = await fetch(jwksUri);
  if (!response.ok) {
    throw new Error("JWKS request failed");
  }
  const body = (await response.json()) as { keys?: JwksKey[] };
  const key = body.keys?.find((candidate) => candidate.kid === kid);
  if (!key) {
    throw new Error("JWKS key not found");
  }
  return key;
}
