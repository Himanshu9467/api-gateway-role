import "../observability/tracingBootstrap";
import {
  JsonEventLogger,
  createEventBus,
  createRedisConnection
} from "@ai-platform/events";
import { env } from "../config/env";
import { startExampleSubscriber } from "./createSubscriber";
import { extractDocumentText } from "../services/ocr.service";

const redis = createRedisConnection({ url: env.REDIS_URL });
const logger = new JsonEventLogger("ocr-service");
const eventBus = createEventBus({
  driver: "redis",
  serviceName: "ocr-service",
  redisConnection: redis,
  logger
});

void startExampleSubscriber("ocr-service", "document.uploaded", async (event) => {
  const result = await extractDocumentText(
    event.payload.documentId,
    (event.metadata?.fileContent as string) ?? undefined
  );

  await eventBus.publish(
    "document.ocr.completed",
    {
      documentId: result.documentId,
      extractedText: result.extractedText,
      confidence: result.confidence
    },
    {
      correlationId: event.correlationId,
      idempotencyKey: `ocr-${event.payload.documentId}`,
      targets: ["validation-service"],
      metadata: {
        sourceEvent: event.id,
        clientId: event.payload.clientId
      }
    }
  );

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "ocr-service",
      message: "OCR completed for document",
      event: event.name,
      status: "completed",
      eventId: event.id,
      documentId: result.documentId,
      confidence: result.confidence,
      correlationId: event.correlationId
    })
  );
});
