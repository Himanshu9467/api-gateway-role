import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { context, propagation, SpanStatusCode, trace } from "@opentelemetry/api";
import type { EventEnvelope, EventName } from "@ai-platform/events";

declare module "express-serve-static-core" {
  interface Request {
    traceId?: string;
    correlationId?: string;
  }
}

export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingTraceId = validIncomingTraceId(req.header("traceparent"));
  const activeTraceId = trace.getActiveSpan()?.spanContext().traceId;
  const incomingCorrelationId = req.header("x-correlation-id");
  req.traceId = activeTraceId ?? incomingTraceId ?? randomUUID();
  req.correlationId =
    incomingCorrelationId && incomingCorrelationId.length > 0 ? incomingCorrelationId : req.requestId;
  res.setHeader("x-correlation-id", req.correlationId);
  res.setHeader("x-trace-id", req.traceId);
  next();
}

export function withTraceMetadata(
  metadata: Record<string, unknown> = {}
): Record<string, unknown> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  const activeTraceId = trace.getActiveSpan()?.spanContext().traceId;

  return {
    ...metadata,
    ...(activeTraceId ? { traceId: activeTraceId } : {}),
    ...carrier
  };
}

export async function withEventTrace<N extends EventName, T>(
  serviceName: string,
  event: EventEnvelope<N>,
  handler: () => Promise<T>
): Promise<T> {
  const carrier = Object.fromEntries(
    Object.entries(event.metadata ?? {}).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    })
  );
  const parentContext = propagation.extract(context.active(), carrier);
  const tracer = trace.getTracer(serviceName);

  return context.with(parentContext, () =>
    tracer.startActiveSpan(`event ${event.name}`, async (span) => {
      span.setAttributes({
        "messaging.system": "redis",
        "messaging.operation": "process",
        "messaging.destination.name": event.name,
        "messaging.message.id": event.id,
        "service.name": serviceName,
        "app.correlation_id": event.correlationId
      });

      try {
        return await handler();
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "Worker processing failed"
        });
        throw error;
      } finally {
        span.end();
      }
    })
  );
}

function validIncomingTraceId(traceparent: string | undefined): string | undefined {
  const traceId = traceparent?.split("-")[1];
  return traceId && /^[a-f0-9]{32}$/i.test(traceId) ? traceId : undefined;
}
