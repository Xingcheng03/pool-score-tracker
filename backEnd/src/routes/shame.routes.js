import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createShameRecord,
  deleteShameRecord,
  listShameRecords,
  updateShameRecord,
} from "../services/shame.service.js";

export const shameRouter = Router();

shameRouter.use(requireAuth);

shameRouter.get("/", asyncHandler(async (_req, res) => {
  res.json(await listShameRecords());
}));

shameRouter.post("/", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.status(201).json({ record: await createShameRecord(req.body, req.user.id) });
}));

shameRouter.patch("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json({ record: await updateShameRecord(req.params.id, req.body) });
}));

shameRouter.delete("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json(await deleteShameRecord(req.params.id));
}));
