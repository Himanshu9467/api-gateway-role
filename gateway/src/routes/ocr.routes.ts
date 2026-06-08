import { randomUUID } from "crypto";
import { Router } from "express";
import type { EventBus } from "@ai-platform/events";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import { appMetrics } from "../observability/appMetrics";
import { withTraceMetadata } from "../observability/tracing";
import type { Logger } from "../observability/logger";
import { extractDocumentText } from "../services/ocr.service";

const ocrExtractRequestSchema = z.object({
  documentId: z.string().min(8).optional(),
  fileContent: z.string().min(1).optional(),
  clientId: z.string().min(8).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export function ocrRoutes(eventBus: EventBus, logger: Logger): Router {
  const router = Router();

  router.post(
    "/api/ocr/extract",
    authenticate,
    requireRoles(["admin", "service"]),
    async (req, res, next) => {
      try {
        const body = ocrExtractRequestSchema.parse(req.body);
        const documentId = body.documentId ?? randomUUID();

        const result = await extractDocumentText(documentId, body.fileContent);

        const event = await eventBus.publish(
          "document.ocr.completed",
          {
            documentId: result.documentId,
            extractedText: result.extractedText,
            confidence: result.confidence
          },
          {
            correlationId: req.correlationId ?? req.requestId,
            idempotencyKey: `ocr-extract-${documentId}`,
            targets: ["validation-service"],
            metadata: withTraceMetadata({
              route: req.originalUrl,
              userId: req.user?.id,
              clientId: body.clientId,
              ...body.metadata
            })
          }
        );

        logger.info("event.route.ocr_extract.accepted", {
          requestId: req.requestId,
          route: req.originalUrl,
          event: event.name,
          eventId: event.id,
          status: "queued",
          correlationId: event.correlationId,
          documentId
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
            confidence: result.confidence,
            extractedLength: result.extractedText.length
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
