import IORedis, { Redis, RedisOptions } from "ioredis";

export interface RedisConnectionOptions {
  url: string;
  keyPrefix?: string;
}

export function createRedisConnection(options: RedisConnectionOptions): Redis {
  const redisOptions: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    }
  };

  if (options.keyPrefix) {
    redisOptions.keyPrefix = options.keyPrefix;
  }

  const connection = new IORedis(options.url, redisOptions);
  connection.on("error", () => {
    // Consumers may attach their own logger; this default listener prevents raw unhandled errors.
  });
  return connection;
}
