import { Queue, QueueEvents } from "bullmq";
import type { Redis } from "ioredis";
import type { EventName, EventQueueStats } from "../types";

const QUEUE_PREFIX = "events";
const DLQ_SUFFIX = "dlq";

export class QueueManager {
  private readonly queues = new Map<string, Queue>();
  private readonly queueEvents = new Map<string, QueueEvents>();

  constructor(private readonly connection: Redis) {}

  queueName(eventName: EventName, consumerName: string): string {
    const name = `${QUEUE_PREFIX}-${eventName}-${consumerName}`
      .replace(/:/g, "-")
      .replace(/\./g, "-");

    return name;
  }

  dlqName(eventName: EventName, consumerName: string): string {
    return `${this.queueName(eventName, consumerName)}-${DLQ_SUFFIX}`
      .replace(/:/g, "-")
      .replace(/\./g, "-");
  }

  getQueue(eventName: EventName, consumerName: string): Queue {
    return this.getQueueByName(this.queueName(eventName, consumerName));
  }

  getDlq(eventName: EventName, consumerName: string): Queue {
    return this.getQueueByName(this.dlqName(eventName, consumerName));
  }

  getQueueEvents(eventName: EventName, consumerName: string): QueueEvents {
    const name = this.queueName(eventName, consumerName);
    const existing = this.queueEvents.get(name);
    if (existing) {
      return existing;
    }

    const events = new QueueEvents(name, { connection: this.connection });
    this.queueEvents.set(name, events);
    return events;
  }

  async statsFor(eventName: EventName, consumerName: string): Promise<EventQueueStats> {
    const queue = this.getQueue(eventName, consumerName);
    const dlq = this.getDlq(eventName, consumerName);
    const [counts, dlqCounts] = await Promise.all([
      queue.getJobCounts("waiting", "active", "delayed", "completed", "failed", "paused"),
      dlq.getJobCounts("waiting", "active", "delayed", "completed", "failed", "paused")
    ]);

    return {
      queueName: this.queueName(eventName, consumerName),
      dlqName: this.dlqName(eventName, consumerName),
      eventName,
      consumerName,
      counts: this.normalizeCounts(counts),
      dlqCounts: this.normalizeCounts(dlqCounts)
    };
  }

  async close(): Promise<void> {
    await Promise.all([
      ...Array.from(this.queueEvents.values()).map((events) => events.close()),
      ...Array.from(this.queues.values()).map((queue) => queue.close())
    ]);
  }

  private getQueueByName(name: string): Queue {
    const existing = this.queues.get(name);
    if (existing) {
      return existing;
    }

    const queue = new Queue(name, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000
        },
        removeOnComplete: {
          age: 24 * 60 * 60,
          count: 10000
        },
        removeOnFail: false
      }
    });
    this.queues.set(name, queue);
    return queue;
  }

  private normalizeCounts(counts: Record<string, number>): EventQueueStats["counts"] {
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      paused: counts.paused ?? 0
    };
  }
}
