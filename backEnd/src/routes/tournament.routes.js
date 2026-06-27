import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createTournament,
  deleteTournament,
  drawBracket,
  getTournament,
  listTournaments,
  setMatchScore,
  setParticipants,
  updateMatchTeams,
  updateTournament,
} from "../services/tournament.service.js";

export const tournamentRouter = Router();

tournamentRouter.use(requireAuth);

// 所有登录用户可看赛事列表与对阵图。
tournamentRouter.get("/", asyncHandler(async (_req, res) => {
  res.json({ tournaments: await listTournaments() });
}));

tournamentRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json({ tournament: await getTournament(req.params.id) });
}));

// 以下均为管理员操作。
tournamentRouter.post("/", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.status(201).json({ tournament: await createTournament(req.body, req.user) });
}));

tournamentRouter.patch("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json({ tournament: await updateTournament(req.params.id, req.body) });
}));

tournamentRouter.delete("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json(await deleteTournament(req.params.id));
}));

tournamentRouter.put("/:id/participants", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json({ tournament: await setParticipants(req.params.id, req.body?.playerIds) });
}));

tournamentRouter.post("/:id/draw", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json({ tournament: await drawBracket(req.params.id, req.body) });
}));

tournamentRouter.patch("/matches/:matchId/teams", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json({ tournament: await updateMatchTeams(req.params.matchId, req.body) });
}));

tournamentRouter.post("/matches/:matchId/score", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json({ tournament: await setMatchScore(req.params.matchId, req.body, req.user) });
}));
