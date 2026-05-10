import { Router } from "express";
import type { EventBus } from "@ai-platform/events";
import type { HealthService } from "../services/health.service";

export function healthRoutes(healthService: HealthService, eventBus?: EventBus): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json(healthService.gatewayHealth());
  });

  router.get("/health/services", async (_req, res, next) => {
    try {
      const services = await healthService.servicesHealth();
      const allHealthy = services.every((service) =>
        service.instances.some((instance) => instance.status === "UP")
      );
      res.status(allHealthy ? 200 : 207).json({
        status: allHealthy ? "healthy" : "degraded",
        services
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/health/events", async (_req, res, next) => {
    try {
      const queues = eventBus?.queueStats ? await eventBus.queueStats() : [];
      const hasDeadLetters = queues.some((queue) => queue.dlqCounts.waiting > 0);
      const hasFailures = queues.some((queue) => queue.counts.failed > 0);

      res.status(hasDeadLetters || hasFailures ? 207 : 200).json({
        status: hasDeadLetters || hasFailures ? "degraded" : "healthy",
        queues
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
