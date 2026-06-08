import { Queue, QueueEvents } from "bullmq";
import type { Redis } from "ioredis";
import type { EventName, EventQueueStats } from "../types";

const QUEUE_PREFIX = "events";
const DLQ_SUFFIX = "dlq";

/**
 * Custom retry delays matching the specified policy:
 * Attempt 1 → immediate (0ms)
 * Attempt 2 → 5 000ms
 * Attempt 3 → 15 000ms
 * Attempt 4 → 30 000ms
 * Attempt 5 → DLQ (handled by EventSubscriber)
 */
const RETRY_DELAYS_MS = [0, 5_000, 15_000, 30_000];

export function customBackoffDelay(attemptsMade: number): number {
  const index = Math.min(attemptsMade - 1, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index] ?? 30_000;
}

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

  async getFailedJobs(
    eventName: EventName,
    consumerName: string,
    start = 0,
    end = 50
  ): Promise<Array<{ jobId: string; data: unknown; failedReason?: string; attemptsMade: number }>> {
    const dlq = this.getDlq(eventName, consumerName);
    const jobs = await dlq.getJobs(["waiting", "failed"], start, end);
    return jobs.map((job) => ({
      jobId: job.id ?? "unknown",
      data: job.data,
      failedReason: (job.data as Record<string, unknown>)?.failedReason as string | undefined,
      attemptsMade: (job.data as Record<string, unknown>)?.attemptsMade as number ?? 0
    }));
  }

  async replayJob(
    eventName: EventName,
    consumerName: string,
    jobId: string
  ): Promise<{ replayed: boolean; newJobId?: string }> {
    const dlq = this.getDlq(eventName, consumerName);
    const job = await dlq.getJob(jobId);
    if (!job) {
      return { replayed: false };
    }

    const eventData = (job.data as Record<string, unknown>)?.event ?? job.data;
    const queue = this.getQueue(eventName, consumerName);
    const newJob = await queue.add(`${eventName}.replay`, eventData, {
      jobId: `replay-${jobId}-${Date.now()}`
    });

    await job.remove();

    return { replayed: true, newJobId: newJob.id };
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
          type: "custom"
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

