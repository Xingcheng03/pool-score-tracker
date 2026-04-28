import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createPlayer,
  deletePlayer,
  getPlayer,
  listPlayers,
  setPlayerAccount,
  updatePlayer,
} from "../services/player.service.js";

export const playersRouter = Router();

playersRouter.use(requireAuth);

playersRouter.get("/", asyncHandler(async (_req, res) => {
  res.json({ players: await listPlayers({ includeAccount: _req.user.role === "ADMIN" }) });
}));

playersRouter.post("/", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.status(201).json({ player: await createPlayer(req.body) });
}));

playersRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json({ player: await getPlayer(req.params.id, { includeAccount: req.user.role === "ADMIN" }) });
}));

playersRouter.patch("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json({ player: await updatePlayer(req.params.id, req.body) });
}));

playersRouter.delete("/:id", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json(await deletePlayer(req.params.id));
}));

playersRouter.put("/:id/account", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  const user = await setPlayerAccount(req.params.id, req.body, req.user.id);
  res.json({ user });
}));
