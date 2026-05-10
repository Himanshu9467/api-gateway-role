import type { Redis } from "ioredis";

export class IdempotencyStore {
  constructor(
    private readonly connection: Redis,
    private readonly ttlSeconds = 7 * 24 * 60 * 60
  ) {}

  async acquire(key: string): Promise<boolean> {
    const result = await this.connection.set(
      this.processingKey(key),
      "1",
      "EX",
      this.ttlSeconds,
      "NX"
    );
    return result === "OK";
  }

  async markProcessed(key: string): Promise<void> {
    await this.connection
      .multi()
      .set(this.processedKey(key), "1", "EX", this.ttlSeconds)
      .del(this.processingKey(key))
      .exec();
  }

  async release(key: string): Promise<void> {
    await this.connection.del(this.processingKey(key));
  }

  async hasProcessed(key: string): Promise<boolean> {
    return (await this.connection.exists(this.processedKey(key))) === 1;
  }

  private processingKey(key: string): string {
    return `events:idempotency:processing:${key}`;
  }

  private processedKey(key: string): string {
    return `events:idempotency:processed:${key}`;
  }
}
