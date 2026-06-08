import "../observability/tracingBootstrap";
import {
  JsonEventLogger,
  createEventBus,
  createRedisConnection
} from "@ai-platform/events";
import { env } from "../config/env";
import { startExampleSubscriber } from "./createSubscriber";
import { verifyFace } from "../services/faceVerification.service";

const redis = createRedisConnection({ url: env.REDIS_URL });
const logger = new JsonEventLogger("face-verification-service");
const eventBus = createEventBus({
  driver: "redis",
  serviceName: "face-verification-service",
  redisConnection: redis,
  logger
});

void startExampleSubscriber("face-verification-service", "review.approved", async (event) => {
  const result = await verifyFace(event.payload.reviewId);

  await eventBus.publish(
    "face.verification.completed",
    {
      verificationId: result.verificationId,
      score: result.score
    },
    {
      correlationId: event.correlationId,
      idempotencyKey: `face-${result.verificationId}`,
      targets: ["crm-sync-service"],
      metadata: {
        sourceEvent: event.id,
        reviewId: event.payload.reviewId,
        clientId: (event.metadata?.clientId as string) ?? undefined,
        passed: result.passed
      }
    }
  );

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "face-verification-service",
      message: "Face verification completed",
      event: event.name,
      status: "completed",
      eventId: event.id,
      reviewId: event.payload.reviewId,
      verificationId: result.verificationId,
      score: result.score,
      passed: result.passed,
      correlationId: event.correlationId
    })
  );
});
