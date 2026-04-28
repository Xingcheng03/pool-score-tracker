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

export async function getStatsData() {
  const [players, dbMatches] = await Promise.all([
    prisma.player.findMany({ orderBy: { name: "asc" } }),
    prisma.match.findMany({ orderBy: [{ dateISO: "desc" }, { id: "asc" }] }),
  ]);

  return {
    players: players.map((player) => ({ id: player.id, name: player.name })),
    matches: dbMatches.map(serializeMatch),
  };
}

export async function getLeaderboard(query = {}) {
  const { players, matches } = await getStatsData();
  const seasonId = query.seasonId ?? query.season ?? "all";
  return {
    seasonId: normalizeSeasonId(seasonId),
    rows: buildFargoLiteLeaderboardFromData(players, matches, {
      mode: query.mode ?? "all",
      seasonId,
      q: query.q ?? "",
      minMatches: query.minMatches ?? 0,
      sortKey: query.sortKey ?? "rating",
      sortDir: query.sortDir ?? "desc",
    }),
  };
}

export async function getWinLosePoints(query = {}) {
  const { players, matches } = await getStatsData();
  return buildWinLoseRowsFromData(players, matches, {
    q: query.q ?? "",
    cutoffISO: query.cutoffISO ?? "",
  });
}

export async function getSeasons() {
  const { matches } = await getStatsData();
  return getAvailableSeasons(matches);
}

export async function getPlayerStats(playerId, query = {}) {
  const { players, matches } = await getStatsData();
  const player = players.find((item) => item.id === playerId);
  if (!player) throw httpError(404, "Player not found");

  const seasonId = normalizeSeasonId(query.seasonId ?? query.season ?? "all");
  const seasonMatches = filterMatchesBySeason(matches, seasonId);

  return {
    player,
    seasonId,
    practice: calcPlayerStats(playerId, { tag: "practice", _matches: seasonMatches }),
    live: calcPlayerStats(playerId, { tag: "live", _matches: seasonMatches }),
    fargoHistory: getPlayerFargoRatingHistoryFromData(playerId, players, seasonMatches),
  };
}
