import { Router } from "express";
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

export function dashboardRoutes(): Router {
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

  router.post("/api/clients", (req, res, next) => {
    try {
      const body = createClientSchema.parse(req.body);
      const client = createClient(body);
      res.status(201).json(client);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
