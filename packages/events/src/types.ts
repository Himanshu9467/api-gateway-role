import type { JobsOptions } from "bullmq";
import type { z } from "zod";
import { eventSchemas, eventNameSchema } from "./schemas/events";

export type EventName = z.infer<typeof eventNameSchema>;
export type EventPayloadMap = {
  [K in keyof typeof eventSchemas]: z.infer<(typeof eventSchemas)[K]>;
};

export type EventPayload<N extends EventName> = EventPayloadMap[N];

export interface EventEnvelope<N extends EventName = EventName> {
  id: string;
  name: N;
  version: number;
  occurredAt: string;
  producer: string;
  correlationId: string;
  idempotencyKey: string;
  payload: EventPayload<N>;
  metadata?: Record<string, unknown>;
}

export interface PublishOptions {
  correlationId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  targets?: string[];
  jobOptions?: JobsOptions;
}

export interface SubscriberOptions<N extends EventName = EventName> {
  eventName: N;
  consumerName: string;
  concurrency?: number;
}

export type EventHandler<N extends EventName> = (
  event: EventEnvelope<N>
) => Promise<void>;

export interface EventLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface Subscription {
  close(): Promise<void>;
}

export interface EventQueueStats {
  queueName: string;
  dlqName: string;
  eventName: EventName;
  consumerName: string;
  counts: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    paused: number;
  };
  dlqCounts: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    paused: number;
  };
}

export interface EventBus {
  publish<N extends EventName>(
    eventName: N,
    payload: EventPayload<N>,
    options?: PublishOptions
  ): Promise<EventEnvelope<N>>;

  subscribe<N extends EventName>(
    eventName: N,
    consumerName: string,
    handler: EventHandler<N>
  ): Promise<Subscription>;

  queueStats?(): Promise<EventQueueStats[]>;

  close(): Promise<void>;
}
