import { createHash } from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = loginSchema.extend({
  name: z.string().min(1)
});

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export function authRoutes(): Router {
  const router = Router();

  router.post("/api/auth/login", (req, res, next) => {
    try {
      const body = loginSchema.parse(req.body);
      const user = buildUser(body.email);

      res.json({
        token: signToken(user),
        user
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(["/api/auth/register", "/api/auth/signup"], (req, res, next) => {
    try {
      const body = registerSchema.parse(req.body);
      const user = buildUser(body.email, body.name);

      res.status(201).json({
        token: signToken(user),
        user
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function buildUser(email: string, name?: string): AuthUser {
  return {
    id: `user-${createHash("sha1").update(email).digest("hex").slice(0, 10)}`,
    name: name ?? email.split("@")[0] ?? "Demo User",
    email
  };
}

function signToken(user: AuthUser): string {
  const roles = user.email.toLowerCase().includes("admin") ? ["admin", "user"] : ["user"];
  return jwt.sign({ sub: user.id, roles }, env.JWT_SECRET, { expiresIn: "8h" });
}
