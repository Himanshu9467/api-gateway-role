import { z } from "zod";

const uuidLike = z.string().min(8);

export const clientCreatedSchema = z.object({
  clientId: uuidLike,
  companyName: z.string().min(1),
  createdBy: z.string().min(1),
  plan: z.enum(["starter", "growth", "enterprise"]).default("growth")
});

export const clientOnboardedSchema = z.object({
  clientId: uuidLike,
  onboardedAt: z.string().datetime(),
  onboardingId: uuidLike
});

export const documentUploadedSchema = z.object({
  clientId: uuidLike,
  documentId: uuidLike,
  fileName: z.string().min(1),
  uploadedBy: z.string().min(1)
});

export const workflowCompletedSchema = z.object({
  workflowId: uuidLike,
  clientId: uuidLike,
  completedAt: z.string().datetime(),
  status: z.enum(["completed", "completed_with_warnings"])
});

export const documentOcrCompletedSchema = z.object({
  documentId: uuidLike,
  extractedText: z.string().min(1),
  confidence: z.number().min(0).max(1)
});

export const documentValidationCompletedSchema = z.object({
  documentId: uuidLike,
  valid: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.string()
});

export const reviewAssignedSchema = z.object({
  reviewId: uuidLike,
  reviewerId: uuidLike
});

export const reviewApprovedSchema = z.object({
  reviewId: uuidLike
});

export const reviewRejectedSchema = z.object({
  reviewId: uuidLike,
  reason: z.string().min(1)
});

export const crmSyncStartedSchema = z.object({
  customerId: uuidLike
});

export const crmSyncCompletedSchema = z.object({
  customerId: uuidLike,
  crmReference: z.string().min(1)
});

export const faceVerificationCompletedSchema = z.object({
  verificationId: uuidLike,
  score: z.number().min(0).max(1)
});

export const kycCompletedSchema = z.object({
  kycId: uuidLike,
  status: z.string().min(1)
});

export const eventSchemas = {
  "client.created": clientCreatedSchema,
  "client.onboarded": clientOnboardedSchema,
  "document.uploaded": documentUploadedSchema,
  "workflow.completed": workflowCompletedSchema,
  "document.ocr.completed": documentOcrCompletedSchema,
  "document.validation.completed": documentValidationCompletedSchema,
  "review.assigned": reviewAssignedSchema,
  "review.approved": reviewApprovedSchema,
  "review.rejected": reviewRejectedSchema,
  "crm.sync.started": crmSyncStartedSchema,
  "crm.sync.completed": crmSyncCompletedSchema,
  "face.verification.completed": faceVerificationCompletedSchema,
  "kyc.completed": kycCompletedSchema
} as const;

export const eventNameSchema = z.enum([
  "client.created",
  "client.onboarded",
  "document.uploaded",
  "workflow.completed",
  "document.ocr.completed",
  "document.validation.completed",
  "review.assigned",
  "review.approved",
  "review.rejected",
  "crm.sync.started",
  "crm.sync.completed",
  "face.verification.completed",
  "kyc.completed"
]);

export const eventEnvelopeSchema = z.object({
  id: z.string().min(8),
  name: eventNameSchema,
  version: z.number().int().positive(),
  occurredAt: z.string().datetime(),
  producer: z.string().min(1),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  payload: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
