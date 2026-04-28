import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getLeaderboard, getPlayerStats, getSeasons, getWinLosePoints } from "../services/stats.service.js";

export const leaderboardRouter = Router();

leaderboardRouter.use(requireAuth);

leaderboardRouter.get("/", asyncHandler(async (req, res) => {
  res.json(await getLeaderboard(req.query));
}));

leaderboardRouter.get("/win-lose", asyncHandler(async (req, res) => {
  res.json(await getWinLosePoints(req.query));
}));

leaderboardRouter.get("/seasons", asyncHandler(async (_req, res) => {
  res.json({ seasons: await getSeasons() });
}));

leaderboardRouter.get("/players/:playerId/stats", asyncHandler(async (req, res) => {
  res.json(await getPlayerStats(req.params.playerId, req.query));
}));
