import type { NextFunction, Request, Response } from "express";
import type { Logger } from "../observability/logger";

export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();

    logger.info("http.request.started", {
      requestId: req.requestId,
      method: req.method,
      route: req.originalUrl,
      ip: req.ip,
      userId: req.userId,
      correlationId: req.correlationId ?? req.requestId,
      traceId: req.traceId
    });

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info("http.request.completed", {
        requestId: req.requestId,
        method: req.method,
        route: req.originalUrl,
        status: res.statusCode,
        latency: Math.round(durationMs),
        correlationId: req.correlationId ?? req.requestId,
        traceId: req.traceId
      });
    });

    next();
  };
}
