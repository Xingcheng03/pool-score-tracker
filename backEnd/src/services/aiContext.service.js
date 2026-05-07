import { env } from "../config/env.js";
import { httpError } from "../utils/httpError.js";
import { getStatsData } from "./stats.service.js";
import {
  buildFargoLiteLeaderboardFromData,
  calcPlayerStats,
  filterMatchesBySeason,
  getPlayerFargoRatingHistoryFromData,
  normalizeSeasonId,
} from "./ranking.service.js";

export const AI_TASKS = {
  PLAYER_ANALYSIS: "player_analysis",
  MATCHUP_ANALYSIS: "matchup_analysis",
  OPPONENT_RECOMMENDATION: "opponent_recommendation",
};

const VALID_MODES = new Set(["all", "practice", "live"]);
const VALID_GOALS = new Set(["balanced_match", "skill_test", "easier_match"]);
const NO_EVIDENCE_REASON = "No evidence matches are available for this request.";

export function normalizeAiMode(mode) {
  const value = String(mode ?? "all");
  return VALID_MODES.has(value) ? value : "all";
}

export function normalizeAiGoal(goal) {
  const value = String(goal ?? "balanced_match");
  return VALID_GOALS.has(value) ? value : "balanced_match";
}

export function normalizeAiSeason(seasonId) {
  return normalizeSeasonId(seasonId ?? "all");
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sortByRecentMatch(a, b) {
  const timeDiff = new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime();
  if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

function uniqueMatches(matches) {
  const seen = new Set();
  const result = [];

  for (const match of matches) {
    if (!match?.id || seen.has(match.id)) continue;
    seen.add(match.id);
    result.push(match);
  }

  return result;
}

function isPlayerInMatch(match, playerId) {
  return match.leftPlayerId === playerId || match.rightPlayerId === playerId;
}

function isHeadToHead(match, playerId, opponentId) {
  return (
    (match.leftPlayerId === playerId && match.rightPlayerId === opponentId) ||
    (match.leftPlayerId === opponentId && match.rightPlayerId === playerId)
  );
}

function filterByMode(matches, mode) {
  if (mode === "all") return matches;
  return matches.filter((match) => match.tag === mode);
}

function playerName(playerMap, id) {
  return id ? playerMap.get(id) ?? "Unknown" : null;
}

function confidenceFromMatches(effMatches) {
  const count = safeNumber(effMatches);
  if (count >= 30) return "high";
  if (count >= 10) return "medium";
  return "low";
}

function compactLeaderboardRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name ?? "Unknown",
    rating: safeNumber(row.rating, 500),
    ratingRounded: Math.round(safeNumber(row.rating, 500)),
    tier: row.tier,
    played: safeNumber(row.played),
    effMatches: safeNumber(row.effMatches),
    racks: safeNumber(row.racks),
    rackWinRate: safeNumber(row.rackWinRate),
    liveRackWinRate: safeNumber(row.liveRackWinRate),
    pracRackWinRate: safeNumber(row.pracRackWinRate),
    trend10: safeNumber(row.trend10),
    confidence: confidenceFromMatches(row.effMatches),
  };
}

function compactStats(stats) {
  return {
    total: safeNumber(stats?.total),
    wins: safeNumber(stats?.wins),
    losses: safeNumber(stats?.losses),
    winRate: safeNumber(stats?.winRate),
    beatenList: Array.isArray(stats?.beatenList) ? stats.beatenList.slice(0, 10) : [],
    lostToList: Array.isArray(stats?.lostToList) ? stats.lostToList.slice(0, 10) : [],
    matchCount: Array.isArray(stats?.matches) ? stats.matches.length : 0,
  };
}

export function compactAiMatch(match, playerMap) {
  return {
    id: match.id,
    dateISO: match.dateISO,
    matchName: match.matchName ?? "Unnamed match",
    tag: match.tag,
    raceTo: match.raceTo,
    leftPlayerId: match.leftPlayerId,
    leftPlayerName: playerName(playerMap, match.leftPlayerId),
    rightPlayerId: match.rightPlayerId,
    rightPlayerName: playerName(playerMap, match.rightPlayerId),
    leftScore: safeNumber(match.leftScore),
    rightScore: safeNumber(match.rightScore),
    winnerId: match.winnerId,
    winnerName: playerName(playerMap, match.winnerId),
    isHandicap: Boolean(match.isHandicap),
    handicapGiverId: match.handicapGiverId,
    handicapGiverName: playerName(playerMap, match.handicapGiverId),
    handicapReceiverId: match.handicapReceiverId,
    handicapReceiverName: playerName(playerMap, match.handicapReceiverId),
  };
}

