import { randomUUID } from "node:crypto";
import { apiTagToDb } from "./shape.service.js";
import { httpError } from "../utils/httpError.js";

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeTag(tag) {
  return tag === "live" ? "live" : "practice";
}

function normalizeMatchType(value) {
  return value === "doubles" || value === "DOUBLES" ? "DOUBLES" : "SINGLES";
}

function normalizeDoublesInput(input, opts = {}) {
  const leftScore = Number(input?.leftScore ?? 0);
  const rightScore = Number(input?.rightScore ?? 0);
  const raceTo = Number(input?.raceTo ?? 7);
  const a1 = String(input?.leftPlayerId ?? "").trim();
  const a2 = String(input?.leftPlayer2Id ?? "").trim();
  const b1 = String(input?.rightPlayerId ?? "").trim();
  const b2 = String(input?.rightPlayer2Id ?? "").trim();

  const ids = [a1, a2, b1, b2];
  if (ids.some((id) => !id)) {
    throw httpError(400, "Doubles requires four players");
  }
  if (new Set(ids).size !== 4) {
    throw httpError(400, "The four doubles players must be distinct");
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

  const date = input?.dateISO ? new Date(input.dateISO) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw httpError(400, "dateISO is invalid");
  }

  // winnerId 记录胜方的 player1，便于复用现有 winner 字段；双打的真正胜负在街灯榜里按比分判两队。
  const winnerId = leftScore > rightScore ? a1 : b1;

  return {
    id: opts.keepId ? String(input?.id ?? uid()) : (input?.id ? String(input.id) : randomUUID()),
    matchName: String(input?.matchName ?? "未命名双打").trim() || "未命名双打",
    dateISO: date,
    raceTo: Math.trunc(raceTo),
    matchType: "DOUBLES",
    leftPlayerId: a1,
    leftPlayer2Id: a2,
    rightPlayerId: b1,
    rightPlayer2Id: b2,
    leftScore: Math.trunc(leftScore),
    rightScore: Math.trunc(rightScore),
    winnerId,
    tag: apiTagToDb(normalizeTag(input?.tag)),
    isHandicap: false,
    handicapGiverId: null,
    handicapReceiverId: null,
  };
}

export function normalizeMatchInput(input, opts = {}) {
  if (normalizeMatchType(input?.matchType) === "DOUBLES") {
    return normalizeDoublesInput(input, opts);
  }

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
    matchType: "SINGLES",
    leftPlayerId,
    rightPlayerId,
    leftPlayer2Id: null,
    rightPlayer2Id: null,
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
