import {
  JsonEventLogger,
  createEventBus,
  RedisConnectionFactory,
  type EventEnvelope,
  type EventHandler,
  type EventName
} from "@ai-platform/events";
import express from "express";
import { env } from "../config/env";
import { appMetrics } from "../observability/appMetrics";
import { withEventTrace } from "../observability/tracing";
import { sendAlert } from "../services/alerting.service";

interface ExampleSubscription<N extends EventName> {
  eventName: N;
  handler: EventHandler<N>;
}

type AnyExampleSubscription = {
  [N in EventName]: ExampleSubscription<N>;
}[EventName];

export async function startExampleSubscriber<N extends EventName>(
  serviceName: string,
  eventName: N,
  handler: EventHandler<N>
): Promise<void> {
  await startExampleSubscribers(serviceName, [{ eventName, handler } as AnyExampleSubscription]);
}

export async function startExampleSubscribers(
  serviceName: string,
  subscriptions: AnyExampleSubscription[]
): Promise<void> {
  const redis = RedisConnectionFactory.getSharedConnection({ url: env.REDIS_URL });
  const logger = new JsonEventLogger(serviceName);
  redis.on("error", (error) => {
    logger.error("redis.connection.error", {
      error: error.message || error.name || "Redis connection failed"
    });
    void sendAlert({
      name: "worker.redis_failure",
      severity: "critical",
      message: error.message || error.name || "Redis connection failed",
      labels: { serviceName }
    });
  });
  const eventBus = createEventBus({
    driver: "redis",
    serviceName,
    redisConnection: redis,
    logger,
    concurrency: env.WORKER_CONCURRENCY
  });
  await Promise.all(
    subscriptions.map((subscription) =>
      eventBus.subscribe(
        subscription.eventName,
        serviceName,
        async (event: EventEnvelope<EventName>) => {
          await withEventTrace(serviceName, event, async () => {
            appMetrics.increment("gateway_worker_jobs_total", {
              event: event.name,
              consumer: serviceName,
              status: "started"
            });
            try {
              const startedAt = process.hrtime.bigint();
              await (subscription.handler as (event: EventEnvelope<EventName>) => Promise<void>)(event);
              const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
              appMetrics.increment("gateway_events_consumed_total", {
                event: event.name,
                consumer: serviceName
              });
              appMetrics.increment("gateway_worker_job_duration_ms_sum", {
                event: event.name,
                consumer: serviceName
              }, Math.round(durationMs));
              appMetrics.increment("gateway_worker_jobs_total", {
                event: event.name,
                consumer: serviceName,
                status: "completed"
              });
            } catch (error) {
              appMetrics.increment("gateway_worker_jobs_total", {
                event: event.name,
                consumer: serviceName,
                status: "failed"
              });
              void sendAlert({
                name: "worker.job_failed",
                severity: "critical",
                message: error instanceof Error ? error.message : "Worker job failed",
                labels: { serviceName, event: event.name }
              });
              throw error;
            }
          });
        }
      )
    )
  );
  logger.info("example.consumer.started", {
    events: subscriptions.map((subscription) => subscription.eventName),
    consumerName: serviceName
  });
  const metricsServer = startWorkerMetricsServer(serviceName, eventBus);

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.warn("example.consumer.shutdown.started", { signal, serviceName });

    // Force-quit after 15 seconds safety timeout if clean-up hangs
    const forceExitTimeout = setTimeout(() => {
      logger.error("example.consumer.shutdown.timeout", { serviceName });
      process.exit(1);
    }, 15_000);
    forceExitTimeout.unref();

    try {
      metricsServer?.close();
      await eventBus.close();
      await RedisConnectionFactory.closeAll();
      logger.warn("example.consumer.shutdown.completed", { signal, serviceName });
      clearTimeout(forceExitTimeout);
      process.exit(0);
    } catch (error) {
      logger.error("example.consumer.shutdown.failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function startWorkerMetricsServer(serviceName: string, eventBus: { queueStats?: () => Promise<any[]> }) {
  const app = express();
  const port = env.WORKER_METRICS_PORT ?? defaultWorkerMetricsPort(serviceName);
  app.get("/metrics", async (_req, res, next) => {
    try {
      const stats = (await eventBus.queueStats?.()) ?? [];
      for (const item of stats) {
        const labels = { event: item.eventName, consumer: item.consumerName };
        appMetrics.setGauge("gateway_worker_queue_waiting", labels, item.counts.waiting);
        appMetrics.setGauge("gateway_worker_queue_active", labels, item.counts.active);
        appMetrics.setGauge("gateway_worker_queue_failed", labels, item.counts.failed);
        appMetrics.setGauge("gateway_worker_dlq_count", labels, item.dlqCounts.waiting + item.dlqCounts.failed);
        if (item.dlqCounts.waiting + item.dlqCounts.failed > 0) {
          void sendAlert({
            name: "worker.dlq_growth",
            severity: "critical",
            message: `DLQ has ${item.dlqCounts.waiting + item.dlqCounts.failed} jobs`,
            labels
          });
        }
      }
      res.type("text/plain; version=0.0.4").send(appMetrics.renderCounters());
    } catch (error) {
      next(error);
    }
  });
  return app.listen(port);
}

function defaultWorkerMetricsPort(serviceName: string): number {
  if (serviceName.includes("crm-sync")) return 4107;
  if (serviceName.includes("crm")) return 4101;
  if (serviceName.includes("data-room")) return 4102;
  if (serviceName.includes("onboarding")) return 4103;
  if (serviceName.includes("ocr")) return 4104;
  if (serviceName.includes("validation")) return 4105;
  if (serviceName.includes("review")) return 4106;
  if (serviceName.includes("face-verification")) return 4108;
  if (serviceName.includes("kyc")) return 4109;
  return 4100;
}
