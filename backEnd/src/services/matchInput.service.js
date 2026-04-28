import { randomUUID } from "node:crypto";
import { apiTagToDb } from "./shape.service.js";
import { httpError } from "../utils/httpError.js";

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeTag(tag) {
  return tag === "live" ? "live" : "practice";
}

export function normalizeMatchInput(input, opts = {}) {
  const leftScore = Number(input?.leftScore ?? 0);
  const rightScore = Number(input?.rightScore ?? 0);
  const raceTo = Number(input?.raceTo ?? 7);
  const leftPlayerId = String(input?.leftPlayerId ?? "").trim();
  const rightPlayerId = String(input?.rightPlayerId ?? "").trim();

  if (!leftPlayerId || !rightPlayerId) {
    throw httpError(400, "Both players are required");
  }

  if (leftPlayerId === rightPlayerId) {
    throw httpError(400, "Left and right player cannot be the same");
  }

  if (!Number.isFinite(leftScore) || !Number.isFinite(rightScore)) {
    throw httpError(400, "Scores must be valid numbers");
  }

  if (leftScore === rightScore) {
    throw httpError(400, "Tied scores are not allowed");
  }

  if (!Number.isFinite(raceTo) || raceTo <= 0) {
    throw httpError(400, "raceTo must be greater than 0");
  }

  const winnerId =
    input?.winnerId ??
    (leftScore > rightScore ? leftPlayerId : rightScore > leftScore ? rightPlayerId : null);

  const isHandicap = Boolean(input?.isHandicap);
  const giverId = isHandicap ? (input?.handicapGiverId ?? null) : null;
  const receiverId = isHandicap ? (input?.handicapReceiverId ?? null) : null;
  const handicapGiverId = typeof giverId === "string" && giverId.trim() ? giverId : null;
  const handicapReceiverId = typeof receiverId === "string" && receiverId.trim() ? receiverId : null;
  const validPair =
    isHandicap &&
    handicapGiverId &&
    handicapReceiverId &&
    handicapGiverId !== handicapReceiverId;

  const date = input?.dateISO ? new Date(input.dateISO) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw httpError(400, "dateISO is invalid");
  }

  return {
    id: opts.keepId ? String(input?.id ?? uid()) : (input?.id ? String(input.id) : randomUUID()),
    matchName: String(input?.matchName ?? "未命名比赛").trim() || "未命名比赛",
    dateISO: date,
    raceTo: Math.trunc(raceTo),
    leftPlayerId,
    rightPlayerId,
    leftScore: Math.trunc(leftScore),
    rightScore: Math.trunc(rightScore),
    winnerId,
    tag: apiTagToDb(normalizeTag(input?.tag)),
    isHandicap: Boolean(validPair),
    handicapGiverId: validPair ? handicapGiverId : null,
    handicapReceiverId: validPair ? handicapReceiverId : null,
  };
}

export function normalizeImportPayload(payload) {
  const players = Array.isArray(payload?.players) ? payload.players : [];
  const matches = Array.isArray(payload?.matches) ? payload.matches : [];

  return {
    players: players.map((player) => ({
      id: String(player?.id ?? uid()),
      name: String(player?.name ?? "Unknown"),
    })),
    matches,
  };
}
