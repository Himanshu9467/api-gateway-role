import { Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

import { eventEnvelopeSchema, eventSchemas } from "../schemas/events";
import { IdempotencyStore } from "../idempotency/idempotencyStore";
import { JsonEventLogger } from "../logging/jsonLogger";
import { QueueManager, customBackoffDelay } from "../queue/queueManager";
import { SubscriptionRegistry } from "./subscriptionRegistry";

import type {
  EventEnvelope,
  EventHandler,
  EventLogger,
  EventName,
  SubscriberOptions
} from "../types";

export interface EventSubscriberDependencies {
  serviceName: string;
  connection: Redis;
  queueManager?: QueueManager;
  registry?: SubscriptionRegistry;
  idempotencyStore?: IdempotencyStore;
  logger?: EventLogger;
}

export class EventSubscriber<N extends EventName> {
  private worker?: Worker<EventEnvelope<N>>;
  private workerConnection?: Redis;
  private readonly queueManager: QueueManager;
  private readonly registry: SubscriptionRegistry;
  private readonly idempotencyStore: IdempotencyStore;
  private readonly logger: EventLogger;

  constructor(
    private readonly options: SubscriberOptions<N>,
    private readonly handler: EventHandler<N>,
    private readonly dependencies: EventSubscriberDependencies
  ) {
    this.queueManager =
      dependencies.queueManager ??
      new QueueManager(dependencies.connection);

    this.registry =
      dependencies.registry ??
      new SubscriptionRegistry(dependencies.connection);

    this.idempotencyStore =
      dependencies.idempotencyStore ??
      new IdempotencyStore(dependencies.connection);

    this.logger =
      dependencies.logger ??
      new JsonEventLogger(dependencies.serviceName);
  }

  async start(): Promise<void> {
    await this.registry.register(
      this.options.eventName,
      this.options.consumerName
    );

    const queueName = this.queueManager.queueName(
      this.options.eventName,
      this.options.consumerName
    );

    this.workerConnection = (this.dependencies.connection as any).duplicate
      ? (this.dependencies.connection as any).duplicate()
      : this.dependencies.connection;

    this.worker = new Worker<EventEnvelope<N>>(
      queueName,
      async (job) => this.process(job),
      {
        connection: this.workerConnection!,
        concurrency: this.options.concurrency ?? 5,
        settings: {
          backoffStrategy: customBackoffDelay
        }
      }
    );

    this.worker.on("completed", (job) => {
      this.logger.info("event.consumed", {
        requestId: job.data.correlationId,
        eventId: job.data.id,
        event: job.data.name,
        status: "consumed",
        consumerName: this.options.consumerName,
        correlationId: job.data.correlationId
      });
    });

    this.worker.on("failed", async (job, error) => {
      if (!job) {
        this.logger.error("event.failed.unknown_job", {
          error: error.message
        });

        return;
      }

      this.logger.error("event.failed", {
        requestId: job.data.correlationId,
        eventId: job.data.id,
        event: job.data.name,
        status: "failed",
        consumerName: this.options.consumerName,
        attemptsMade: job.attemptsMade,
        error: error.message
      });

      const attempts = job.opts.attempts ?? 1;

      if (job.attemptsMade >= attempts) {
        await this.queueManager
          .getDlq(this.options.eventName, this.options.consumerName)
          .add(`${job.data.name}.dead`, {
            event: job.data,
            failedReason: error.message,
            failedAt: new Date().toISOString(),
            attemptsMade: job.attemptsMade
          });

        this.logger.error("event.dead_lettered", {
          requestId: job.data.correlationId,
          eventId: job.data.id,
          event: job.data.name,
          status: "dead_lettered",
          consumerName: this.options.consumerName,
          attemptsMade: job.attemptsMade,
          error: error.message
        });
      }
    });
  }

  async close(): Promise<void> {
    await this.worker?.close();
    if (this.workerConnection && this.workerConnection !== this.dependencies.connection) {
      try {
        if (this.workerConnection.status !== "end") {
          await this.workerConnection.quit();
        }
      } catch (e) {
        this.workerConnection.disconnect();
      }
    }
  }

  private async process(job: Job<EventEnvelope<N>>): Promise<void> {
    const envelope = eventEnvelopeSchema.parse(
      job.data
    ) as EventEnvelope<N>;

    const schema = eventSchemas[envelope.name];

    schema.parse(envelope.payload);

    const scopedKey = `${this.options.consumerName}-${envelope.idempotencyKey}`;

    if (await this.idempotencyStore.hasProcessed(scopedKey)) {
      this.logger.info("event.skipped_duplicate", {
        requestId: envelope.correlationId,
        eventId: envelope.id,
        event: envelope.name,
        status: "duplicate",
        consumerName: this.options.consumerName
      });

      return;
    }

    const acquired = await this.idempotencyStore.acquire(scopedKey);

    if (!acquired) {
      throw new Error(
        `Event is already being processed: ${envelope.id}`
      );
    }

    try {
      this.logger.info("event.consuming", {
        requestId: envelope.correlationId,
        eventId: envelope.id,
        event: envelope.name,
        status: "processing",
        consumerName: this.options.consumerName,
        correlationId: envelope.correlationId
      });

      await this.handler(envelope);

      await this.idempotencyStore.markProcessed(scopedKey);
    } catch (error) {
      await this.idempotencyStore.release(scopedKey);

      throw error;
    }
  }
}
