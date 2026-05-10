import type { Redis } from "ioredis";
import type { EventName } from "../types";

export class SubscriptionRegistry {
  constructor(
    private readonly connection: Redis,
    private readonly defaults: Partial<Record<EventName, string[]>> = {}
  ) {}

  async register(eventName: EventName, consumerName: string): Promise<void> {
    await this.connection.sadd(this.key(eventName), consumerName);
  }

  async subscribersFor(eventName: EventName): Promise<string[]> {
    const dynamicSubscribers = await this.connection.smembers(this.key(eventName));
    const configuredSubscribers = this.defaults[eventName] ?? [];
    return Array.from(new Set([...configuredSubscribers, ...dynamicSubscribers])).sort();
  }

  private key(eventName: EventName): string {
    return `events:subscriptions:${eventName}`;
  }
}
