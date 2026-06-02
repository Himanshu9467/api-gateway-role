import { Router } from "express";
import { env } from "../config/env";
import type { MetricsRegistry } from "../observability/metrics";
import { appMetrics } from "../observability/appMetrics";
import { sendAlert } from "../services/alerting.service";

export function observabilityRoutes(metrics: MetricsRegistry): Router {
  const router = Router();

  router.get("/metrics", (_req, res) => {
    res.type("text/plain; version=0.0.4").send(metrics.renderPrometheus());
  });

  router.get("/metrics/workers", (_req, res) => {
    res.type("text/plain; version=0.0.4").send(appMetrics.renderCounters());
  });

  router.post("/alerts/check", async (_req, res, next) => {
    try {
      const snapshot = metrics.snapshot();
      const errorRate = snapshot.requests > 0 ? snapshot.errors / snapshot.requests : 0;
      const alerts = [];
      if (errorRate >= env.ALERT_HIGH_ERROR_RATE_THRESHOLD) {
        alerts.push({
          name: "gateway.high_error_rate",
          severity: "critical" as const,
          message: `Gateway 5xx error rate is ${errorRate.toFixed(4)}`,
          labels: { errorRate }
        });
      }
      if (snapshot.averageLatencyMs >= env.ALERT_HIGH_LATENCY_MS) {
        alerts.push({
          name: "gateway.high_latency",
          severity: "warning" as const,
          message: `Gateway average latency is ${Math.round(snapshot.averageLatencyMs)}ms`,
          labels: { averageLatencyMs: Math.round(snapshot.averageLatencyMs) }
        });
      }
      await Promise.all(alerts.map((alert) => sendAlert(alert)));
      res.json({ alertsSent: alerts.length, snapshot });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
