import type { EventLogger } from "../types";

type Level = "info" | "warn" | "error";

export class JsonEventLogger implements EventLogger {
  constructor(private readonly service: string) {}

  info(message: string, context: Record<string, unknown> = {}): void {
    this.write("info", message, context);
  }

  warn(message: string, context: Record<string, unknown> = {}): void {
    this.write("warn", message, context);
  }

  error(message: string, context: Record<string, unknown> = {}): void {
    this.write("error", message, context);
  }

  private write(level: Level, message: string, context: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...context
    };

    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }
}
