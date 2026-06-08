import "./observability/tracingBootstrap";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import {
  JsonEventLogger,
  createEventBus,
  RedisConnectionFactory
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
import { traceMiddleware } from "./observability/tracing";
import { docsRoutes } from "./routes/docs.routes";
import { healthRoutes } from "./routes/health.routes";
import { eventRoutes } from "./routes/event.routes";
import { observabilityRoutes } from "./routes/observability.routes";
import { orchestrationRoutes } from "./routes/orchestration.routes";
import { authRoutes } from "./routes/auth.routes";
import { chatRoutes } from "./routes/chat.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import { onboardingFrontendRoutes } from "./routes/onboardingFrontend.routes";
import { ocrRoutes } from "./routes/ocr.routes";
import { validationRoutes } from "./routes/validation.routes";
import { reviewRoutes } from "./routes/review.routes";
import { crmRoutes } from "./routes/crm.routes";
import { CircuitBreakerService } from "./services/circuitBreaker.service";
import { HealthService } from "./services/health.service";
import { registerProxyRoutes } from "./services/proxy.service";
import { ServiceRegistry } from "./services/serviceRegistry.service";
import { sendAlert } from "./services/alerting.service";
import { prisma } from "./services/database.service";
import { validateAwsStorageStartup } from "./services/awsValidation.service";
import { validateStartupSecrets } from "./services/secrets.service";
import { requestIdMiddleware } from "./utils/requestId";

async function bootstrap(): Promise<void> {
  const logger = new Logger(env.SERVICE_NAME);
  await validateStartupSecrets();
  await validateAwsStorageStartup();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    await sendAlert({
      name: "database.connectivity_failed",
      severity: "critical",
      message: error instanceof Error ? error.message : "Database connectivity check failed"
    });
    throw error;
  }
  const metrics = new MetricsRegistry();
  const redis = env.EVENT_DRIVER === "redis" ? RedisConnectionFactory.getSharedConnection({ url: env.REDIS_URL }) : undefined;
  redis?.on("error", (error) => {
    logger.error("redis.connection.error", {
      error: error.message || error.name || "Redis connection failed"
    });
    void sendAlert({
      name: "redis.failure",
      severity: "critical",
      message: error.message || error.name || "Redis connection failed"
    });
  });
  if (env.NODE_ENV === "production" && redis) {
    await redis.ping();
  }
  const eventBus = createEventBus({
    driver: env.EVENT_DRIVER,
    serviceName: env.SERVICE_NAME,
    redisConnection: redis,
    defaultSubscribers: {
      "client.created": ["crm-service", "data-room-service", "onboarding-service"],
      "document.uploaded": ["crm-service", "onboarding-service", "ocr-service"],
      "document.ocr.completed": ["validation-service"],
      "document.validation.completed": ["review-service"],
      "review.approved": ["face-verification-service"],
      "face.verification.completed": ["crm-sync-service"],
      "crm.sync.completed": ["kyc-service"]
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
  app.use(traceMiddleware);
  app.use(metricsMiddleware(metrics));
  app.use(requestLogger(logger));
  app.use(
    createRateLimiter(env.RATE_LIMIT_WINDOW_MS, env.RATE_LIMIT_MAX, {
      redis,
      logger
    })
  );
  app.use(docsRoutes());
  app.use(observabilityRoutes(metrics, eventBus));
  app.use(healthRoutes(healthService, eventBus));
  app.use(authRoutes());
  app.use(dashboardRoutes(eventBus));
  app.use(chatRoutes());
  app.use(onboardingFrontendRoutes(eventBus));
  app.use(eventRoutes(eventBus, logger));
  app.use(ocrRoutes(eventBus, logger));
  app.use(validationRoutes(eventBus, logger));
  app.use(reviewRoutes(eventBus, logger));
  app.use(crmRoutes(eventBus, logger));
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

    // Safety timeout of 15 seconds to force exit if clean-up hangs
    const forceExitTimeout = setTimeout(() => {
      logger.error("gateway.shutdown.timeout", { signal });
      process.exit(1);
    }, 15_000);
    forceExitTimeout.unref();

    server.close(async () => {
      try {
        serviceRegistry.stopPolling();
        await eventBus.close();
        await RedisConnectionFactory.closeAll();
        logger.warn("gateway.shutdown.completed", { signal });
        clearTimeout(forceExitTimeout);
        process.exit(0);
      } catch (error) {
        logger.error("gateway.shutdown.failed", {
          error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
      }
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
