import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { dataRouter } from "./routes/data.routes.js";
import { leaderboardRouter } from "./routes/leaderboard.routes.js";
import { matchesRouter } from "./routes/matches.routes.js";
import { matchReportsRouter } from "./routes/matchReports.routes.js";
import { playersRouter } from "./routes/players.routes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export const app = express();
export default app;

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "25mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/players", playersRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/match-reports", matchReportsRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/data", dataRouter);

app.use(notFound);
app.use(errorHandler);
