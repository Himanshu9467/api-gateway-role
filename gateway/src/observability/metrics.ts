import type { NextFunction, Request, Response } from "express";

interface RouteMetric {
  count: number;
  totalDurationMs: number;
}

export class MetricsRegistry {
  private readonly httpRequests = new Map<string, RouteMetric>();
  private startedAt = Date.now();

  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const key = this.key(method, route, statusCode);
    const existing = this.httpRequests.get(key) ?? {
      count: 0,
      totalDurationMs: 0
    };

    existing.count += 1;
    existing.totalDurationMs += durationMs;
    this.httpRequests.set(key, existing);
  }

  renderPrometheus(): string {
    const lines = [
      "# HELP gateway_uptime_seconds Gateway process uptime in seconds.",
      "# TYPE gateway_uptime_seconds gauge",
      `gateway_uptime_seconds ${Math.round((Date.now() - this.startedAt) / 1000)}`,
      "# HELP gateway_http_requests_total Total HTTP requests handled by the gateway.",
      "# TYPE gateway_http_requests_total counter"
    ];

    for (const [key, metric] of this.httpRequests) {
      const labels = this.labels(key);
      lines.push(`gateway_http_requests_total${labels} ${metric.count}`);
    }

    lines.push(
      "# HELP gateway_http_request_duration_ms_sum Total HTTP request duration in milliseconds.",
      "# TYPE gateway_http_request_duration_ms_sum counter"
    );

    for (const [key, metric] of this.httpRequests) {
      const labels = this.labels(key);
      lines.push(`gateway_http_request_duration_ms_sum${labels} ${Math.round(metric.totalDurationMs)}`);
    }

    return `${lines.join("\n")}\n`;
  }

  private key(method: string, route: string, statusCode: number): string {
    return `${method.toUpperCase()} ${route} ${statusCode}`;
  }

  private labels(key: string): string {
    const [method, route, statusCode] = key.split(" ");
    return `{method="${method}",route="${route}",status="${statusCode}"}`;
  }
}

export function metricsMiddleware(metrics: MetricsRegistry) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      metrics.recordHttpRequest(req.method, req.route?.path?.toString() ?? req.path, res.statusCode, durationMs);
    });

    next();
  };
}
