import type { Redis } from "ioredis";
import { JsonEventLogger } from "../logging/jsonLogger";
import type { EventBus, EventLogger, EventName } from "../types";
import { KafkaEventBus } from "./kafka/KafkaEventBus";
import { RedisEventBus } from "./redis/RedisEventBus";

export interface CreateEventBusOptions {
  driver: "redis" | "kafka";
  serviceName: string;
  redisConnection?: Redis;
  defaultSubscribers?: Partial<Record<EventName, string[]>>;
  logger?: EventLogger;
  concurrency?: number;
}

export function createEventBus(options: CreateEventBusOptions): EventBus {
  if (options.driver === "kafka") {
    return new KafkaEventBus({ serviceName: options.serviceName });
  }

  if (!options.redisConnection) {
    throw new Error("RedisEventBus requires a Redis connection");
  }

  return new RedisEventBus({
    serviceName: options.serviceName,
    connection: options.redisConnection,
    defaultSubscribers: options.defaultSubscribers,
    logger: options.logger ?? new JsonEventLogger(options.serviceName),
    concurrency: options.concurrency
  });
}
