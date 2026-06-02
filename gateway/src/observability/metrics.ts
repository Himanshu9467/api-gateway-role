import type { NextFunction, Request, Response } from "express";
import { appMetrics } from "./appMetrics";

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

    lines.push(
      "# HELP gateway_http_errors_total Total HTTP responses with status code >= 400.",
      "# TYPE gateway_http_errors_total counter",
      "# HELP gateway_auth_failures_total Total authentication and authorization failures.",
      "# TYPE gateway_auth_failures_total counter",
      "# HELP gateway_events_published_total Total events published by the gateway.",
      "# TYPE gateway_events_published_total counter",
      "# HELP gateway_events_consumed_total Total events consumed by workers in this process.",
      "# TYPE gateway_events_consumed_total counter",
      "# HELP gateway_db_queries_total Total Prisma queries observed by the gateway process.",
      "# TYPE gateway_db_queries_total counter",
      "# HELP gateway_worker_jobs_total Total worker jobs processed by workers in this process.",
      "# TYPE gateway_worker_jobs_total counter"
    );

    const additionalCounters = appMetrics.renderCounters();
    if (additionalCounters) {
      lines.push(additionalCounters);
    }

    return `${lines.join("\n")}\n`;
  }

  snapshot(): { requests: number; errors: number; averageLatencyMs: number } {
    let requests = 0;
    let errors = 0;
    let duration = 0;
    for (const [key, metric] of this.httpRequests) {
      const statusCode = Number(key.split(" ")[2]);
      requests += metric.count;
      duration += metric.totalDurationMs;
      if (statusCode >= 500) errors += metric.count;
    }
    return {
      requests,
      errors,
      averageLatencyMs: requests > 0 ? duration / requests : 0
    };
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
      if (res.statusCode >= 400) {
        appMetrics.increment("gateway_http_errors_total", {
          method: req.method,
          route: req.route?.path?.toString() ?? req.path,
          status: res.statusCode
        });
      }
    });

    next();
  };
}
