import { prisma } from "../services/database.service";

export async function resetTestDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
  for (const table of [
    "DeadLetterEvent",
    "EmailVerificationToken",
    "PasswordResetToken",
    "RefreshToken",
    "User",
    "AuditLog",
    "CRMDocumentAssociation",
    "CRMRecord",
    "DataRoom",
    "OnboardingCompletedStep",
    "OnboardingProgress",
    "ChatMessage",
    "Activity",
    "Document",
    "Client"
  ]) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}"`);
  }
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Client" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "contactPerson" TEXT NOT NULL,
      "contactEmail" TEXT NOT NULL,
      "jurisdiction" TEXT NOT NULL,
      "serviceTier" TEXT NOT NULL,
      "clientType" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "progressPercent" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Document" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "clientId" TEXT NOT NULL,
      "stepKey" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "fileSize" INTEGER NOT NULL DEFAULT 0,
      "mimeType" TEXT NOT NULL,
      "storageProvider" TEXT NOT NULL DEFAULT 'local',
      "storagePath" TEXT NOT NULL DEFAULT '',
      "documentUrl" TEXT NOT NULL DEFAULT '',
      "bucket" TEXT,
      "storageKey" TEXT,
      "checksum" TEXT NOT NULL DEFAULT '',
      "storageMetadata" TEXT NOT NULL DEFAULT '{}',
      "status" TEXT NOT NULL,
      "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "rejectionReason" TEXT,
      CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "roles" TEXT NOT NULL DEFAULT 'user',
      "emailVerifiedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "RefreshToken" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "familyId" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "revokedAt" DATETIME,
      "replacedBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userAgent" TEXT,
      "ipAddress" TEXT,
      CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "PasswordResetToken" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "usedAt" DATETIME,
      "revokedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "EmailVerificationToken" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "usedAt" DATETIME,
      "revokedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Activity" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "clientId" TEXT,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "type" TEXT NOT NULL,
      CONSTRAINT "Activity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "ChatMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "clientId" TEXT NOT NULL,
      "stepKey" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ChatMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "OnboardingProgress" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "clientId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "progressPercent" INTEGER NOT NULL DEFAULT 0,
      "currentStep" TEXT NOT NULL DEFAULT 'identity',
      "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "OnboardingProgress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "OnboardingCompletedStep" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "progressId" TEXT NOT NULL,
      "stepKey" TEXT NOT NULL,
      "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OnboardingCompletedStep_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "OnboardingProgress" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "CRMRecord" (
      "crmId" TEXT NOT NULL PRIMARY KEY,
      "clientId" TEXT NOT NULL,
      "companyName" TEXT NOT NULL,
      "plan" TEXT NOT NULL,
      "createdBy" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CRMRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "CRMDocumentAssociation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "crmId" TEXT NOT NULL,
      "documentId" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "uploadedBy" TEXT NOT NULL,
      "associatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "CRMDocumentAssociation_crmId_fkey" FOREIGN KEY ("crmId") REFERENCES "CRMRecord" ("crmId") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "DataRoom" (
      "roomId" TEXT NOT NULL PRIMARY KEY,
      "clientId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DataRoom_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "AuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "action" TEXT NOT NULL,
      "actorId" TEXT,
      "actorType" TEXT NOT NULL DEFAULT 'user',
      "clientId" TEXT,
      "documentId" TEXT,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "metadata" TEXT NOT NULL DEFAULT '{}',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "DeadLetterEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "eventName" TEXT NOT NULL,
      "consumerName" TEXT NOT NULL,
      "eventData" TEXT NOT NULL DEFAULT '{}',
      "failedReason" TEXT,
      "attemptsMade" INTEGER NOT NULL DEFAULT 0,
      "failedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "replayedAt" DATETIME
    )
  `);

  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX "User_email_key" ON "User"("email")');
  await prisma.$executeRawUnsafe('CREATE INDEX "User_email_idx" ON "User"("email")');
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX "OnboardingProgress_clientId_key" ON "OnboardingProgress"("clientId")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX "OnboardingCompletedStep_progressId_stepKey_key" ON "OnboardingCompletedStep"("progressId", "stepKey")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX "CRMRecord_clientId_key" ON "CRMRecord"("clientId")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX "CRMDocumentAssociation_crmId_documentId_key" ON "CRMDocumentAssociation"("crmId", "documentId")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX "DataRoom_clientId_key" ON "DataRoom"("clientId")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "ChatMessage_clientId_stepKey_createdAt_idx" ON "ChatMessage"("clientId", "stepKey", "createdAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "Client_status_updatedAt_idx" ON "Client"("status", "updatedAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "Client_updatedAt_idx" ON "Client"("updatedAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "Document_clientId_stepKey_uploadedAt_idx" ON "Document"("clientId", "stepKey", "uploadedAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "Activity_clientId_createdAt_idx" ON "Activity"("clientId", "createdAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "AuditLog_clientId_createdAt_idx" ON "AuditLog"("clientId", "createdAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "AuditLog_documentId_createdAt_idx" ON "AuditLog"("documentId", "createdAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX "DeadLetterEvent_eventName_consumerName_idx" ON "DeadLetterEvent"("eventName", "consumerName")'
  );
}
