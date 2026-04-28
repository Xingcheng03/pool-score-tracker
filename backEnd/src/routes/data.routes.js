import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { exportStoreJson, importStoreJson } from "../services/data.service.js";

export const dataRouter = Router();

dataRouter.use(requireAuth, requireRole("ADMIN"));

dataRouter.get("/export", asyncHandler(async (_req, res) => {
  res.json(await exportStoreJson());
}));

dataRouter.post("/import", asyncHandler(async (req, res) => {
  res.json(await importStoreJson(req.body, req.user.id));
}));
