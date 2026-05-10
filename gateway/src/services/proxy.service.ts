import type { Express, Request, Response, NextFunction } from "express";
import type { ServerResponse } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { ServiceRegistryEntry } from "../config/services.config";
import { authenticate, requireRoles } from "../middleware/auth";
import type { Logger } from "../observability/logger";
import type { CircuitBreakerService } from "./circuitBreaker.service";
import type { ServiceRegistry } from "./serviceRegistry.service";

export function registerProxyRoutes(
  app: Express,
  routes: ServiceRegistryEntry[],
  circuitBreaker: CircuitBreakerService,
  serviceRegistry: ServiceRegistry,
  logger: Logger
): void {
  for (const route of routes) {
    app.use(route.routePrefix, authenticate, requireRoles(route.allowedRoles));

    app.use(route.routePrefix, (req: Request, res: Response, next: NextFunction) => {
      if (!circuitBreaker.canRequest(route.name)) {
        res.status(503).json({
          error: "circuit_open",
          message: `${route.name} is temporarily unavailable`,
          requestId: req.requestId
        });
        return;
      }
      next();
    });

    app.use(
      route.routePrefix,
      createProxyMiddleware({
        target: route.instances[0]?.url ?? "http://127.0.0.1",
        changeOrigin: true,
        xfwd: true,
        router: () => serviceRegistry.nextTarget(route.name) ?? route.instances[0]?.url,
        pathRewrite: {
          [`^${route.routePrefix}`]: ""
        },
        on: {
          proxyReq(proxyReq, req) {
            const expressReq = req as Request;
            proxyReq.setHeader("x-request-id", expressReq.requestId);
            if (expressReq.userId) {
              proxyReq.setHeader("x-user-id", expressReq.userId);
            }
          },
          proxyRes(proxyRes) {
            const statusCode = proxyRes.statusCode ?? 500;
            if (statusCode >= 500) {
              circuitBreaker.recordFailure(route.name);
              return;
            }
            circuitBreaker.recordSuccess(route.name);
          },
          error(error, req, res) {
            const expressReq = req as Request;
            const serverResponse = res as ServerResponse;
            circuitBreaker.recordFailure(route.name);
            logger.error("proxy.request.failed", {
              requestId: expressReq.requestId,
              service: route.name,
              error: error.message
            });

            if (!serverResponse.headersSent) {
              serverResponse.writeHead(502, { "content-type": "application/json" });
            }
            serverResponse.end(
              JSON.stringify({
                error: "bad_gateway",
                message: `${route.name} did not respond`,
                requestId: expressReq.requestId
              })
            );
          }
        }
      })
    );
  }
}