function buildPlayerStats(playerId, seasonMatches) {
  return {
    all: compactStats(calcPlayerStats(playerId, { tag: "all", _matches: seasonMatches })),
    practice: compactStats(calcPlayerStats(playerId, { tag: "practice", _matches: seasonMatches })),
    live: compactStats(calcPlayerStats(playerId, { tag: "live", _matches: seasonMatches })),
  };
}

function getEvidenceForTask({ task, maxMatches, recentMatches, opponentRecentMatches, headToHeadMatches, handicapMatches }) {
  if (task === AI_TASKS.PLAYER_ANALYSIS) {
    return uniqueMatches([...recentMatches.slice(0, 8), ...handicapMatches.slice(0, 4)]).slice(0, maxMatches);
  }

  if (task === AI_TASKS.MATCHUP_ANALYSIS) {
    if (headToHeadMatches.length >= maxMatches) return headToHeadMatches.slice(0, maxMatches);
    return uniqueMatches([
      ...headToHeadMatches,
      ...recentMatches.slice(0, 6),
      ...opponentRecentMatches.slice(0, 6),
    ]).slice(0, maxMatches);
  }

  return recentMatches.slice(0, Math.min(6, maxMatches));
}

function contextSummary(context) {
  return {
    seasonId: context.seasonId,
    mode: context.mode,
    goal: context.goal,
    playerCount: context.players.length,
    matchCount: context.modeMatches.length,
    evidenceMatchCount: context.evidenceMatches.length,
    insufficientDataReasons: context.insufficientDataReasons,
  };
}

export function attachRecommendationEvidence(context, recommendedOpponentInput) {
  const maxMatches = context.maxMatches;
  const recommendedOpponentIds = Array.isArray(recommendedOpponentInput)
    ? recommendedOpponentInput.filter(Boolean)
    : [recommendedOpponentInput].filter(Boolean);
  const recommendedOpponentId = recommendedOpponentIds[0] ?? null;

  if (!recommendedOpponentId) {
    const evidenceMatches = context.recentMatches.slice(0, Math.min(6, maxMatches));
    const insufficientDataReasons = evidenceMatches.length > 0
      ? context.insufficientDataReasons.filter((reason) => reason !== NO_EVIDENCE_REASON)
      : context.insufficientDataReasons;
    return {
      ...context,
      insufficientDataReasons,
      evidenceMatches,
      evidence: {
        matches: evidenceMatches.map((match) => compactAiMatch(match, context.playerMap)),
        players: getEvidencePlayers(context, evidenceMatches),
      },
      contextSummary: {
        ...context.contextSummary,
        evidenceMatchCount: evidenceMatches.length,
        insufficientDataReasons,
      },
    };
  }

  const opponentMatches = context.modeMatches
    .filter((match) => recommendedOpponentIds.some((id) => isPlayerInMatch(match, id)))
    .sort(sortByRecentMatch);
  const headToHeadMatches = context.modeMatches
    .filter((match) => recommendedOpponentIds.some((id) => isHeadToHead(match, context.selectedPlayer.id, id)))
    .sort(sortByRecentMatch);

  const evidenceMatches = uniqueMatches([
    ...context.recentMatches.slice(0, 6),
    ...headToHeadMatches.slice(0, 8),
    ...opponentMatches.slice(0, 8),
  ]).slice(0, maxMatches);
  const insufficientDataReasons = evidenceMatches.length > 0
    ? context.insufficientDataReasons.filter((reason) => reason !== NO_EVIDENCE_REASON)
    : context.insufficientDataReasons;

  return {
    ...context,
    insufficientDataReasons,
    opponent: context.players.find((player) => player.id === recommendedOpponentId) ?? context.opponent,
    opponentRow: context.leaderboardRows.find((row) => row.id === recommendedOpponentId) ?? context.opponentRow,
    opponentMatches,
    headToHeadMatches,
    evidenceMatches,
    evidence: {
      matches: evidenceMatches.map((match) => compactAiMatch(match, context.playerMap)),
      players: getEvidencePlayers(context, evidenceMatches, recommendedOpponentId),
    },
    contextSummary: {
      ...context.contextSummary,
      evidenceMatchCount: evidenceMatches.length,
      insufficientDataReasons,
    },
  };
}

function getEvidencePlayers(context, evidenceMatches, extraPlayerId = null) {
  const ids = new Set();
  if (context.selectedPlayer?.id) ids.add(context.selectedPlayer.id);
  if (context.opponent?.id) ids.add(context.opponent.id);
  if (extraPlayerId) ids.add(extraPlayerId);

  for (const match of evidenceMatches) {
    if (match.leftPlayerId) ids.add(match.leftPlayerId);
    if (match.rightPlayerId) ids.add(match.rightPlayerId);
    if (match.winnerId) ids.add(match.winnerId);
    if (match.handicapGiverId) ids.add(match.handicapGiverId);
    if (match.handicapReceiverId) ids.add(match.handicapReceiverId);
  }

  return [...ids]
    .map((id) => context.players.find((player) => player.id === id))
    .filter(Boolean)
    .map((player) => ({ id: player.id, name: player.name }));
}

