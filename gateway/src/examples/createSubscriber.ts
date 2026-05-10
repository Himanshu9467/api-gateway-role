import {
  JsonEventLogger,
  createEventBus,
  createRedisConnection,
  type EventEnvelope,
  type EventHandler,
  type EventName
} from "@ai-platform/events";
import { env } from "../config/env";

interface ExampleSubscription<N extends EventName> {
  eventName: N;
  handler: EventHandler<N>;
}

type AnyExampleSubscription = {
  [N in EventName]: ExampleSubscription<N>;
}[EventName];

export async function startExampleSubscriber<N extends EventName>(
  serviceName: string,
  eventName: N,
  handler: EventHandler<N>
): Promise<void> {
  await startExampleSubscribers(serviceName, [{ eventName, handler } as AnyExampleSubscription]);
}

export async function startExampleSubscribers(
  serviceName: string,
  subscriptions: AnyExampleSubscription[]
): Promise<void> {
  const redis = createRedisConnection({ url: env.REDIS_URL });
  const logger = new JsonEventLogger(serviceName);
  redis.on("error", (error) => {
    logger.error("redis.connection.error", {
      error: error.message || error.name || "Redis connection failed"
    });
  });
  const eventBus = createEventBus({
    driver: "redis",
    serviceName,
    redisConnection: redis,
    logger
  });
  await Promise.all(
    subscriptions.map((subscription) =>
      eventBus.subscribe(
        subscription.eventName,
        serviceName,
        subscription.handler as (event: EventEnvelope<EventName>) => Promise<void>
      )
    )
  );
  logger.info("example.consumer.started", {
    events: subscriptions.map((subscription) => subscription.eventName),
    consumerName: serviceName
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.warn("example.consumer.shutdown", { signal, serviceName });
    await eventBus.close();
    redis.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
