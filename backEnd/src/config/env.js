import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "local-dev-change-before-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  aiModel: process.env.AI_MODEL ?? "gemini-2.5-flash",
  aiMaxMatches: Number(process.env.AI_MAX_MATCHES ?? 12),
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 12000),
  aiEnabled: process.env.AI_ENABLED !== "false",
};
