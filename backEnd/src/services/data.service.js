import { prisma } from "../lib/prisma.js";
import { normalizeImportPayload, normalizeMatchInput } from "./matchInput.service.js";
import { serializeMatch } from "./shape.service.js";
import { invalidateStatsCache } from "./stats.service.js";
import {
  calcPlayerStats,
  filterMatchesBySeason,
  normalizeTag,
} from "./ranking.service.js";

const STORAGE_KEY = "pool_tracker_v1";

function compareStr(a, b) {
  return String(a).localeCompare(String(b), "zh-Hans-CN", { sensitivity: "base" });
}

function playerName(players, id) {
  return players.find((p) => p.id === id)?.name ?? "Unknown";
}

function buildRankingWins(players, matches, tag) {
  const rows = players.map((p) => {
    const s = calcPlayerStats(p.id, { tag, _matches: matches });
    return { playerId: p.id, name: p.name, total: s.total, wins: s.wins, losses: s.losses, winRate: s.winRate };
  });

  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.total !== a.total) return b.total - a.total;
    return compareStr(a.name, b.name);
  });

  return rows.map((r, idx) => ({ rank: idx + 1, ...r }));
}

function buildRankingWinRate(players, matches, tag) {
  const rows = players.map((p) => {
    const s = calcPlayerStats(p.id, { tag, _matches: matches });
    return { playerId: p.id, name: p.name, total: s.total, wins: s.wins, losses: s.losses, winRate: s.winRate };
  });

  rows.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.total !== a.total) return b.total - a.total;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return compareStr(a.name, b.name);
  });

  return rows.map((r, idx) => ({ rank: idx + 1, ...r }));
}

function buildComputedExport(players, matches) {
  const byTag = (tag) => {
    const t = normalizeTag(tag);
    const filteredMatches = matches.filter((m) => normalizeTag(m.tag) === t);

    const playerDetails = players.map((p) => {
      const s = calcPlayerStats(p.id, { tag: t, _matches: matches });
      return {
        playerId: p.id,
        name: p.name,
        total: s.total,
        wins: s.wins,
        losses: s.losses,
        winRate: s.winRate,
        beaten: s.beatenList.map((x) => ({ opponentId: x.opponentId, opponentName: playerName(players, x.opponentId), count: x.count })),
        lostTo: s.lostToList.map((x) => ({ opponentId: x.opponentId, opponentName: playerName(players, x.opponentId), count: x.count })),
        matches: s.matches.map((m) => ({
          id: m.id,
          tag: normalizeTag(m.tag),
          matchName: m.matchName,
          dateISO: m.dateISO,
          raceTo: m.raceTo,
          left: playerName(players, m.leftPlayerId),
          right: playerName(players, m.rightPlayerId),
          leftScore: m.leftScore,
          rightScore: m.rightScore,
          winner: m.winnerId ? playerName(players, m.winnerId) : null,
          isHandicap: Boolean(m.isHandicap),
          handicapGiverId: m.isHandicap ? (m.handicapGiverId ?? null) : null,
          handicapReceiverId: m.isHandicap ? (m.handicapReceiverId ?? null) : null,
        })),
      };
    });

    return {
      matches: filteredMatches.map((m) => ({
        id: m.id,
        tag: normalizeTag(m.tag),
        matchName: m.matchName,
        dateISO: m.dateISO,
        raceTo: m.raceTo,
        left: playerName(players, m.leftPlayerId),
        right: playerName(players, m.rightPlayerId),
        leftScore: m.leftScore,
        rightScore: m.rightScore,
        winner: m.winnerId ? playerName(players, m.winnerId) : null,
        isHandicap: Boolean(m.isHandicap),
        handicapGiverId: m.isHandicap ? (m.handicapGiverId ?? null) : null,
        handicapReceiverId: m.isHandicap ? (m.handicapReceiverId ?? null) : null,
      })),
      playerDetails,
      rankingsWins: buildRankingWins(players, matches, t).map((r) => ({ rank: r.rank, name: r.name, total: r.total, wins: r.wins, losses: r.losses, winRate: r.winRate })),
      rankingsWinRate: buildRankingWinRate(players, matches, t).map((r) => ({ rank: r.rank, name: r.name, total: r.total, wins: r.wins, losses: r.losses, winRate: r.winRate })),
    };
  };

  return { practice: byTag("practice"), live: byTag("live") };
}

export async function exportStoreJson() {
  const [players, dbMatches] = await Promise.all([
    prisma.player.findMany({ orderBy: { name: "asc" } }),
    prisma.match.findMany({ orderBy: [{ dateISO: "desc" }, { id: "asc" }] }),
  ]);

  const simplePlayers = players.map((player) => ({
    id: player.id,
    name: player.name,
  }));
  const matches = dbMatches.map(serializeMatch);

  return {
    exportedAtISO: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    players: simplePlayers,
    matches,
    computed: buildComputedExport(simplePlayers, matches),
  };
}

export async function importStoreJson(payload, actorId) {
  const normalized = normalizeImportPayload(payload);
  const skippedMatches = [];

  const result = await prisma.$transaction(async (tx) => {
    let importedPlayers = 0;
    let importedMatches = 0;

    for (const player of normalized.players) {
      await tx.player.upsert({
        where: { id: player.id },
        update: { name: player.name },
        create: {
          id: player.id,
          name: player.name,
        },
      });
      importedPlayers += 1;
    }

    const allPlayers = await tx.player.findMany({ select: { id: true } });
    const playerIds = new Set(allPlayers.map((player) => player.id));

    for (const rawMatch of normalized.matches) {
      try {
        const match = normalizeMatchInput(rawMatch, { keepId: true });
        const referencedIds = [
          match.leftPlayerId,
          match.rightPlayerId,
          match.winnerId,
          match.handicapGiverId,
          match.handicapReceiverId,
        ].filter(Boolean);

        const missingId = referencedIds.find((id) => !playerIds.has(id));
        if (missingId) {
          skippedMatches.push({
            id: rawMatch?.id ?? null,
            reason: `Referenced player not found: ${missingId}`,
          });
          continue;
        }

        await tx.match.upsert({
          where: { id: match.id },
          update: {
            matchName: match.matchName,
            dateISO: match.dateISO,
            raceTo: match.raceTo,
            leftPlayerId: match.leftPlayerId,
            rightPlayerId: match.rightPlayerId,
            leftScore: match.leftScore,
            rightScore: match.rightScore,
            winnerId: match.winnerId,
            tag: match.tag,
            isHandicap: match.isHandicap,
            handicapGiverId: match.handicapGiverId,
            handicapReceiverId: match.handicapReceiverId,
          },
          create: match,
        });
        importedMatches += 1;
      } catch (error) {
        skippedMatches.push({
          id: rawMatch?.id ?? null,
          reason: error.message ?? "Invalid match",
        });
      }
    }

    await tx.auditLog.create({
      data: {
        action: "DATA_IMPORTED",
        actorId,
        detail: JSON.stringify({
          importedPlayers,
          importedMatches,
          skippedMatches: skippedMatches.length,
        }),
      },
    });

    return { importedPlayers, importedMatches };
  });

  invalidateStatsCache();

  return {
    ...result,
    skippedMatches,
  };
}

export async function exportSeasonJson(seasonId) {
  const payload = await exportStoreJson();
  const matches = filterMatchesBySeason(payload.matches, seasonId);
  return {
    ...payload,
    matches,
    computed: buildComputedExport(payload.players, matches),
  };
}
