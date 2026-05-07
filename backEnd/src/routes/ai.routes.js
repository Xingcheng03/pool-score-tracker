import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AI_TASKS } from "../services/aiContext.service.js";
import { analyzeMatchup, analyzePlayer, recommendOpponent } from "../services/aiAnalysis.service.js";
import { generateLimitedAiReport, getAiReportStateForUser } from "../services/aiReport.service.js";

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.get("/reports", asyncHandler(async (req, res) => {
  res.json(await getAiReportStateForUser(req.user));
}));

aiRouter.post("/player-analysis", asyncHandler(async (req, res) => {
  res.json(await generateLimitedAiReport({
    user: req.user,
    reportType: AI_TASKS.PLAYER_ANALYSIS,
    input: req.body,
    generate: analyzePlayer,
  }));
}));

aiRouter.post("/matchup-analysis", asyncHandler(async (req, res) => {
  res.json(await generateLimitedAiReport({
    user: req.user,
    reportType: AI_TASKS.MATCHUP_ANALYSIS,
    input: req.body,
    generate: analyzeMatchup,
  }));
}));

aiRouter.post("/opponent-recommendation", asyncHandler(async (req, res) => {
  res.json(await generateLimitedAiReport({
    user: req.user,
    reportType: AI_TASKS.OPPONENT_RECOMMENDATION,
    input: req.body,
    generate: recommendOpponent,
  }));
}));
