import "../observability/tracingBootstrap";
import {
  JsonEventLogger,
  createEventBus,
  createRedisConnection
} from "@ai-platform/events";
import { env } from "../config/env";
import { startExampleSubscriber } from "./createSubscriber";
import { validateDocument } from "../services/validation.service";

const redis = createRedisConnection({ url: env.REDIS_URL });
const logger = new JsonEventLogger("validation-service");
const eventBus = createEventBus({
  driver: "redis",
  serviceName: "validation-service",
  redisConnection: redis,
  logger
});

void startExampleSubscriber("validation-service", "document.ocr.completed", async (event) => {
  const result = await validateDocument(
    event.payload.documentId,
    event.payload.extractedText,
    event.payload.confidence
  );

  await eventBus.publish(
    "document.validation.completed",
    {
      documentId: result.documentId,
      valid: result.valid,
      score: result.score,
      issues: result.issues
    },
    {
      correlationId: event.correlationId,
      idempotencyKey: `validation-${event.payload.documentId}`,
      targets: ["review-service"],
      metadata: {
        sourceEvent: event.id,
        clientId: (event.metadata?.clientId as string) ?? undefined
      }
    }
  );

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "validation-service",
      message: "Validation completed for document",
      event: event.name,
      status: "completed",
      eventId: event.id,
      documentId: result.documentId,
      valid: result.valid,
      score: result.score,
      correlationId: event.correlationId
    })
  );
});
