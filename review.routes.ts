import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import { prisma } from "../services/database.service";
import {
  approveReview,
  assignReviewer,
  commentOnReview,
  escalateReview,
  listReviewQueue,
  rejectReview
} from "../services/reviewQueue.service";
import {
  sendEscalationEmails,
  sendPendingDocumentAlerts,
  sendReminderEmails
} from "../services/chaserEmail.service";
import { processUploadedDocument } from "../services/document.processor";

const listQuerySchema = z.object({
  status: z.enum(["pending", "assigned", "approved", "rejected", "escalated"]).optional(),
  assignedTo: z.string().min(1).optional(),
  clientId: z.string().min(1).optional()
});

const assignSchema = z.object({
  reviewerId: z.string().min(1),
  comment: z.string().optional()
});

const commentSchema = z.object({
  comment: z.string().min(1)
});

const optionalCommentSchema = z.object({
  comment: z.string().optional()
});

export function reviewRoutes(): Router {
  const router = Router();

  router.use(authenticate, requireRoles(["admin", "user", "service"]));

  router.get("/api/review-queue", async (req, res, next) => {
    try {
      const query = listQuerySchema.parse(req.query);
      res.json({ items: await listReviewQueue(query) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/review-queue/:id/assign", async (req, res, next) => {
    try {
      const body = assignSchema.parse(req.body ?? {});
      const item = await assignReviewer({
        reviewQueueId: req.params.id,
        reviewerId: body.reviewerId,
        actorId: req.user?.id ?? "api-gateway",
        comment: body.comment
      });
      res.json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/review-queue/:id/approve", async (req, res, next) => {
    try {
      const body = optionalCommentSchema.parse(req.body ?? {});
      const item = await approveReview({
        reviewQueueId: req.params.id,
        actorId: req.user?.id ?? "api-gateway",
        comment: body.comment
      });
      res.json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/review-queue/:id/reject", async (req, res, next) => {
    try {
      const body = commentSchema.parse(req.body ?? {});
      const item = await rejectReview({
        reviewQueueId: req.params.id,
        actorId: req.user?.id ?? "api-gateway",
        comment: body.comment
      });
      res.json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/review-queue/:id/comment", async (req, res, next) => {
    try {
      const body = commentSchema.parse(req.body ?? {});
      const item = await commentOnReview({
        reviewQueueId: req.params.id,
        actorId: req.user?.id ?? "api-gateway",
        comment: body.comment
      });
      res.json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/review-queue/:id/escalate", async (req, res, next) => {
    try {
      const body = optionalCommentSchema.parse(req.body ?? {});
      const item = await escalateReview({
        reviewQueueId: req.params.id,
        actorId: req.user?.id ?? "api-gateway",
        comment: body.comment
      });
      res.json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/documents/:documentId/ocr", async (req, res, next) => {
    try {
      const result = await prisma.ocrResult.findUnique({
        where: { documentId: req.params.documentId },
        include: { extractedFields: true, validations: true, reviewQueue: true }
      });
      if (!result) {
        res.status(404).json({ error: "ocr_result_not_found", message: "OCR result was not found", requestId: req.requestId });
        return;
      }
      res.json({ result });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/documents/:documentId/process", async (req, res, next) => {
    try {
      const result = await processUploadedDocument({
        documentId: req.params.documentId,
        actorId: req.user?.id
      });
      res.json({ result });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/notifications/chaser/reminders", async (_req, res, next) => {
    try {
      res.json(await sendReminderEmails());
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/notifications/chaser/pending-documents", async (_req, res, next) => {
    try {
      res.json(await sendPendingDocumentAlerts());
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/notifications/chaser/escalations", async (_req, res, next) => {
    try {
      res.json(await sendEscalationEmails());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
