import { Router } from "express";
import type { EventBus } from "@ai-platform/events";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
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

  router.get("/api/dashboard/summary", (_req, res) => {
    res.json(getDashboardSummary());
  });

  router.get("/api/dashboard/clients", (_req, res) => {
    res.json(listClients());
  });

  router.get("/api/dashboard/activity", (_req, res) => {
    res.json(listActivity());
  });

  router.get("/api/clients/:clientId", (req, res) => {
    const client = getClient(req.params.clientId);
    if (!client) {
      res.status(404).json({
        error: "client_not_found",
        message: "Client was not found",
        requestId: req.requestId
      });
      return;
    }

    res.json(client);
  });

  router.post("/api/clients", async (req, res, next) => {
    try {
      const body = createClientSchema.parse(req.body);
      const client = createClient(body);
      await eventBus.publish(
        "client.created",
        {
          clientId: client.id,
          companyName: client.name,
          createdBy: req.user?.id ?? "api-gateway",
          plan: serviceTierToPlan(client.serviceTier)
        },
        {
          correlationId: req.requestId,
          idempotencyKey: `client-created-${client.id}`,
          targets: ["crm-service", "data-room-service", "onboarding-service"],
          metadata: {
            route: req.originalUrl,
            userId: req.user?.id,
            contactPerson: client.contactPerson,
            contactEmail: client.contactEmail,
            jurisdiction: client.jurisdiction,
            clientType: client.clientType,
            serviceTier: client.serviceTier
          }
        }
      );
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
