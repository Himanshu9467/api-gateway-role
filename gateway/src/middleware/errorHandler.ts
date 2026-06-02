import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import type { Logger } from "../observability/logger";

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "validation_error",
        message: "Invalid request payload",
        issues: error.issues,
        requestId: req.requestId
      });
      return;
    }

    logger.error("http.request.failed", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      error: error instanceof Error ? error.message : "Unknown error"
    });

    const statusCode = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
    res.status(statusCode).json({
      error: (error as any)?.code ?? "internal_server_error",
      message: statusCode === 500 ? "Unexpected gateway error" : error.message,
      requestId: req.requestId
    });
  };
}
