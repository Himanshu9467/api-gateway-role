import { randomUUID } from "crypto";
import { Router } from "express";
import type { EventBus } from "@ai-platform/events";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import type { Logger } from "../observability/logger";

const clientCreatedRequestSchema = z.object({
  clientId: z.string().min(8).optional(),
  companyName: z.string().min(1),
  createdBy: z.string().min(1).default("api-gateway"),
  plan: z.enum(["starter", "growth", "enterprise"]).default("growth"),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const documentUploadedRequestSchema = z.object({
  clientId: z.string().min(8),
  documentId: z.string().min(8).optional(),
  fileName: z.string().min(1),
  uploadedBy: z.string().min(1).default("api-gateway"),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export function eventRoutes(eventBus: EventBus, logger: Logger): Router {
  const router = Router();

  router.get("/test-event", (req, res) => {
    res.json({
      success: true,
      message: "Event route working"
    });
  });

  router.post(
    "/api/events/client-created",
    authenticate,
    requireRoles(["admin", "service"]),
    async (req, res, next) => {
      try {
        const body = clientCreatedRequestSchema.parse(req.body);
        const clientId = body.clientId ?? randomUUID();
        const event = await eventBus.publish(
          "client.created",
          {
            clientId,
            companyName: body.companyName,
            createdBy: body.createdBy,
            plan: body.plan
          },
          {
            correlationId: req.requestId,
            idempotencyKey: `client-created${clientId}`,
            targets: ["crm-service", "data-room-service"],
            metadata: {
              route: req.originalUrl,
              userId: req.user?.id,
              ...body.metadata
            }
          }
        );

        logger.info("event.route.client_created.accepted", {
          requestId: req.requestId,
          route: req.originalUrl,
          event: event.name,
          eventId: event.id,
          status: "queued",
          correlationId: event.correlationId,
          clientId
        });

        res.status(202).json({
          requestId: req.requestId,
          status: "accepted",
          eventId: event.id,
          event: event.name,
          correlationId: event.correlationId,
          targets: ["crm-service", "data-room-service"]
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/api/events/document-uploaded",
    authenticate,
    requireRoles(["admin", "user", "service"]),
    async (req, res, next) => {
      try {
        const body = documentUploadedRequestSchema.parse(req.body);
        const documentId = body.documentId ?? randomUUID();
        const event = await eventBus.publish(
          "document.uploaded",
          {
            clientId: body.clientId,
            documentId,
            fileName: body.fileName,
            uploadedBy: body.uploadedBy
          },
          {
            correlationId: req.requestId,
            idempotencyKey: `document-uploaded-${documentId}`,
            targets: ["crm-service", "onboarding-service"],
            metadata: {
              route: req.originalUrl,
              userId: req.user?.id,
              ...body.metadata
            }
          }
        );

        logger.info("event.route.document_uploaded.accepted", {
          requestId: req.requestId,
          route: req.originalUrl,
          event: event.name,
          eventId: event.id,
          status: "queued",
          correlationId: event.correlationId,
          clientId: body.clientId,
          documentId
        });

        res.status(202).json({
          requestId: req.requestId,
          status: "accepted",
          eventId: event.id,
          event: event.name,
          correlationId: event.correlationId,
          targets: ["crm-service", "onboarding-service"]
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
