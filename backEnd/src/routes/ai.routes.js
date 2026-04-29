import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { analyzeMatchup, analyzePlayer, recommendOpponent } from "../services/aiAnalysis.service.js";

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.post("/player-analysis", asyncHandler(async (req, res) => {
  res.json(await analyzePlayer(req.body));
}));

aiRouter.post("/matchup-analysis", asyncHandler(async (req, res) => {
  res.json(await analyzeMatchup(req.body));
}));

aiRouter.post("/opponent-recommendation", asyncHandler(async (req, res) => {
  res.json(await recommendOpponent(req.body));
}));
