import "../observability/tracingBootstrap";
import {
  JsonEventLogger,
  createEventBus,
  createRedisConnection
} from "@ai-platform/events";
import { env } from "../config/env";
import { startExampleSubscriber } from "./createSubscriber";
import { completeKyc } from "../services/onboardingState.service";
import { writeAuditLog } from "../services/audit.service";
import { randomUUID } from "crypto";

const redis = createRedisConnection({ url: env.REDIS_URL });
const logger = new JsonEventLogger("kyc-service");
const eventBus = createEventBus({
  driver: "redis",
  serviceName: "kyc-service",
  redisConnection: redis,
  logger
});

void startExampleSubscriber("kyc-service", "crm.sync.completed", async (event) => {
  const kycId = `kyc-${randomUUID().slice(0, 12)}`;
  const clientId = (event.metadata?.clientId as string) ?? event.payload.customerId;

  const result = await completeKyc(kycId, clientId, "approved");

  await eventBus.publish(
    "kyc.completed",
    {
      kycId: result.kycId,
      status: result.status
    },
    {
      correlationId: event.correlationId,
      idempotencyKey: `kyc-${kycId}`,
      metadata: {
        sourceEvent: event.id,
        clientId,
        crmReference: event.payload.crmReference
      }
    }
  );

  await writeAuditLog({
    action: "kyc.completed",
    actorType: "service",
    actorId: "kyc-service",
    clientId,
    metadata: {
      kycId: result.kycId,
      status: result.status,
      crmReference: event.payload.crmReference
    }
  });

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "kyc-service",
      message: "KYC completed",
      event: event.name,
      status: "completed",
      eventId: event.id,
      kycId: result.kycId,
      kycStatus: result.status,
      clientId,
      correlationId: event.correlationId
    })
  );
});
