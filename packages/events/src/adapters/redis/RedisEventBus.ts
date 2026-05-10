import type { Redis } from "ioredis";
import { IdempotencyStore } from "../../idempotency/idempotencyStore";
import { JsonEventLogger } from "../../logging/jsonLogger";
import { EventPublisher } from "../../publisher/eventPublisher";
import { QueueManager } from "../../queue/queueManager";
import { EventSubscriber } from "../../subscriber/eventSubscriber";
import { SubscriptionRegistry } from "../../subscriber/subscriptionRegistry";
import type {
  EventBus,
  EventEnvelope,
  EventHandler,
  EventLogger,
  EventName,
  EventQueueStats,
  EventPayload,
  PublishOptions,
  Subscription
} from "../../types";

export interface RedisEventBusOptions {
  serviceName: string;
  connection: Redis;
  defaultSubscribers?: Partial<Record<EventName, string[]>>;
  logger?: EventLogger;
}

export class RedisEventBus implements EventBus {
  private readonly queueManager: QueueManager;
  private readonly registry: SubscriptionRegistry;
  private readonly idempotencyStore: IdempotencyStore;
  private readonly publisher: EventPublisher;
  private readonly logger: EventLogger;
  private readonly subscriptions: Subscription[] = [];

  constructor(private readonly options: RedisEventBusOptions) {
    this.logger = options.logger ?? new JsonEventLogger(options.serviceName);
    this.queueManager = new QueueManager(options.connection);
    this.registry = new SubscriptionRegistry(options.connection, options.defaultSubscribers);
    this.idempotencyStore = new IdempotencyStore(options.connection);
    this.publisher = new EventPublisher({
      serviceName: options.serviceName,
      connection: options.connection,
      queueManager: this.queueManager,
      registry: this.registry,
      logger: this.logger
    });
  }

  publish<N extends EventName>(
    eventName: N,
    payload: EventPayload<N>,
    options?: PublishOptions
  ): Promise<EventEnvelope<N>> {
    return this.publisher.publish(eventName, payload, options);
  }

  async subscribe<N extends EventName>(
    eventName: N,
    consumerName: string,
    handler: EventHandler<N>
  ): Promise<Subscription> {
    const subscriber = new EventSubscriber(
      {
        eventName,
        consumerName,
        concurrency: 5
      },
      handler,
      {
        serviceName: this.options.serviceName,
        connection: this.options.connection,
        queueManager: this.queueManager,
        registry: this.registry,
        idempotencyStore: this.idempotencyStore,
        logger: this.logger
      }
    );
    await subscriber.start();
    const subscription = {
      close: () => subscriber.close()
    };
    this.subscriptions.push(subscription);
    return subscription;
  }

  async queueStats(): Promise<EventQueueStats[]> {
    const events: EventName[] = [
      "client.created",
      "client.onboarded",
      "document.uploaded",
      "workflow.completed"
    ];
    const pairs = await Promise.all(
      events.map(async (eventName) => {
        const consumers = await this.registry.subscribersFor(eventName);
        return consumers.map((consumerName) => ({ eventName, consumerName }));
      })
    );

    return Promise.all(
      pairs.flat().map(({ eventName, consumerName }) =>
        this.queueManager.statsFor(eventName, consumerName)
      )
    );
  }

  async close(): Promise<void> {
    await Promise.all(this.subscriptions.map((subscription) => subscription.close()));
    await this.queueManager.close();
  }
}
