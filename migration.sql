CREATE TABLE "OcrResult" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rawText" TEXT NOT NULL DEFAULT '',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "ocrResultId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'ocr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ValidationResult" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ocrResultId" TEXT,
    "rule" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewQueue" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ocrResultId" TEXT,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "reason" TEXT NOT NULL,
    "assignedTo" TEXT,
    "dueAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewQueue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewAction" (
    "id" TEXT NOT NULL,
    "reviewQueueId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "comment" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OcrResult_documentId_key" ON "OcrResult"("documentId");
CREATE INDEX "OcrResult_clientId_createdAt_idx" ON "OcrResult"("clientId", "createdAt");
CREATE INDEX "OcrResult_status_updatedAt_idx" ON "OcrResult"("status", "updatedAt");

CREATE UNIQUE INDEX "ExtractedField_ocrResultId_name_key" ON "ExtractedField"("ocrResultId", "name");
CREATE INDEX "ExtractedField_name_value_idx" ON "ExtractedField"("name", "value");

CREATE INDEX "ValidationResult_clientId_rule_createdAt_idx" ON "ValidationResult"("clientId", "rule", "createdAt");
CREATE INDEX "ValidationResult_documentId_status_idx" ON "ValidationResult"("documentId", "status");
CREATE INDEX "ValidationResult_status_severity_idx" ON "ValidationResult"("status", "severity");

CREATE UNIQUE INDEX "ReviewQueue_documentId_key" ON "ReviewQueue"("documentId");
CREATE UNIQUE INDEX "ReviewQueue_ocrResultId_key" ON "ReviewQueue"("ocrResultId");
CREATE INDEX "ReviewQueue_status_priority_dueAt_idx" ON "ReviewQueue"("status", "priority", "dueAt");
CREATE INDEX "ReviewQueue_assignedTo_status_idx" ON "ReviewQueue"("assignedTo", "status");
CREATE INDEX "ReviewQueue_clientId_createdAt_idx" ON "ReviewQueue"("clientId", "createdAt");

CREATE INDEX "ReviewAction_reviewQueueId_createdAt_idx" ON "ReviewAction"("reviewQueueId", "createdAt");
CREATE INDEX "ReviewAction_actorId_createdAt_idx" ON "ReviewAction"("actorId", "createdAt");
CREATE INDEX "ReviewAction_action_createdAt_idx" ON "ReviewAction"("action", "createdAt");

ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_ocrResultId_fkey" FOREIGN KEY ("ocrResultId") REFERENCES "OcrResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidationResult" ADD CONSTRAINT "ValidationResult_ocrResultId_fkey" FOREIGN KEY ("ocrResultId") REFERENCES "OcrResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_ocrResultId_fkey" FOREIGN KEY ("ocrResultId") REFERENCES "OcrResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewAction" ADD CONSTRAINT "ReviewAction_reviewQueueId_fkey" FOREIGN KEY ("reviewQueueId") REFERENCES "ReviewQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
