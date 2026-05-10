import { Router } from "express";
import type { AiOrchestrator } from "../orchestrator/commands/orchestrator";
import { authenticate, requireRoles } from "../middleware/auth";

export function orchestrationRoutes(orchestrator: AiOrchestrator): Router {
  const router = Router();

  router.post(
    "/api/ai/commands",
    authenticate,
    requireRoles(["admin", "user"]),
    async (req, res, next) => {
      try {
        const result = await orchestrator.run(
          {
            actorId: req.user?.id,
            ...req.body
          },
          req.requestId
        );
        res.status(202).json({
          requestId: req.requestId,
          ...result
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
