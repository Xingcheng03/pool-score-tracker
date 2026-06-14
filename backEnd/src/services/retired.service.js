import { prisma } from "../lib/prisma.js";
import { calcPlayerCardStats } from "./ranking.service.js";
import { getStatsData } from "./stats.service.js";

// 把一场比赛序列化成「站在某球员视角」的高光条目
function serializeHighlight(match, playerId, nameById) {
  const isLeft = match.leftPlayerId === playerId;
  const myScore = isLeft ? match.leftScore : match.rightScore;
  const opponentScore = isLeft ? match.rightScore : match.leftScore;
  const opponentId = isLeft ? match.rightPlayerId : match.leftPlayerId;
  const result = !match.winnerId ? "draw" : match.winnerId === playerId ? "win" : "loss";

  return {
    id: match.id,
    matchName: match.matchName,
    dateISO: match.dateISO?.toISOString?.() ?? match.dateISO,
    tag: match.tag === "LIVE" ? "live" : "practice",
    raceTo: match.raceTo,
    opponentId,
    opponentName: nameById.get(opponentId) ?? "Unknown",
    myScore,
    opponentScore,
    result,
  };
}

export async function listRetiredPlayers() {
  const retired = await prisma.player.findMany({
    where: { retired: true },
    include: { highlightMatches: true },
    orderBy: [{ retiredAt: "desc" }, { name: "asc" }],
  });

  if (retired.length === 0) return { players: [] };

  // 统计口径与街灯榜一致：用全体球员 + 全部比赛
  const { players, matches } = await getStatsData();
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  // 一次性查出这些退役球员各自上过几次耻辱柱（作为 loser）
  const shameGroups = await prisma.shameRecord.groupBy({
    by: ["loserId"],
    where: { loserId: { in: retired.map((p) => p.id) } },
    _count: { _all: true },
  });
  const shameCountById = new Map(shameGroups.map((g) => [g.loserId, g._count._all]));

  return {
    players: retired.map((player) => {
      const highlights = [...player.highlightMatches]
        .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime())
        .map((m) => serializeHighlight(m, player.id, nameById));

      return {
        id: player.id,
        name: player.name,
        retirementNote: player.retirementNote ?? null,
        retiredAt: player.retiredAt?.toISOString?.() ?? player.retiredAt ?? null,
        shameCount: shameCountById.get(player.id) ?? 0,
        stats: calcPlayerCardStats(player.id, players, matches),
        highlights,
      };
    }),
  };
}
