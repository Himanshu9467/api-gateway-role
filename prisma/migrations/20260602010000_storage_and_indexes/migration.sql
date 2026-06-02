ALTER TABLE "Document"
ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN "storagePath" TEXT NOT NULL DEFAULT '',
ADD COLUMN "documentUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN "storageMetadata" TEXT NOT NULL DEFAULT '{}';

CREATE INDEX "Client_status_updatedAt_idx" ON "Client"("status", "updatedAt");
CREATE INDEX "Client_updatedAt_idx" ON "Client"("updatedAt");
CREATE INDEX "Document_clientId_stepKey_uploadedAt_idx" ON "Document"("clientId", "stepKey", "uploadedAt");
CREATE INDEX "Activity_clientId_createdAt_idx" ON "Activity"("clientId", "createdAt");
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");
