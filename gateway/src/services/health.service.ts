import { env } from "../config/env";
import type { CircuitBreakerService } from "./circuitBreaker.service";
import type { ServiceRegistry } from "./serviceRegistry.service";

export class HealthService {
  constructor(
    private readonly serviceRegistry: ServiceRegistry,
    private readonly circuitBreaker: CircuitBreakerService
  ) {}

  gatewayHealth() {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: env.SERVICE_NAME,
      uptimeSeconds: Math.round(process.uptime()),
      circuits: this.circuitBreaker.snapshot()
    };
  }

  servicesHealth() {
    return this.serviceRegistry.snapshot();
  }
}
