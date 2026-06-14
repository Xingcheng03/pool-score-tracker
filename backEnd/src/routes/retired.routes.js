import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listRetiredPlayers } from "../services/retired.service.js";

export const retiredRouter = Router();

retiredRouter.use(requireAuth);

retiredRouter.get("/", asyncHandler(async (_req, res) => {
  res.json(await listRetiredPlayers());
}));
