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

export class RedisConnectionFactory {
  private static sharedConnection: Redis | null = null;
  private static connections: Redis[] = [];

  static getSharedConnection(options: RedisConnectionOptions): Redis {
    if (!this.sharedConnection) {
      this.sharedConnection = createRedisConnection(options);
      this.connections.push(this.sharedConnection);
    }
    return this.sharedConnection;
  }

  static createWorkerConnection(options: RedisConnectionOptions): Redis {
    const conn = createRedisConnection(options);
    this.connections.push(conn);
    return conn;
  }

  static async closeAll(): Promise<void> {
    await Promise.all(
      this.connections.map(async (conn) => {
        try {
          if (conn.status !== "end") {
            await conn.quit();
          }
        } catch (e) {
          conn.disconnect();
        }
      })
    );
    this.connections = [];
    this.sharedConnection = null;
  }
}

