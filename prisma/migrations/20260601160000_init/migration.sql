CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactPerson" TEXT NOT NULL,
  "contactEmail" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "serviceTier" TEXT NOT NULL,
  "clientType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL DEFAULT 0,
  "mimeType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rejectionReason" TEXT,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Activity" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" TEXT NOT NULL,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnboardingProgress" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "currentStep" TEXT NOT NULL DEFAULT 'identity',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnboardingCompletedStep" (
  "id" TEXT NOT NULL,
  "progressId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingCompletedStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CRMRecord" (
  "crmId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CRMRecord_pkey" PRIMARY KEY ("crmId")
);

CREATE TABLE "CRMDocumentAssociation" (
  "id" TEXT NOT NULL,
  "crmId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "associatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CRMDocumentAssociation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataRoom" (
  "roomId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataRoom_pkey" PRIMARY KEY ("roomId")
);

CREATE UNIQUE INDEX "OnboardingProgress_clientId_key" ON "OnboardingProgress"("clientId");
CREATE UNIQUE INDEX "OnboardingCompletedStep_progressId_stepKey_key" ON "OnboardingCompletedStep"("progressId", "stepKey");
CREATE UNIQUE INDEX "CRMRecord_clientId_key" ON "CRMRecord"("clientId");
CREATE UNIQUE INDEX "CRMDocumentAssociation_crmId_documentId_key" ON "CRMDocumentAssociation"("crmId", "documentId");
CREATE UNIQUE INDEX "DataRoom_clientId_key" ON "DataRoom"("clientId");
CREATE INDEX "ChatMessage_clientId_stepKey_createdAt_idx" ON "ChatMessage"("clientId", "stepKey", "createdAt");

ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingCompletedStep" ADD CONSTRAINT "OnboardingCompletedStep_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "OnboardingProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CRMRecord" ADD CONSTRAINT "CRMRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CRMDocumentAssociation" ADD CONSTRAINT "CRMDocumentAssociation_crmId_fkey" FOREIGN KEY ("crmId") REFERENCES "CRMRecord"("crmId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataRoom" ADD CONSTRAINT "DataRoom_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
