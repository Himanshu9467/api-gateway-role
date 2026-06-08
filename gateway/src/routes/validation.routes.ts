import { randomUUID } from "crypto";
import { Router } from "express";
import type { EventBus } from "@ai-platform/events";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import { appMetrics } from "../observability/appMetrics";
import { withTraceMetadata } from "../observability/tracing";
import type { Logger } from "../observability/logger";
import { validateDocument } from "../services/validation.service";

const validationRequestSchema = z.object({
  documentId: z.string().min(8),
  extractedText: z.string().min(1),
  confidence: z.number().min(0).max(1),
  clientId: z.string().min(8).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export function validationRoutes(eventBus: EventBus, logger: Logger): Router {
  const router = Router();

  router.post(
    "/api/validation/document",
    authenticate,
    requireRoles(["admin", "service"]),
    async (req, res, next) => {
      try {
        const body = validationRequestSchema.parse(req.body);

        const result = await validateDocument(
          body.documentId,
          body.extractedText,
          body.confidence
        );

        const event = await eventBus.publish(
          "document.validation.completed",
          {
            documentId: result.documentId,
            valid: result.valid,
            score: result.score,
            issues: result.issues
          },
          {
            correlationId: req.correlationId ?? req.requestId,
            idempotencyKey: `validation-${body.documentId}`,
            targets: ["review-service"],
            metadata: withTraceMetadata({
              route: req.originalUrl,
              userId: req.user?.id,
              clientId: body.clientId,
              ...body.metadata
            })
          }
        );

        logger.info("event.route.validation_document.accepted", {
          requestId: req.requestId,
          route: req.originalUrl,
          event: event.name,
          eventId: event.id,
          status: "queued",
          correlationId: event.correlationId,
          documentId: body.documentId
        });
        appMetrics.increment("gateway_events_published_total", {
          event: event.name,
          producer: "gateway"
        });

        res.status(202).json({
          requestId: req.requestId,
          status: "accepted",
          eventId: event.id,
          event: event.name,
          correlationId: event.correlationId,
          result: {
            documentId: result.documentId,
            valid: result.valid,
            score: result.score,
            issues: result.issues
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
