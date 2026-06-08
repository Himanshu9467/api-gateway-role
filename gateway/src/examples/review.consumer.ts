import "../observability/tracingBootstrap";
import {
  JsonEventLogger,
  createEventBus,
  createRedisConnection
} from "@ai-platform/events";
import { env } from "../config/env";
import { startExampleSubscriber } from "./createSubscriber";
import { evaluateReview } from "../services/review.service";

const redis = createRedisConnection({ url: env.REDIS_URL });
const logger = new JsonEventLogger("review-service");
const eventBus = createEventBus({
  driver: "redis",
  serviceName: "review-service",
  redisConnection: redis,
  logger
});

void startExampleSubscriber("review-service", "document.validation.completed", async (event) => {
  const result = await evaluateReview(
    event.payload.documentId,
    event.payload.score,
    event.payload.valid
  );

  const clientId = (event.metadata?.clientId as string) ?? undefined;

  if (result.decision === "approved") {
    await eventBus.publish(
      "review.approved",
      { reviewId: result.reviewId },
      {
        correlationId: event.correlationId,
        idempotencyKey: `review-approved-${result.reviewId}`,
        targets: ["face-verification-service"],
        metadata: { sourceEvent: event.id, clientId }
      }
    );
  } else if (result.decision === "assigned") {
    await eventBus.publish(
      "review.assigned",
      { reviewId: result.reviewId, reviewerId: result.reviewerId! },
      {
        correlationId: event.correlationId,
        idempotencyKey: `review-assigned-${result.reviewId}`,
        metadata: { sourceEvent: event.id, clientId }
      }
    );
  } else {
    await eventBus.publish(
      "review.rejected",
      { reviewId: result.reviewId, reason: result.reason! },
      {
        correlationId: event.correlationId,
        idempotencyKey: `review-rejected-${result.reviewId}`,
        metadata: { sourceEvent: event.id, clientId }
      }
    );
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "review-service",
      message: `Review ${result.decision} for document`,
      event: event.name,
      status: "completed",
      eventId: event.id,
      documentId: event.payload.documentId,
      reviewId: result.reviewId,
      decision: result.decision,
      correlationId: event.correlationId
    })
  );
});
