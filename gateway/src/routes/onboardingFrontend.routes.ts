import { Router } from "express";
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

export function onboardingFrontendRoutes(): Router {
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

  router.post("/api/onboarding/:clientId/documents/upload", (req, res, next) => {
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
      res.status(201).json({ document });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
