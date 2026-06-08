import "../observability/tracingBootstrap";
import {
  JsonEventLogger,
  createEventBus,
  createRedisConnection
} from "@ai-platform/events";
import { env } from "../config/env";
import { startExampleSubscriber } from "./createSubscriber";
import { syncCrmRecord } from "../services/crmState.service";
import { writeAuditLog } from "../services/audit.service";

const redis = createRedisConnection({ url: env.REDIS_URL });
const logger = new JsonEventLogger("crm-sync-service");
const eventBus = createEventBus({
  driver: "redis",
  serviceName: "crm-sync-service",
  redisConnection: redis,
  logger
});

void startExampleSubscriber("crm-sync-service", "face.verification.completed", async (event) => {
  const customerId = (event.metadata?.clientId as string) ?? event.payload.verificationId;

  await eventBus.publish(
    "crm.sync.started",
    { customerId },
    {
      correlationId: event.correlationId,
      idempotencyKey: `crm-sync-started-${customerId}-${event.id}`,
      metadata: { sourceEvent: event.id }
    }
  );

  await writeAuditLog({
    action: "crm.sync.started",
    actorType: "service",
    actorId: "crm-sync-service",
    clientId: customerId,
    metadata: { verificationId: event.payload.verificationId }
  });

  const result = await syncCrmRecord(customerId);

  await eventBus.publish(
    "crm.sync.completed",
    {
      customerId: result.customerId,
      crmReference: result.crmReference
    },
    {
      correlationId: event.correlationId,
      idempotencyKey: `crm-sync-completed-${customerId}-${event.id}`,
      targets: ["kyc-service"],
      metadata: {
        sourceEvent: event.id,
        clientId: customerId
      }
    }
  );

  await writeAuditLog({
    action: "crm.sync.completed",
    actorType: "service",
    actorId: "crm-sync-service",
    clientId: customerId,
    metadata: {
      crmReference: result.crmReference,
      verificationId: event.payload.verificationId
    }
  });

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "crm-sync-service",
      message: "CRM sync completed",
      event: event.name,
      status: "completed",
      eventId: event.id,
      customerId: result.customerId,
      crmReference: result.crmReference,
      correlationId: event.correlationId
    })
  );
});