export async function buildAiContext(input = {}) {
  const task = input.task;
  const playerId = String(input.playerId ?? "").trim();
  const opponentId = String(input.opponentId ?? "").trim();
  const seasonId = "all";
  const mode = "all";
  const goal = normalizeAiGoal(input.goal);
  const maxMatches = Math.max(1, Math.min(24, safeNumber(env.aiMaxMatches, 12)));

  if (!Object.values(AI_TASKS).includes(task)) throw httpError(400, "Invalid AI task");
  if (!playerId) throw httpError(400, "playerId is required");
  if (task === AI_TASKS.MATCHUP_ANALYSIS && !opponentId) throw httpError(400, "opponentId is required");
  if (opponentId && playerId === opponentId) throw httpError(400, "Choose two different players");

  const { players, matches } = await getStatsData();
  const selectedPlayer = players.find((player) => player.id === playerId);
  if (!selectedPlayer) throw httpError(404, "Player not found");

  const opponent = opponentId ? players.find((player) => player.id === opponentId) : null;
  if (opponentId && !opponent) throw httpError(404, "Opponent not found");

  const playerMap = new Map(players.map((player) => [player.id, player.name]));
  const seasonMatches = filterMatchesBySeason(matches, seasonId);
  const modeMatches = filterByMode(seasonMatches, mode).sort(sortByRecentMatch);
  const leaderboardRows = buildFargoLiteLeaderboardFromData(players, matches, {
    mode,
    seasonId,
    minMatches: 0,
    sortKey: "rating",
    sortDir: "desc",
  }).map(compactLeaderboardRow);

  const selectedPlayerRow = leaderboardRows.find((row) => row.id === playerId) ?? compactLeaderboardRow({ id: playerId, name: selectedPlayer.name });
  const opponentRow = opponentId ? leaderboardRows.find((row) => row.id === opponentId) ?? null : null;
  const candidateRows = leaderboardRows.filter((row) => row.id !== playerId);

  const recentMatches = modeMatches.filter((match) => isPlayerInMatch(match, playerId));
  const opponentRecentMatches = opponentId ? modeMatches.filter((match) => isPlayerInMatch(match, opponentId)) : [];
  const headToHeadMatches = opponentId
    ? modeMatches.filter((match) => isHeadToHead(match, playerId, opponentId))
    : [];
  const handicapMatches = recentMatches.filter((match) => match.isHandicap);

  const evidenceMatches = getEvidenceForTask({
    task,
    maxMatches,
    recentMatches,
    opponentRecentMatches,
    headToHeadMatches,
    handicapMatches,
  });

  const selectedPlayerStats = buildPlayerStats(playerId, seasonMatches);
  const opponentStats = opponentId ? buildPlayerStats(opponentId, seasonMatches) : null;
  const selectedPlayerRatingHistory = getPlayerFargoRatingHistoryFromData(playerId, players, seasonMatches);
  const opponentRatingHistory = opponentId ? getPlayerFargoRatingHistoryFromData(opponentId, players, seasonMatches) : null;
  const insufficientDataReasons = [];

  if (selectedPlayerRow.effMatches < 3) {
    insufficientDataReasons.push("Selected player has fewer than 3 effective matches.");
  }
  if (task === AI_TASKS.MATCHUP_ANALYSIS && headToHeadMatches.length === 0) {
    insufficientDataReasons.push("Selected players have no head-to-head matches in this filter.");
  }
  if (task === AI_TASKS.OPPONENT_RECOMMENDATION && candidateRows.length < 1) {
    insufficientDataReasons.push("There are not enough candidate opponents.");
  }
  if (evidenceMatches.length === 0) {
    insufficientDataReasons.push(NO_EVIDENCE_REASON);
  }

  const context = {
    task,
    seasonId,
    mode,
    goal,
    maxMatches,
    players,
    playerMap,
    matches,
    seasonMatches,
    modeMatches,
    selectedPlayer,
    opponent,
    leaderboardRows,
    selectedPlayerRow,
    opponentRow,
    candidateRows,
    selectedPlayerStats,
    opponentStats,
    selectedPlayerRatingHistory,
    opponentRatingHistory,
    recentMatches,
    opponentMatches: opponentRecentMatches,
    headToHeadMatches,
    handicapMatches,
    evidenceMatches,
    insufficientDataReasons,
  };

  return {
    ...context,
    evidence: {
      matches: evidenceMatches.map((match) => compactAiMatch(match, playerMap)),
      players: getEvidencePlayers(context, evidenceMatches),
    },
    contextSummary: contextSummary(context),
  };
}
