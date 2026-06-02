import { Router } from "express";
import type { EventBus } from "@ai-platform/events";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import { appMetrics } from "../observability/appMetrics";
import { withTraceMetadata } from "../observability/tracing";
import { writeAuditLog } from "../services/audit.service";
import {
  createClient,
  getClient,
  getDashboardSummary,
  listActivity,
  listClients
} from "../services/frontendMockData.service";

const createClientSchema = z.object({
  companyName: z.string().min(1),
  contactPerson: z.string().min(1),
  email: z.string().email(),
  jurisdiction: z.string().min(1),
  serviceTier: z.enum(["Starter", "Professional", "Enterprise"]),
  clientType: z.enum(["Corporate", "SME", "Startup", "Individual"])
});

export function dashboardRoutes(eventBus: EventBus): Router {
  const router = Router();

  router.use(authenticate, requireRoles(["admin", "user"]));

  router.get("/api/dashboard/summary", async (_req, res, next) => {
    try {
      res.json(await getDashboardSummary());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/dashboard/clients", async (_req, res, next) => {
    try {
      res.json(await listClients());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/dashboard/activity", async (_req, res, next) => {
    try {
      res.json(await listActivity());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/clients/:clientId", async (req, res, next) => {
    try {
      const client = await getClient(req.params.clientId);
      if (!client) {
        res.status(404).json({
          error: "client_not_found",
          message: "Client was not found",
          requestId: req.requestId
        });
        return;
      }

      res.json(client);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/clients", async (req, res, next) => {
    try {
      const body = createClientSchema.parse(req.body);
      const client = await createClient(body);
      await writeAuditLog({
        action: "client.create",
        actorId: req.user?.id,
        actorType: req.user?.authType === "api-key" ? "service" : "user",
        clientId: client.id,
        ipAddress: req.ip,
        userAgent: req.header("user-agent"),
        metadata: {
          clientType: client.clientType,
          serviceTier: client.serviceTier,
          jurisdiction: client.jurisdiction
        }
      });
      await eventBus.publish(
        "client.created",
        {
          clientId: client.id,
          companyName: client.name,
          createdBy: req.user?.id ?? "api-gateway",
          plan: serviceTierToPlan(client.serviceTier)
        },
        {
          correlationId: req.correlationId ?? req.requestId,
          idempotencyKey: `client-created-${client.id}`,
          targets: ["crm-service", "data-room-service", "onboarding-service"],
          metadata: withTraceMetadata({
            route: req.originalUrl,
            userId: req.user?.id,
            contactPerson: client.contactPerson,
            contactEmail: client.contactEmail,
            jurisdiction: client.jurisdiction,
            clientType: client.clientType,
            serviceTier: client.serviceTier
          })
        }
      );
      appMetrics.increment("gateway_events_published_total", {
        event: "client.created",
        producer: "gateway"
      });
      res.status(201).json(client);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function serviceTierToPlan(serviceTier: "Starter" | "Professional" | "Enterprise"): "starter" | "growth" | "enterprise" {
  if (serviceTier === "Starter") return "starter";
  if (serviceTier === "Enterprise") return "enterprise";
  return "growth";
}
