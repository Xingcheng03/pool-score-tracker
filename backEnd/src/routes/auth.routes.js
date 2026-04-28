import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { login, registerPlayerAccount, updateMyAccount } from "../services/auth.service.js";
import { serializeUser } from "../services/shape.service.js";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(async (req, res) => {
  const result = await registerPlayerAccount(req.body);
  res.status(201).json(result);
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const result = await login(req.body);
  res.json(result);
}));

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

authRouter.patch("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await updateMyAccount(req.user.id, req.body);
  res.json({ user });
}));
