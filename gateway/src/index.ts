import cors from "cors";
import express from "express";
import helmet from "helmet";
import {
  JsonEventLogger,
  createEventBus,
  createRedisConnection
} from "@ai-platform/events";
import { env } from "./config/env";
import { serviceRoutes } from "./config/services.config";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/logger";
import { createRateLimiter } from "./middleware/rateLimit";
import { CommandParser } from "./orchestrator/parser/commandParser";
import { AiOrchestrator } from "./orchestrator/commands/orchestrator";
import { OnboardClientWorkflow } from "./orchestrator/workflows/onboardClient.workflow";
import { Logger } from "./observability/logger";
import { MetricsRegistry, metricsMiddleware } from "./observability/metrics";
import { docsRoutes } from "./routes/docs.routes";
import { healthRoutes } from "./routes/health.routes";
import { eventRoutes } from "./routes/event.routes";
import { observabilityRoutes } from "./routes/observability.routes";
import { orchestrationRoutes } from "./routes/orchestration.routes";
import { CircuitBreakerService } from "./services/circuitBreaker.service";
import { HealthService } from "./services/health.service";
import { registerProxyRoutes } from "./services/proxy.service";
import { ServiceRegistry } from "./services/serviceRegistry.service";
import { requestIdMiddleware } from "./utils/requestId";

async function bootstrap(): Promise<void> {
  const logger = new Logger(env.SERVICE_NAME);
  const metrics = new MetricsRegistry();
  const redis = env.EVENT_DRIVER === "redis" ? createRedisConnection({ url: env.REDIS_URL }) : undefined;
  redis?.on("error", (error) => {
    logger.error("redis.connection.error", {
      error: error.message || error.name || "Redis connection failed"
    });
  });
  const eventBus = createEventBus({
    driver: env.EVENT_DRIVER,
    serviceName: env.SERVICE_NAME,
    redisConnection: redis,
    defaultSubscribers: {
      "client.created": ["crm-service", "data-room-service", "onboarding-service"],
      "document.uploaded": ["crm-service", "onboarding-service"]
    },
    logger: new JsonEventLogger(env.SERVICE_NAME)
  });

  const circuitBreaker = new CircuitBreakerService();
  const serviceRegistry = new ServiceRegistry(serviceRoutes, logger);
  serviceRegistry.startPolling();
  const healthService = new HealthService(serviceRegistry, circuitBreaker);
  const orchestrator = new AiOrchestrator(
    new CommandParser(),
    new OnboardClientWorkflow(eventBus, logger)
  );

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestIdMiddleware);
  app.use(metricsMiddleware(metrics));
  app.use(requestLogger(logger));
  app.use(
    createRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX, {
      redis,
      logger
    })
  );
  app.use(docsRoutes());
  app.use(observabilityRoutes(metrics));
  app.use(healthRoutes(healthService, eventBus));
  app.use(eventRoutes(eventBus, logger));
  app.use(orchestrationRoutes(orchestrator));

  registerProxyRoutes(app, serviceRoutes, circuitBreaker, serviceRegistry, logger);

  app.use(errorHandler(logger));

  const server = app.listen(env.PORT, () => {
    logger.info("gateway.started", {
      port: env.PORT,
      routes: serviceRoutes.map((route) => ({
        prefix: route.routePrefix,
        targets: route.instances.map((instance) => instance.url),
        allowedRoles: route.allowedRoles
      }))
    });
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.warn("gateway.shutdown.started", { signal });
    server.close(async () => {
      serviceRegistry.stopPolling();
      await eventBus.close();
      redis?.disconnect();
      logger.warn("gateway.shutdown.completed", { signal });
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  const logger = new Logger(env.SERVICE_NAME);
  logger.error("gateway.startup.failed", {
    error: error instanceof Error ? error.message : "Unknown startup error"
  });
  process.exit(1);
});
