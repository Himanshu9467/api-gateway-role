type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  service?: string;
  [key: string]: unknown;
}

export class Logger {
  constructor(private readonly service: string) {}

  info(message: string, context: LogContext = {}): void {
    this.write("info", message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.write("warn", message, context);
  }

  error(message: string, context: LogContext = {}): void {
    this.write("error", message, context);
  }

  private write(level: LogLevel, message: string, context: LogContext): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: context.service ?? this.service,
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
