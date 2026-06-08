import { Router } from "express";
import type { EventBus } from "@ai-platform/events";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import { appMetrics } from "../observability/appMetrics";
import { withTraceMetadata } from "../observability/tracing";
import type { Logger } from "../observability/logger";
import { syncCrmRecord } from "../services/crmState.service";
import { writeAuditLog } from "../services/audit.service";

const crmSyncRequestSchema = z.object({
  customerId: z.string().min(8),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export function crmRoutes(eventBus: EventBus, logger: Logger): Router {
  const router = Router();

  router.post(
    "/api/crm/sync",
    authenticate,
    requireRoles(["admin", "service"]),
    async (req, res, next) => {
      try {
        const body = crmSyncRequestSchema.parse(req.body);

        const startedEvent = await eventBus.publish(
          "crm.sync.started",
          { customerId: body.customerId },
          {
            correlationId: req.correlationId ?? req.requestId,
            idempotencyKey: `crm-sync-started-api-${body.customerId}`,
            metadata: withTraceMetadata({
              route: req.originalUrl,
              userId: req.user?.id,
              ...body.metadata
            })
          }
        );

        await writeAuditLog({
          action: "crm.sync.started",
          actorType: "service",
          actorId: req.user?.id ?? "api-gateway",
          clientId: body.customerId,
          metadata: { source: "api" }
        });

        const result = await syncCrmRecord(body.customerId);

        const completedEvent = await eventBus.publish(
          "crm.sync.completed",
          {
            customerId: result.customerId,
            crmReference: result.crmReference
          },
          {
            correlationId: req.correlationId ?? req.requestId,
            idempotencyKey: `crm-sync-completed-api-${body.customerId}`,
            targets: ["kyc-service"],
            metadata: withTraceMetadata({
              route: req.originalUrl,
              userId: req.user?.id,
              clientId: body.customerId,
              ...body.metadata
            })
          }
        );

        await writeAuditLog({
          action: "crm.sync.completed",
          actorType: "service",
          actorId: req.user?.id ?? "api-gateway",
          clientId: body.customerId,
          metadata: { crmReference: result.crmReference, source: "api" }
        });

        logger.info("event.route.crm_sync.accepted", {
          requestId: req.requestId,
          route: req.originalUrl,
          startedEventId: startedEvent.id,
          completedEventId: completedEvent.id,
          status: "completed",
          correlationId: completedEvent.correlationId,
          customerId: body.customerId
        });
        appMetrics.increment("gateway_events_published_total", {
          event: "crm.sync.completed",
          producer: "gateway"
        });

        res.status(202).json({
          requestId: req.requestId,
          status: "accepted",
          eventId: completedEvent.id,
          event: completedEvent.name,
          correlationId: completedEvent.correlationId,
          result: {
            customerId: result.customerId,
            crmReference: result.crmReference
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
