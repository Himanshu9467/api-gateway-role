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

export const eventSchemas = {
  "client.created": clientCreatedSchema,
  "client.onboarded": clientOnboardedSchema,
  "document.uploaded": documentUploadedSchema,
  "workflow.completed": workflowCompletedSchema
} as const;

export const eventNameSchema = z.enum([
  "client.created",
  "client.onboarded",
  "document.uploaded",
  "workflow.completed"
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
