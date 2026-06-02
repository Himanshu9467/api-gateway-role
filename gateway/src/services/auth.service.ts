import { createHash, randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "../middleware/auth";
import { prisma } from "./database.service";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

export interface AuthUserView {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  emailVerifiedAt?: Date | null;
}

export function validatePasswordStrength(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 10) issues.push("Password must be at least 10 characters long");
  if (!/[A-Z]/.test(password)) issues.push("Password must include an uppercase letter");
  if (!/[a-z]/.test(password)) issues.push("Password must include a lowercase letter");
  if (!/\d/.test(password)) issues.push("Password must include a number");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("Password must include a symbol");
  return issues;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<AuthUserView> {
  const issues = validatePasswordStrength(input.password);
  if (issues.length > 0) {
    const error = new Error(issues.join("; "));
    (error as any).statusCode = 400;
    (error as any).code = "weak_password";
    throw error;
  }

  const roles = input.email.toLowerCase().includes("admin") ? ["admin", "user"] : ["user"];
  const user = await prisma.user.create({
    data: {
      id: buildUserId(input.email),
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: await hashPassword(input.password),
      roles: roles.join(","),
      emailVerifiedAt: env.NODE_ENV === "test" ? new Date() : undefined
    }
  });
  return toUserView(user);
}

export async function verifyPasswordLogin(email: string, password: string): Promise<AuthUserView | undefined> {
  await ensureDevelopmentUser(email);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return undefined;
  const matches = await bcrypt.compare(password, user.passwordHash);
  return matches ? toUserView(user) : undefined;
}

export async function syncFederatedUser(input: {
  provider: string;
  providerSubject: string;
  email: string;
  name: string;
  roles: Role[];
}): Promise<AuthUserView> {
  const normalizedEmail = input.email.toLowerCase();
  const userId = `user-${input.provider}-${createHash("sha1")
    .update(`${input.provider}:${input.providerSubject}`)
    .digest("hex")
    .slice(0, 10)}`;
  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    create: {
      id: userId,
      email: normalizedEmail,
      name: input.name,
      passwordHash: await hashPassword(randomToken()),
      roles: input.roles.join(","),
      emailVerifiedAt: new Date()
    },
    update: {
      name: input.name,
      roles: input.roles.join(","),
      emailVerifiedAt: new Date()
    }
  });
  return toUserView(user);
}

export function signAccessToken(user: AuthUserView): string {
  return jwt.sign({ sub: user.id, roles: user.roles }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_TTL
  });
}

export async function issueRefreshToken(input: {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  familyId?: string;
}) {
  const token = randomBytes(48).toString("base64url");
  const record = await prisma.refreshToken.create({
    data: {
      id: `rt-${randomUUID()}`,
      userId: input.userId,
      tokenHash: hashToken(token),
      familyId: input.familyId ?? `rtf-${randomUUID()}`,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgent: input.userAgent,
      ipAddress: input.ipAddress
    }
  });
  return { token, record };
}

export async function rotateRefreshToken(input: {
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<{ user: AuthUserView; accessToken: string; refreshToken: string } | undefined> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(input.refreshToken) },
    include: { user: true }
  });

  if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) return undefined;

  const next = await issueRefreshToken({
    userId: existing.userId,
    familyId: existing.familyId,
    userAgent: input.userAgent,
    ipAddress: input.ipAddress
  });

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedBy: next.record.id }
  });

  const user = toUserView(existing.user);
  return { user, accessToken: signAccessToken(user), refreshToken: next.token };
}

export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) }
  });
  if (!existing || existing.revokedAt) return false;
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() }
  });
  return true;
}

export async function createPasswordResetToken(input: {
  email: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ token: string; user: AuthUserView } | undefined> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) return undefined;

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  const token = randomToken();
  await prisma.passwordResetToken.create({
    data: {
      id: `prt-${randomUUID()}`,
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    }
  });

  return { token, user: toUserView(user) };
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<AuthUserView | undefined> {
  const issues = validatePasswordStrength(input.password);
  if (issues.length > 0) {
    const error = new Error(issues.join("; "));
    (error as any).statusCode = 400;
    (error as any).code = "weak_password";
    throw error;
  }

  const existing = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: { user: true }
  });
  if (!existing || existing.usedAt || existing.revokedAt || existing.expiresAt <= new Date()) {
    return undefined;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: existing.userId },
      data: { passwordHash: await hashPassword(input.password) }
    }),
    prisma.passwordResetToken.update({
      where: { id: existing.id },
      data: { usedAt: now, revokedAt: now }
    }),
    prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: now }
    })
  ]);

  return toUserView(existing.user);
}

export async function createEmailVerificationToken(input: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ token: string; user: AuthUserView } | undefined> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return undefined;
  if (user.emailVerifiedAt) return { token: "", user: toUserView(user) };

  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() }
  });

  const token = randomToken();
  await prisma.emailVerificationToken.create({
    data: {
      id: `evt-${randomUUID()}`,
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    }
  });
  return { token, user: toUserView(user) };
}

export async function createEmailVerificationTokenByEmail(input: {
  email: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ token: string; user: AuthUserView } | undefined> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) return undefined;
  return createEmailVerificationToken({
    userId: user.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent
  });
}

export async function verifyEmailWithToken(token: string): Promise<AuthUserView | undefined> {
  const existing = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });
  if (!existing || existing.usedAt || existing.revokedAt || existing.expiresAt <= new Date()) {
    return undefined;
  }

  const now = new Date();
  const user = await prisma.user.update({
    where: { id: existing.userId },
    data: { emailVerifiedAt: now }
  });
  await prisma.emailVerificationToken.update({
    where: { id: existing.id },
    data: { usedAt: now, revokedAt: now }
  });
  return toUserView(user);
}

async function ensureDevelopmentUser(email: string): Promise<void> {
  if (env.NODE_ENV === "production") return;
  const normalized = email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email: normalized } });
  if (exists) return;
  const defaultPassword = process.env.DEMO_USER_PASSWORD ?? "password";
  await prisma.user.create({
    data: {
      id: buildUserId(normalized),
      email: normalized,
      name: normalized.split("@")[0] ?? "Demo User",
      passwordHash: await hashPassword(defaultPassword),
      roles: normalized.includes("admin") ? "admin,user" : "user",
      emailVerifiedAt: new Date()
    }
  });
}

function buildUserId(email: string): string {
  return `user-${createHash("sha1").update(email.toLowerCase()).digest("hex").slice(0, 10)}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function randomToken(): string {
  return randomBytes(48).toString("base64url");
}

function toUserView(user: { id: string; name: string; email: string; roles: string; emailVerifiedAt?: Date | null }): AuthUserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.split(",").filter(Boolean) as Role[],
    emailVerifiedAt: user.emailVerifiedAt
  };
}
