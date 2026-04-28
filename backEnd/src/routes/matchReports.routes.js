import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  approveMatchReport,
  createMatchReport,
  listMatchReports,
  listMyMatchReports,
  rejectMatchReport,
} from "../services/matchReport.service.js";

export const matchReportsRouter = Router();

matchReportsRouter.use(requireAuth);

matchReportsRouter.post("/", asyncHandler(async (req, res) => {
  res.status(201).json({ report: await createMatchReport(req.body, req.user) });
}));

matchReportsRouter.get("/mine", asyncHandler(async (req, res) => {
  res.json({ reports: await listMyMatchReports(req.user) });
}));

matchReportsRouter.get("/", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json({ reports: await listMatchReports(req.query) });
}));

matchReportsRouter.post("/:id/approve", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json({ report: await approveMatchReport(req.params.id, req.user.id) });
}));

matchReportsRouter.post("/:id/reject", requireRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json({ report: await rejectMatchReport(req.params.id, req.user.id, req.body?.reason) });
}));
