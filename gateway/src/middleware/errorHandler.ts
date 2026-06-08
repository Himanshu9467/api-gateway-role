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

    if ((error as any)?.code === "P2002") {
      const target = (error as any)?.meta?.target;
      const targetStr = Array.isArray(target) ? target.join(", ") : String(target ?? "");
      const modelName = (error as any)?.meta?.modelName;
      const errMessage = error instanceof Error ? error.message : String(error ?? "");
      const isEmail = 
        targetStr.toLowerCase().includes("email") || 
        modelName === "User" || 
        errMessage.toLowerCase().includes("email");

      res.status(409).json({
        error: "conflict_error",
        message: isEmail ? "Email is already registered" : "Unique constraint violation",
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
