import { prisma } from "../lib/prisma.js";
import { serializeMatch } from "./shape.service.js";
import {
  buildFargoLiteLeaderboardFromData,
  buildWinLoseRowsFromData,
  calcPlayerStats,
  filterMatchesBySeason,
  getAvailableSeasons,
  getPlayerFargoRatingHistoryFromData,
  normalizeSeasonId,
} from "./ranking.service.js";
import { httpError } from "../utils/httpError.js";

const STATS_DATA_TTL_MS = 60_000;
const STATS_RESULT_TTL_MS = 30_000;

let statsDataCache = null;
const statsResultCache = new Map();

function cacheKey(name, query = {}) {
  const normalized = Object.keys(query)
    .sort()
    .map((key) => [key, query[key] == null ? "" : String(query[key])]);
  return `${name}:${JSON.stringify(normalized)}`;
}

function getCachedResult(key) {
  const hit = statsResultCache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) {
    statsResultCache.delete(key);
    return null;
  }
  return hit.value;
}

function setCachedResult(key, value) {
  statsResultCache.set(key, {
    value,
    expiresAt: Date.now() + STATS_RESULT_TTL_MS,
  });
  return value;
}

export function invalidateStatsCache() {
  statsDataCache = null;
  statsResultCache.clear();
}

export async function getStatsData() {
  if (statsDataCache && statsDataCache.expiresAt > Date.now()) {
    return statsDataCache.value;
  }

  const [players, dbMatches] = await Promise.all([
    prisma.player.findMany({ orderBy: { name: "asc" } }),
    prisma.match.findMany({ orderBy: [{ dateISO: "desc" }, { id: "asc" }] }),
  ]);

  const value = {
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      hidden: player.hidden ?? false,
      retired: player.retired ?? false,
    })),
    matches: dbMatches.map(serializeMatch),
  };

  statsDataCache = {
    value,
    expiresAt: Date.now() + STATS_DATA_TTL_MS,
  };

  return value;
}

export async function getLeaderboard(query = {}) {
  const key = cacheKey("leaderboard", query);
  const cached = getCachedResult(key);
  if (cached) return cached;

  const { players, matches } = await getStatsData();
  const seasonId = query.seasonId ?? query.season ?? "all";
  return setCachedResult(key, {
    seasonId: normalizeSeasonId(seasonId),
    rows: buildFargoLiteLeaderboardFromData(players, matches, {
      mode: query.mode ?? "all",
      seasonId,
      q: query.q ?? "",
      minMatches: query.minMatches ?? 0,
      sortKey: query.sortKey ?? "rating",
      sortDir: query.sortDir ?? "desc",
    }),
  });
}

export async function getWinLosePoints(query = {}) {
  const key = cacheKey("winLose", query);
  const cached = getCachedResult(key);
  if (cached) return cached;

  const { players, matches } = await getStatsData();
  return setCachedResult(key, buildWinLoseRowsFromData(players, matches, {
    q: query.q ?? "",
    cutoffISO: query.cutoffISO ?? "",
  }));
}

export async function getSeasons() {
  const key = "seasons";
  const cached = getCachedResult(key);
  if (cached) return cached;

  const { matches } = await getStatsData();
  return setCachedResult(key, getAvailableSeasons(matches));
}

export async function getLeaderboardSummary(query = {}) {
  const [leaderboard, winLose, seasons] = await Promise.all([
    getLeaderboard(query),
    getWinLosePoints({ q: query.q ?? "" }),
    getSeasons(),
  ]);

  return { leaderboard, winLose, seasons };
}

export async function getPlayerStats(playerId, query = {}) {
  const key = cacheKey("playerStats", { playerId, ...query });
  const cached = getCachedResult(key);
  if (cached) return cached;

  const { players, matches } = await getStatsData();
  const player = players.find((item) => item.id === playerId);
  if (!player) throw httpError(404, "Player not found");

  const seasonId = normalizeSeasonId(query.seasonId ?? query.season ?? "all");
  const seasonMatches = filterMatchesBySeason(matches, seasonId);

  return setCachedResult(key, {
    player,
    seasonId,
    practice: calcPlayerStats(playerId, { tag: "practice", _matches: seasonMatches }),
    live: calcPlayerStats(playerId, { tag: "live", _matches: seasonMatches }),
    fargoHistory: getPlayerFargoRatingHistoryFromData(playerId, players, seasonMatches),
  });
}
