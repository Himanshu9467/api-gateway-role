import jwt from "jsonwebtoken";
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
}

interface ExternalClaims {
  sub?: string;
  email?: string;
  name?: string;
  iss?: string;
  aud?: string | string[];
  [claim: string]: unknown;
}

const allowedRoles = new Set<Role>(["admin", "user", "service"]);

export class LocalAuthProvider implements AuthProvider {
  name = "local" as const;

  verifyLocalLogin(email: string, password: string): Promise<AuthUserView | undefined> {
    return verifyPasswordLogin(email, password);
  }
}

class ClaimsBasedProvider implements AuthProvider {
  name: AuthProvider["name"];
  private issuer?: string;
  private audience?: string;

  constructor(options: ExternalProviderOptions) {
    this.name = options.name;
    this.issuer = options.issuer;
    this.audience = options.audience;
  }

  async verifyFederatedLogin(input: FederatedLoginInput, context: AuthContext): Promise<AuthUserView> {
    const claims = jwt.decode(input.idToken) as ExternalClaims | null;
    if (!claims?.sub || !claims.email) {
      throw providerError("invalid_external_token", "External identity token is missing required subject or email claims");
    }
    if (this.issuer && claims.iss !== this.issuer) {
      throw providerError("invalid_external_issuer", "External identity token issuer is not trusted");
    }
    if (this.audience && !audienceMatches(claims.aud, this.audience)) {
      throw providerError("invalid_external_audience", "External identity token audience is not trusted");
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
}

export class Auth0Provider extends ClaimsBasedProvider {
  constructor() {
    super({
      name: "auth0",
      issuer: env.AUTH0_DOMAIN ? `https://${env.AUTH0_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "")}/` : undefined,
      audience: env.AUTH0_AUDIENCE
    });
  }
}

export class CognitoProvider extends ClaimsBasedProvider {
  constructor() {
    const issuer =
      env.COGNITO_REGION && env.COGNITO_USER_POOL_ID
        ? `https://cognito-idp.${env.COGNITO_REGION}.amazonaws.com/${env.COGNITO_USER_POOL_ID}`
        : undefined;
    super({ name: "cognito", issuer, audience: env.COGNITO_CLIENT_ID });
  }
}

export class KeycloakProvider extends ClaimsBasedProvider {
  constructor() {
    super({ name: "keycloak", issuer: env.KEYCLOAK_ISSUER, audience: env.KEYCLOAK_AUDIENCE });
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

function audienceMatches(actual: string | string[] | undefined, expected: string): boolean {
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

function providerError(code: string, message: string): Error {
  const error = new Error(message);
  (error as any).statusCode = 401;
  (error as any).code = code;
  return error;
}
