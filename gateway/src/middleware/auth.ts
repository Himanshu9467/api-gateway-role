import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { appMetrics } from "../observability/appMetrics";

export type Role = "admin" | "user" | "service";

export interface AuthUser {
  id: string;
  roles: Role[];
  authType: "jwt" | "api-key";
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const jwtPayloadSchema = z.object({
  sub: z.string().min(1),
  roles: z.array(z.enum(["admin", "user", "service"])).default(["user"])
});

function configuredApiKeys(): Map<string, string> {
  const pairs = env.SERVICE_API_KEYS.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return new Map(
    pairs.map((pair) => {
      const [serviceName, key] = pair.split(":");
      return [key, serviceName] as const;
    }).filter(([key, serviceName]) => Boolean(key && serviceName))
  );
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header("x-api-key");
  const apiKeys = configuredApiKeys();
  const apiKeyMatch = apiKey ? findApiKeyMatch(apiKey, apiKeys) : undefined;

  if (apiKeyMatch) {
    req.user = {
      id: apiKeyMatch,
      roles: ["service"],
      authType: "api-key"
    };
    req.userId = apiKeyMatch;
    next();
    return;
  }

  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    appMetrics.increment("gateway_auth_failures_total", { reason: "missing_credentials" });
    res.status(401).json({
      error: "unauthorized",
      message: "Missing bearer token or service API key",
      requestId: req.requestId
    });
    return;
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    const payload = jwtPayloadSchema.parse(decoded);
    req.user = {
      id: payload.sub,
      roles: payload.roles,
      authType: "jwt"
    };
    req.userId = payload.sub;
    next();
  } catch (error) {
    const expired = error instanceof TokenExpiredError;
    appMetrics.increment("gateway_auth_failures_total", {
      reason: expired ? "token_expired" : "invalid_token"
    });
    res.status(401).json({
      error: expired ? "token_expired" : "invalid_token",
      message: expired ? "JWT has expired" : "JWT verification failed",
      requestId: req.requestId
    });
  }
}

function findApiKeyMatch(apiKey: string, apiKeys: Map<string, string>): string | undefined {
  for (const [configuredKey, serviceName] of apiKeys) {
    const supplied = Buffer.from(apiKey);
    const expected = Buffer.from(configuredKey);
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
      return serviceName;
    }
  }
  return undefined;
}

export function requireRoles(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const roles = req.user?.roles ?? [];
    const allowed = roles.some((role) => allowedRoles.includes(role));

    if (!allowed) {
      appMetrics.increment("gateway_auth_failures_total", { reason: "forbidden" });
      res.status(403).json({
        error: "forbidden",
        message: "Insufficient role for this route",
        requestId: req.requestId
      });
      return;
    }

    next();
  };
}
