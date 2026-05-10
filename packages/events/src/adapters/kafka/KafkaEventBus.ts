import type {
  EventBus,
  EventEnvelope,
  EventHandler,
  EventName,
  EventPayload,
  EventQueueStats,
  PublishOptions,
  Subscription
} from "../../types";

export interface KafkaEventBusOptions {
  serviceName: string;
}

export class KafkaEventBus implements EventBus {
  constructor(private readonly options: KafkaEventBusOptions) {}

  publish<N extends EventName>(
    _eventName: N,
    _payload: EventPayload<N>,
    _options?: PublishOptions
  ): Promise<EventEnvelope<N>> {
    throw new Error(
      `KafkaEventBus is selected for ${this.options.serviceName}, but no Kafka client is configured`
    );
  }

  subscribe<N extends EventName>(
    _eventName: N,
    _consumerName: string,
    _handler: EventHandler<N>
  ): Promise<Subscription> {
    throw new Error(
      `KafkaEventBus is selected for ${this.options.serviceName}, but no Kafka client is configured`
    );
  }

  async queueStats(): Promise<EventQueueStats[]> {
    return [];
  }

  async close(): Promise<void> {
    return undefined;
  }
}
