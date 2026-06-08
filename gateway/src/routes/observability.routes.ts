import { Router } from "express";
import { env } from "../config/env";
import type { MetricsRegistry } from "../observability/metrics";
import { appMetrics } from "../observability/appMetrics";
import { sendAlert } from "../services/alerting.service";
import type { EventBus } from "@ai-platform/events";

export function observabilityRoutes(metrics: MetricsRegistry, eventBus?: EventBus): Router {
  const router = Router();

  router.get("/metrics", async (_req, res, next) => {
    try {
      if (eventBus?.queueStats) {
        const stats = await eventBus.queueStats();
        for (const item of stats) {
          const labels = { event: item.eventName, consumer: item.consumerName };
          appMetrics.setGauge("gateway_worker_queue_waiting", labels, item.counts.waiting);
          appMetrics.setGauge("gateway_worker_queue_active", labels, item.counts.active);
          appMetrics.setGauge("gateway_worker_queue_failed", labels, item.counts.failed);
          appMetrics.setGauge("gateway_worker_dlq_count", labels, item.dlqCounts.waiting + item.dlqCounts.failed);
        }
      }
      res.type("text/plain; version=0.0.4").send(metrics.renderPrometheus());
    } catch (error) {
      next(error);
    }
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
