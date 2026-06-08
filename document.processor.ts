import { randomUUID } from "crypto";
import { prisma } from "./database.service";
import { ocrService } from "./ocr.service";
import { needsHumanReview, validateDocument, type ValidationCheck } from "./validationEngine.service";
import { ensureReviewQueue } from "./reviewQueue.service";
import { writeAuditLog } from "./audit.service";

export interface DocumentProcessingInput {
  documentId: string;
  actorId?: string;
  bytes?: Buffer;
}

export interface DocumentProcessingResult {
  ocrResultId: string;
  ocrStatus: string;
  ocrConfidence: number;
  extractedFields: Record<string, string>;
  validations: ValidationCheck[];
  reviewQueueId?: string;
}

export async function processUploadedDocument(input: DocumentProcessingInput): Promise<DocumentProcessingResult> {
  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
    include: { client: true }
  });
  if (!document) {
    const error = new Error("Document was not found");
    (error as any).statusCode = 404;
    (error as any).code = "document_not_found";
    throw error;
  }

  const extraction = await ocrService.extract({
    fileName: document.fileName,
    mimeType: document.mimeType,
    bytes: input.bytes
  });
  const ocrResultId = `ocr-${randomUUID()}`;

  await prisma.$transaction(async (tx: typeof prisma) => {
    await tx.ocrResult.deleteMany({ where: { documentId: document.id } });
    await tx.ocrResult.create({
      data: {
        id: ocrResultId,
        documentId: document.id,
        clientId: document.clientId,
        engine: extraction.engine,
        status: extraction.status,
        rawText: extraction.rawText,
        confidence: extraction.confidence,
        metadata: JSON.stringify(extraction.metadata),
        extractedFields: {
          create: extraction.fields.map((field) => ({
            id: `field-${randomUUID()}`,
            name: field.name,
            value: field.value,
            confidence: field.confidence,
            source: field.source
          }))
        }
      }
    });
  });

  const extractedFields = Object.fromEntries(extraction.fields.map((field) => [field.name, field.value]));
  const validations = await validateDocument({
    client: document.client,
    document,
    fields: extractedFields,
    ocrResultId
  });

  const requiresReview = needsHumanReview(validations, extraction.confidence);
  const reviewItem = requiresReview
    ? await ensureReviewQueue({
        documentId: document.id,
        clientId: document.clientId,
        ocrResultId,
        priority: validations.some((check) => check.severity === "critical") ? "high" : "normal",
        reason: reviewReason(validations, extraction.confidence)
      })
    : undefined;

  await writeAuditLog({
    action: "document.ocr_processed",
    actorId: input.actorId,
    actorType: input.actorId ? "user" : "service",
    clientId: document.clientId,
    documentId: document.id,
    metadata: {
      ocrResultId,
      ocrStatus: extraction.status,
      ocrConfidence: extraction.confidence,
      validationStatus: requiresReview ? "needs_review" : "passed",
      reviewQueueId: reviewItem?.id
    }
  });

  return {
    ocrResultId,
    ocrStatus: extraction.status,
    ocrConfidence: extraction.confidence,
    extractedFields,
    validations,
    reviewQueueId: reviewItem?.id
  };
}

function reviewReason(validations: ValidationCheck[], confidence: number): string {
  const failed = validations.filter((check) => check.status !== "passed").map((check) => check.rule);
  const parts = [];
  if (confidence < 0.7) parts.push("low_ocr_confidence");
  parts.push(...failed);
  return parts.join(", ") || "manual_review_required";
}
