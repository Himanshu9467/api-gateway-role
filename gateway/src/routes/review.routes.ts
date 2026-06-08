import { Router } from "express";
import type { EventBus } from "@ai-platform/events";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import { appMetrics } from "../observability/appMetrics";
import { withTraceMetadata } from "../observability/tracing";
import type { Logger } from "../observability/logger";
import { assignReview, approveReview, rejectReview } from "../services/review.service";

const assignRequestSchema = z.object({
  reviewId: z.string().min(8),
  reviewerId: z.string().min(8),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const approveRequestSchema = z.object({
  reviewId: z.string().min(8),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const rejectRequestSchema = z.object({
  reviewId: z.string().min(8),
  reason: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export function reviewRoutes(eventBus: EventBus, logger: Logger): Router {
  const router = Router();

  router.post(
    "/api/review/assign",
    authenticate,
    requireRoles(["admin", "service"]),
    async (req, res, next) => {
      try {
        const body = assignRequestSchema.parse(req.body);
        const result = await assignReview(body.reviewId, body.reviewerId);

        const event = await eventBus.publish(
          "review.assigned",
          { reviewId: result.reviewId, reviewerId: result.reviewerId! },
          {
            correlationId: req.correlationId ?? req.requestId,
            idempotencyKey: `review-assign-${body.reviewId}`,
            metadata: withTraceMetadata({
              route: req.originalUrl,
              userId: req.user?.id,
              ...body.metadata
            })
          }
        );

        logger.info("event.route.review_assigned.accepted", {
          requestId: req.requestId,
          route: req.originalUrl,
          event: event.name,
          eventId: event.id,
          status: "queued",
          correlationId: event.correlationId,
          reviewId: body.reviewId
        });
        appMetrics.increment("gateway_events_published_total", {
          event: event.name,
          producer: "gateway"
        });

        res.status(202).json({
          requestId: req.requestId,
          status: "accepted",
          eventId: event.id,
          event: event.name,
          correlationId: event.correlationId,
          review: result
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/api/review/approve",
    authenticate,
    requireRoles(["admin", "service"]),
    async (req, res, next) => {
      try {
        const body = approveRequestSchema.parse(req.body);
        const result = await approveReview(body.reviewId);

        const event = await eventBus.publish(
          "review.approved",
          { reviewId: result.reviewId },
          {
            correlationId: req.correlationId ?? req.requestId,
            idempotencyKey: `review-approve-${body.reviewId}`,
            targets: ["face-verification-service"],
            metadata: withTraceMetadata({
              route: req.originalUrl,
              userId: req.user?.id,
              ...body.metadata
            })
          }
        );

        logger.info("event.route.review_approved.accepted", {
          requestId: req.requestId,
          route: req.originalUrl,
          event: event.name,
          eventId: event.id,
          status: "queued",
          correlationId: event.correlationId,
          reviewId: body.reviewId
        });
        appMetrics.increment("gateway_events_published_total", {
          event: event.name,
          producer: "gateway"
        });

        res.status(202).json({
          requestId: req.requestId,
          status: "accepted",
          eventId: event.id,
          event: event.name,
          correlationId: event.correlationId,
          review: result
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/api/review/reject",
    authenticate,
    requireRoles(["admin", "service"]),
    async (req, res, next) => {
      try {
        const body = rejectRequestSchema.parse(req.body);
        const result = await rejectReview(body.reviewId, body.reason);

        const event = await eventBus.publish(
          "review.rejected",
          { reviewId: result.reviewId, reason: result.reason! },
          {
            correlationId: req.correlationId ?? req.requestId,
            idempotencyKey: `review-reject-${body.reviewId}`,
            metadata: withTraceMetadata({
              route: req.originalUrl,
              userId: req.user?.id,
              ...body.metadata
            })
          }
        );

        logger.info("event.route.review_rejected.accepted", {
          requestId: req.requestId,
          route: req.originalUrl,
          event: event.name,
          eventId: event.id,
          status: "queued",
          correlationId: event.correlationId,
          reviewId: body.reviewId
        });
        appMetrics.increment("gateway_events_published_total", {
          event: event.name,
          producer: "gateway"
        });

        res.status(202).json({
          requestId: req.requestId,
          status: "accepted",
          eventId: event.id,
          event: event.name,
          correlationId: event.correlationId,
          review: result
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
