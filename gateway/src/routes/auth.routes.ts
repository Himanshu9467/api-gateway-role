import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import { createAuthProvider } from "../auth/AuthProvider";
import { createRateLimiter } from "../middleware/rateLimit";
import { appMetrics } from "../observability/appMetrics";
import { searchAuditLogs, writeAuditLog } from "../services/audit.service";
import {
  createEmailVerificationToken,
  createEmailVerificationTokenByEmail,
  createPasswordResetToken,
  issueRefreshToken,
  registerUser,
  resetPasswordWithToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  validatePasswordStrength,
  verifyEmailWithToken,
  verifyPasswordLogin
} from "../services/auth.service";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = loginSchema.extend({
  name: z.string().min(1)
});

const refreshSchema = z.object({ refreshToken: z.string().min(32) });
const forgotPasswordSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(1)
});
const verifyEmailSchema = z.object({ token: z.string().min(32) });
const resendVerificationSchema = z.object({ email: z.string().email() });
const federatedLoginSchema = z.object({
  idToken: z.string().min(20),
  accessToken: z.string().optional()
});
const auditQuerySchema = z.object({
  action: z.string().optional(),
  actorId: z.string().optional(),
  clientId: z.string().optional(),
  documentId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

export function authRoutes(): Router {
  const router = Router();
  const authProvider = createAuthProvider();
  const authSensitiveLimiter = createRateLimiter(15 * 60 * 1000, 5, {
    keyPrefix: "gateway:auth-sensitive"
  });

  router.post("/api/auth/login", async (req, res, next) => {
    try {
      const body = loginSchema.parse(req.body);
      const user = await verifyPasswordLogin(body.email, body.password);
      if (!user) {
        await writeAuditLog({
          action: "auth.login_failed",
          actorId: body.email.toLowerCase(),
          actorType: "user",
          ipAddress: req.ip,
          userAgent: req.header("user-agent"),
          metadata: { reason: "invalid_credentials" }
        });
        res.status(401).json({
          error: "invalid_credentials",
          message: "Invalid email or password",
          requestId: req.requestId
        });
        return;
      }
      const refresh = await issueRefreshToken({
        userId: user.id,
        userAgent: req.header("user-agent"),
        ipAddress: req.ip
      });
      await writeAuditLog({
        action: "auth.login",
        actorId: user.id,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });

      res.json({
        token: signAccessToken(user),
        refreshToken: refresh.token,
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/federated-login", async (req, res, next) => {
    try {
      if (!authProvider.verifyFederatedLogin) {
        res.status(400).json({
          error: "federated_auth_disabled",
          message: "External identity federation is not enabled for this environment",
          requestId: req.requestId
        });
        return;
      }
      const body = federatedLoginSchema.parse(req.body ?? {});
      const user = await authProvider.verifyFederatedLogin(body, {
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      const refresh = await issueRefreshToken({
        userId: user.id,
        userAgent: req.header("user-agent"),
        ipAddress: req.ip
      });
      res.json({
        token: signAccessToken(user),
        refreshToken: refresh.token,
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(["/api/auth/register", "/api/auth/signup"], async (req, res, next) => {
    try {
      const body = registerSchema.parse(req.body);
      const passwordIssues = validatePasswordStrength(body.password);
      if (passwordIssues.length > 0) {
        res.status(400).json({
          error: "weak_password",
          message: "Password does not meet strength requirements",
          issues: passwordIssues,
          requestId: req.requestId
        });
        return;
      }
      const user = await registerUser(body);
      const verification = await createEmailVerificationToken({
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      if (verification?.token) {
        await sendVerificationEmail({
          email: user.email,
          name: user.name,
          token: verification.token
        });
      }
      const refresh = await issueRefreshToken({
        userId: user.id,
        userAgent: req.header("user-agent"),
        ipAddress: req.ip
      });
      await writeAuditLog({
        action: "auth.register",
        actorId: user.id,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      await writeAuditLog({
        action: "auth.email_verification_requested",
        actorId: user.id,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });

      res.status(201).json({
        token: signAccessToken(user),
        refreshToken: refresh.token,
        user: { id: user.id, name: user.name, email: user.email }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/forgot-password", authSensitiveLimiter, async (req, res, next) => {
    try {
      const body = forgotPasswordSchema.parse(req.body ?? {});
      const reset = await createPasswordResetToken({
        email: body.email,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      if (reset) {
        await sendPasswordResetEmail({
          email: reset.user.email,
          name: reset.user.name,
          token: reset.token
        });
        await writeAuditLog({
          action: "auth.password_reset_requested",
          actorId: reset.user.id,
          ipAddress: req.ip,
          userAgent: req.header("user-agent")
        });
      } else {
        await writeAuditLog({
          action: "auth.password_reset_requested",
          actorId: body.email.toLowerCase(),
          actorType: "system",
          ipAddress: req.ip,
          userAgent: req.header("user-agent"),
          metadata: { accountFound: false }
        });
      }
      appMetrics.increment("gateway_auth_password_reset_requests_total");
      res.status(202).json({
        message: "If the account exists, password reset instructions will be sent.",
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/reset-password", authSensitiveLimiter, async (req, res, next) => {
    try {
      const body = resetPasswordSchema.parse(req.body ?? {});
      const user = await resetPasswordWithToken({
        token: body.token,
        password: body.password
      });
      if (!user) {
        await writeAuditLog({
          action: "auth.password_reset_failed",
          actorType: "system",
          ipAddress: req.ip,
          userAgent: req.header("user-agent"),
          metadata: { reason: "invalid_or_expired_token" }
        });
        res.status(400).json({
          error: "invalid_reset_token",
          message: "Password reset token is invalid or expired",
          requestId: req.requestId
        });
        return;
      }

      await writeAuditLog({
        action: "auth.password_reset_completed",
        actorId: user.id,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      appMetrics.increment("gateway_auth_password_resets_total");
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/verify-email", authSensitiveLimiter, async (req, res, next) => {
    try {
      const body = verifyEmailSchema.parse(req.body ?? {});
      const user = await verifyEmailWithToken(body.token);
      if (!user) {
        await writeAuditLog({
          action: "auth.email_verification_failed",
          actorType: "system",
          ipAddress: req.ip,
          userAgent: req.header("user-agent"),
          metadata: { reason: "invalid_or_expired_token" }
        });
        res.status(400).json({
          error: "invalid_verification_token",
          message: "Email verification token is invalid or expired",
          requestId: req.requestId
        });
        return;
      }
      await writeAuditLog({
        action: "auth.email_verified",
        actorId: user.id,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      appMetrics.increment("gateway_auth_email_verifications_total");
      res.json({
        user: { id: user.id, name: user.name, email: user.email, emailVerified: true }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/resend-verification", authSensitiveLimiter, async (req, res, next) => {
    try {
      const body = resendVerificationSchema.parse(req.body ?? {});
      const verification = await createEmailVerificationTokenByEmail({
        email: body.email,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      if (verification?.token) {
        await sendVerificationEmail({
          email: verification.user.email,
          name: verification.user.name,
          token: verification.token
        });
        await writeAuditLog({
          action: "auth.email_verification_resent",
          actorId: verification.user.id,
          ipAddress: req.ip,
          userAgent: req.header("user-agent")
        });
      } else {
        await writeAuditLog({
          action: "auth.email_verification_resent",
          actorId: body.email.toLowerCase(),
          actorType: "system",
          ipAddress: req.ip,
          userAgent: req.header("user-agent"),
          metadata: { accountFound: Boolean(verification) }
        });
      }
      res.status(202).json({
        message: "If the account exists and requires verification, instructions will be sent.",
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/refresh", async (req, res, next) => {
    try {
      const body = refreshSchema.parse(req.body ?? {});
      const rotated = await rotateRefreshToken({
        refreshToken: body.refreshToken,
        userAgent: req.header("user-agent"),
        ipAddress: req.ip
      });
      if (!rotated) {
        await writeAuditLog({
          action: "auth.refresh_failed",
          actorType: "user",
          ipAddress: req.ip,
          userAgent: req.header("user-agent"),
          metadata: { reason: "invalid_refresh_token" }
        });
        res.status(401).json({
          error: "invalid_refresh_token",
          message: "Refresh token is invalid, expired, or revoked",
          requestId: req.requestId
        });
        return;
      }

      await writeAuditLog({
        action: "auth.refresh",
        actorId: rotated.user.id,
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      res.json({
        token: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        user: {
          id: rotated.user.id,
          name: rotated.user.name,
          email: rotated.user.email
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/auth/logout", async (req, res, next) => {
    try {
      const body = refreshSchema.partial().parse(req.body ?? {});
      if (body.refreshToken) {
        await revokeRefreshToken(body.refreshToken);
      }
      await writeAuditLog({
        action: "auth.logout",
        actorId: req.user?.id,
        actorType: req.user?.authType === "api-key" ? "service" : "user",
        ipAddress: req.ip,
        userAgent: req.header("user-agent")
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/audit-logs", authenticate, requireRoles(["admin"]), async (req, res, next) => {
    try {
      res.json(await searchAuditLogs(auditQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
