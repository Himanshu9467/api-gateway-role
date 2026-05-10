import type { ServiceRegistryEntry, ServiceName } from "../config/services.config";
import { env } from "../config/env";
import type { Logger } from "../observability/logger";

export interface RuntimeInstance {
  url: string;
  health: string;
  status: "UP" | "DOWN";
  lastCheckedAt?: string;
  latency?: number;
  error?: string;
}

export interface RuntimeService {
  config: ServiceRegistryEntry;
  instances: RuntimeInstance[];
  cursor: number;
}

export class ServiceRegistry {
  private readonly services: Map<ServiceName, RuntimeService>;
  private poller?: NodeJS.Timeout;

  constructor(
    entries: ServiceRegistryEntry[],
    private readonly logger: Logger
  ) {
    this.services = new Map(
      entries.map((entry) => [
        entry.name,
        {
          config: entry,
          instances: entry.instances.map((instance) => ({
            ...instance,
            status: "UP"
          })),
          cursor: 0
        }
      ])
    );
  }

  startPolling(intervalMs = 10_000): void {
    void this.poll();
    this.poller = setInterval(() => void this.poll(), intervalMs);
    this.poller.unref();
  }

  stopPolling(): void {
    if (this.poller) {
      clearInterval(this.poller);
    }
  }

  nextTarget(serviceName: ServiceName): string | undefined {
    const service = this.services.get(serviceName);
    if (!service) {
      return undefined;
    }

    const healthy = service.instances.filter((instance) => instance.status === "UP");
    const candidates = healthy.length > 0 ? healthy : service.instances;
    if (candidates.length === 0) {
      return undefined;
    }

    const selected = candidates[service.cursor % candidates.length];
    service.cursor = (service.cursor + 1) % candidates.length;
    return selected.url;
  }

  markDown(serviceName: ServiceName, target: string, error: string): void {
    const instance = this.findInstance(serviceName, target);
    if (!instance) {
      return;
    }
    instance.status = "DOWN";
    instance.error = error;
    instance.lastCheckedAt = new Date().toISOString();
  }

  markUp(serviceName: ServiceName, target: string): void {
    const instance = this.findInstance(serviceName, target);
    if (!instance) {
      return;
    }
    instance.status = "UP";
    instance.error = undefined;
  }

  snapshot() {
    return Array.from(this.services.values()).map((service) => ({
      name: service.config.publicName,
      routePrefix: service.config.routePrefix,
      allowedRoles: service.config.allowedRoles,
      instances: service.instances
    }));
  }

  private async poll(): Promise<void> {
    await Promise.all(
      Array.from(this.services.values()).flatMap((service) =>
        service.instances.map((instance) => this.checkInstance(service.config.name, instance))
      )
    );
  }

  private async checkInstance(serviceName: ServiceName, instance: RuntimeInstance): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.HEALTH_CHECK_TIMEOUT_MS);
    const startedAt = process.hrtime.bigint();

    try {
      const response = await fetch(new URL(instance.health, instance.url), {
        signal: controller.signal
      });
      instance.latency = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
      instance.lastCheckedAt = new Date().toISOString();
      instance.status = response.ok ? "UP" : "DOWN";
      instance.error = response.ok ? undefined : `HTTP ${response.status}`;
    } catch (error) {
      instance.status = "DOWN";
      instance.lastCheckedAt = new Date().toISOString();
      instance.error = error instanceof Error ? error.message : "Health check failed";
      this.logger.warn("service.discovery.instance_down", {
        serviceName,
        target: instance.url,
        error: instance.error
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private findInstance(serviceName: ServiceName, target: string): RuntimeInstance | undefined {
    return this.services.get(serviceName)?.instances.find((instance) => instance.url === target);
  }
}
