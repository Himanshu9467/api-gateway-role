import { Router } from "express";
import { openApiDocument } from "../docs/openapi";

export function docsRoutes(): Router {
  const router = Router();

  router.get("/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });

  return router;
}
