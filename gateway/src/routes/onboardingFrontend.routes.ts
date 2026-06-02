import { Router } from "express";
import multer from "multer";
import type { EventBus } from "@ai-platform/events";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import { appMetrics } from "../observability/appMetrics";
import { withTraceMetadata } from "../observability/tracing";
import { writeAuditLog } from "../services/audit.service";
import {
  addDocument,
  getClient,
  getDocumentDownload,
  getOnboardingProgress,
  listDocuments,
  workflowStepOrder
} from "../services/frontendMockData.service";
import type { WorkflowStepKey } from "../services/frontendMockData.service";

const uploadSchema = z.object({
  stepKey: z.enum(workflowStepOrder as [WorkflowStepKey, ...WorkflowStepKey[]]).default("identity"),
  fileName: z.string().min(1).optional()
});
const downloadQuerySchema = z.object({
  expiresIn: z.coerce.number().int().min(60).max(3600).default(900)
});

const multipartUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg"
]);

export function onboardingFrontendRoutes(eventBus: EventBus): Router {
  const router = Router();

  router.use(authenticate, requireRoles(["admin", "user"]));

  router.get("/api/onboarding/:clientId/progress", async (req, res, next) => {
    try {
      const progress = await getOnboardingProgress(req.params.clientId);
      if (!progress) {
        res.status(404).json({
          error: "client_not_found",
          message: "Client was not found",
          requestId: req.requestId
        });
        return;
      }

      res.json(progress);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/onboarding/:clientId/documents", async (req, res, next) => {
    try {
      if (!(await getClient(req.params.clientId))) {
        res.status(404).json({
          error: "client_not_found",
          message: "Client was not found",
          requestId: req.requestId
        });
        return;
      }

      const parsedStep = z.enum(workflowStepOrder as [WorkflowStepKey, ...WorkflowStepKey[]]).safeParse(
        req.query.step
      );
      res.json(
        await listDocuments(req.params.clientId, parsedStep.success ? parsedStep.data : undefined)
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/onboarding/:clientId/documents/upload", multipartUpload.single("file"), async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      if (!(await getClient(clientId))) {
        res.status(404).json({
          error: "client_not_found",
          message: "Client was not found",
          requestId: req.requestId
        });
        return;
      }

      const body = uploadSchema.parse(req.body ?? {});
      const file = req.file;
      if (file && !allowedMimeTypes.has(file.mimetype)) {
        res.status(400).json({
          error: "unsupported_file_type",
          message: "Supported file types are PDF, DOCX, PNG, and JPG",
          requestId: req.requestId
        });
        return;
      }
      const document = await addDocument(
        clientId,
        body.stepKey,
        file?.originalname ?? body.fileName,
        file
          ? {
              buffer: file.buffer,
              mimeType: file.mimetype,
              size: file.size
            }
          : undefined
      );
      await writeAuditLog({
        action: "document.upload",
        actorId: req.user?.id,
        actorType: req.user?.authType === "api-key" ? "service" : "user",
        clientId: document.clientId,
        documentId: document.id,
        ipAddress: req.ip,
        userAgent: req.header("user-agent"),
        metadata: {
          stepKey: document.stepKey,
          fileName: document.fileName,
          fileSize: document.fileSize,
          mimeType: document.mimeType
        }
      });
      await eventBus.publish(
        "document.uploaded",
        {
          clientId: document.clientId,
          documentId: document.id,
          fileName: document.fileName,
          uploadedBy: req.user?.id ?? "api-gateway"
        },
        {
          correlationId: req.correlationId ?? req.requestId,
          idempotencyKey: `document-uploaded-${document.id}`,
          targets: ["crm-service", "onboarding-service"],
          metadata: withTraceMetadata({
            route: req.originalUrl,
            userId: req.user?.id,
            stepKey: document.stepKey,
            uploadedAt: document.uploadedAt,
            fileSize: document.fileSize,
            mimeType: document.mimeType
          })
        }
      );
      appMetrics.increment("gateway_events_published_total", {
        event: "document.uploaded",
        producer: "gateway"
      });
      res.status(201).json({ document });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/onboarding/:clientId/documents/:documentId/download-url", async (req, res, next) => {
    try {
      const clientId = String(req.params.clientId);
      const documentId = String(req.params.documentId);
      const query = downloadQuerySchema.parse(req.query);
      const download = await getDocumentDownload(clientId, documentId, query.expiresIn);
      if (!download) {
        res.status(404).json({
          error: "document_not_found",
          message: "Document was not found for this client",
          requestId: req.requestId
        });
        return;
      }
      await writeAuditLog({
        action: "document.download_url",
        actorId: req.user?.id,
        actorType: req.user?.authType === "api-key" ? "service" : "user",
        clientId,
        documentId,
        ipAddress: req.ip,
        userAgent: req.header("user-agent"),
        metadata: { expiresIn: query.expiresIn }
      });
      res.json({ url: download.url, expiresIn: query.expiresIn, document: download.document });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
