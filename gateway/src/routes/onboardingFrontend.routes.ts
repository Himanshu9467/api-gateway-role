import { Router } from "express";
import type { EventBus } from "@ai-platform/events";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import {
  addDocument,
  getClient,
  getOnboardingProgress,
  listDocuments,
  workflowStepOrder
} from "../services/frontendMockData.service";
import type { WorkflowStepKey } from "../services/frontendMockData.service";

const uploadSchema = z.object({
  stepKey: z.enum(workflowStepOrder as [WorkflowStepKey, ...WorkflowStepKey[]]).default("identity"),
  fileName: z.string().min(1).optional()
});

export function onboardingFrontendRoutes(eventBus: EventBus): Router {
  const router = Router();

  router.use(authenticate, requireRoles(["admin", "user"]));

  router.get("/api/onboarding/:clientId/progress", (req, res) => {
    const progress = getOnboardingProgress(req.params.clientId);
    if (!progress) {
      res.status(404).json({
        error: "client_not_found",
        message: "Client was not found",
        requestId: req.requestId
      });
      return;
    }

    res.json(progress);
  });

  router.get("/api/onboarding/:clientId/documents", (req, res) => {
    if (!getClient(req.params.clientId)) {
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
    res.json(listDocuments(req.params.clientId, parsedStep.success ? parsedStep.data : undefined));
  });

  router.post("/api/onboarding/:clientId/documents/upload", async (req, res, next) => {
    try {
      if (!getClient(req.params.clientId)) {
        res.status(404).json({
          error: "client_not_found",
          message: "Client was not found",
          requestId: req.requestId
        });
        return;
      }

      const body = uploadSchema.parse(req.body ?? {});
      const document = addDocument(req.params.clientId, body.stepKey, body.fileName);
      await eventBus.publish(
        "document.uploaded",
        {
          clientId: document.clientId,
          documentId: document.id,
          fileName: document.fileName,
          uploadedBy: req.user?.id ?? "api-gateway"
        },
        {
          correlationId: req.requestId,
          idempotencyKey: `document-uploaded-${document.id}`,
          targets: ["crm-service", "onboarding-service"],
          metadata: {
            route: req.originalUrl,
            userId: req.user?.id,
            stepKey: document.stepKey,
            uploadedAt: document.uploadedAt,
            fileSize: document.fileSize,
            mimeType: document.mimeType
          }
        }
      );
      res.status(201).json({ document });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
