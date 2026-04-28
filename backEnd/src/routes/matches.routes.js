import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteMatch, getMatch, listMatches } from "../services/match.service.js";

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

matchesRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ matches: await listMatches(req.query) });
}));

matchesRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json({ match: await getMatch(req.params.id) });
}));

matchesRouter.delete("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json(await deleteMatch(req.params.id));
}));
