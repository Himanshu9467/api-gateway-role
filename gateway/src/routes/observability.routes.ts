import { Router } from "express";
import type { MetricsRegistry } from "../observability/metrics";

export function observabilityRoutes(metrics: MetricsRegistry): Router {
  const router = Router();

  router.get("/metrics", (_req, res) => {
    res.type("text/plain; version=0.0.4").send(metrics.renderPrometheus());
  });

  return router;
}
