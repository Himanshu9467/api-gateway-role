import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRoles } from "../middleware/auth";
import { addChatExchange, listChatMessages } from "../services/frontendMockData.service";

const chatRequestSchema = z.object({
  clientId: z.string().min(1),
  stepKey: z.string().min(1),
  message: z.string().min(1)
});

export function chatRoutes(): Router {
  const router = Router();

  router.use(authenticate, requireRoles(["admin", "user"]));

  router.get("/api/ai/chat/messages", async (req, res, next) => {
    try {
      const clientId = String(req.query.clientId ?? "");
      const stepKey = String(req.query.stepKey ?? "");
      res.json(await listChatMessages(clientId, stepKey));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/ai/chat", async (req, res, next) => {
    try {
      const body = chatRequestSchema.parse(req.body);
      const message = await addChatExchange(body.clientId, body.stepKey, body.message);

      res.json({
        message,
        suggestions: [
          "What should I upload next?",
          "Can you summarize missing documents?",
          "Why is this step blocked?"
        ]
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
