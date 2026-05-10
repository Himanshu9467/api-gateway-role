import { env } from "../config/env";

export type CircuitState = "closed" | "open" | "half-open";

export interface Circuit {
  failures: number;
  state: CircuitState;
  openedAt?: number;
}

export class CircuitBreakerService {
  private readonly circuits = new Map<string, Circuit>();

  canRequest(serviceName: string): boolean {
    const circuit = this.getCircuit(serviceName);
    if (circuit.state === "closed") {
      return true;
    }

    if (
      circuit.state === "open" &&
      circuit.openedAt &&
      Date.now() - circuit.openedAt >= env.CIRCUIT_RESET_TIMEOUT_MS
    ) {
      circuit.state = "half-open";
      return true;
    }

    return circuit.state === "half-open";
  }

  recordSuccess(serviceName: string): void {
    this.circuits.set(serviceName, {
      failures: 0,
      state: "closed"
    });
  }

  recordFailure(serviceName: string): void {
    const circuit = this.getCircuit(serviceName);
    circuit.failures += 1;
    if (circuit.failures >= env.CIRCUIT_FAILURE_THRESHOLD) {
      circuit.state = "open";
      circuit.openedAt = Date.now();
    }
    this.circuits.set(serviceName, circuit);
  }

  snapshot(): Record<string, Circuit> {
    return Object.fromEntries(this.circuits.entries());
  }

  private getCircuit(serviceName: string): Circuit {
    return (
      this.circuits.get(serviceName) ?? {
        failures: 0,
        state: "closed"
      }
    );
  }
}
