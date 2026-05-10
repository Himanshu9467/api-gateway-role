import { randomUUID } from "crypto";
import type { Redis } from "ioredis";
import { eventSchemas } from "../schemas/events";
import { JsonEventLogger } from "../logging/jsonLogger";
import { QueueManager } from "../queue/queueManager";
import { SubscriptionRegistry } from "../subscriber/subscriptionRegistry";
import type { EventEnvelope, EventLogger, EventName, EventPayload, PublishOptions } from "../types";

export interface EventPublisherOptions {
  serviceName: string;
  connection: Redis;
  queueManager?: QueueManager;
  registry?: SubscriptionRegistry;
  logger?: EventLogger;
}

export class EventPublisher {
  private readonly queueManager: QueueManager;
  private readonly registry: SubscriptionRegistry;
  private readonly logger: EventLogger;

  constructor(private readonly options: EventPublisherOptions) {
    this.queueManager = options.queueManager ?? new QueueManager(options.connection);
    this.registry = options.registry ?? new SubscriptionRegistry(options.connection);
    this.logger = options.logger ?? new JsonEventLogger(options.serviceName);
  }

  async publish<N extends EventName>(
    name: N,
    payload: EventPayload<N>,
    options: PublishOptions = {}
  ): Promise<EventEnvelope<N>> {
    const parsedPayload = eventSchemas[name].parse(payload) as EventPayload<N>;
    const event: EventEnvelope<N> = {
      id: randomUUID(),
      name,
      version: 1,
      occurredAt: new Date().toISOString(),
      producer: this.options.serviceName,
      correlationId: options.correlationId ?? randomUUID(),
      idempotencyKey:
        options.idempotencyKey ??
        `${name.replace(/\./g, "-")}-${randomUUID()}`,
      payload: parsedPayload,
      metadata: options.metadata
    };

    const targets = options.targets ?? (await this.registry.subscribersFor(name));
    if (targets.length === 0) {
      this.logger.warn("event.publish.no_subscribers", {
        requestId: event.correlationId,
        eventId: event.id,
        event: name,
        status: "no_subscribers",
        correlationId: event.correlationId
      });
      return event;
    }

    await Promise.all(
      targets.map((consumerName) =>
        this.queueManager.getQueue(name, consumerName).add(name, event, {
          jobId: `${event.id}-${consumerName}`,
          ...options.jobOptions
        })
      )
    );

    this.logger.info("event.published", {
      requestId: event.correlationId,
      eventId: event.id,
      event: name,
      status: "queued",
      correlationId: event.correlationId,
      targets
    });

    return event;
  }
}
