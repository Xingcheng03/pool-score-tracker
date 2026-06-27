import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { httpError } from "../utils/httpError.js";
import { normalizeMatchInput } from "./matchInput.service.js";
import { invalidateStatsCache } from "./stats.service.js";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeFormat(value) {
  return value === "doubles" || value === "DOUBLES" ? "DOUBLES" : "SINGLES";
}

function isPowerOfTwo(n) {
  return Number.isInteger(n) && n >= 1 && (n & (n - 1)) === 0;
}

function dbTagToApi(tag) {
  return tag === "LIVE" ? "live" : "practice";
}

// ---- serialize ----

function serializeTournament(t, { participants = [], matches = [], playerMap = new Map() } = {}) {
  const resolve = (id) => (id ? { id, name: playerMap.get(id) ?? "未知球员" } : null);

  return {
    id: t.id,
    name: t.name,
    format: normalizeFormat(t.format) === "DOUBLES" ? "doubles" : "singles",
    status: t.status,
    raceTo: t.raceTo,
    tag: dbTagToApi(t.tag),
    createdAt: t.createdAt?.toISOString?.() ?? t.createdAt,
    updatedAt: t.updatedAt?.toISOString?.() ?? t.updatedAt,
    participants: participants.map((p) => ({
      id: p.id,
      player: resolve(p.playerId),
      teammate: resolve(p.teammateId),
      seed: p.seed ?? null,
    })),
    matches: matches.map((m) => ({
      id: m.id,
      round: m.round,
      slotIndex: m.slotIndex,
      teamA: [resolve(m.a1Id), resolve(m.a2Id)].filter(Boolean),
      teamB: [resolve(m.b1Id), resolve(m.b2Id)].filter(Boolean),
      leftScore: m.leftScore,
      rightScore: m.rightScore,
      winnerSide: m.winnerSide,
      status: m.status,
      nextMatchId: m.nextMatchId,
      nextSlot: m.nextSlot,
      approvedMatchId: m.approvedMatchId,
    })),
  };
}

async function loadPlayerMap() {
  const players = await prisma.player.findMany({ select: { id: true, name: true } });
  return new Map(players.map((p) => [p.id, p.name]));
}

// ---- read ----

export async function listTournaments() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { _count: { select: { participants: true, matches: true } } },
  });

  return tournaments.map((t) => ({
    id: t.id,
    name: t.name,
    format: normalizeFormat(t.format) === "DOUBLES" ? "doubles" : "singles",
    status: t.status,
    raceTo: t.raceTo,
    tag: dbTagToApi(t.tag),
    participantCount: t._count.participants,
    matchCount: t._count.matches,
    createdAt: t.createdAt?.toISOString?.() ?? t.createdAt,
  }));
}

export async function getTournament(id) {
  const t = await prisma.tournament.findUnique({
    where: { id },
    include: {
      participants: { orderBy: { seed: "asc" } },
      matches: { orderBy: [{ round: "asc" }, { slotIndex: "asc" }] },
    },
  });
  if (!t) throw httpError(404, "Tournament not found");

  const playerMap = await loadPlayerMap();
  return serializeTournament(t, { participants: t.participants, matches: t.matches, playerMap });
}

// ---- write (admin) ----

export async function createTournament(input, user) {
  const name = String(input?.name ?? "").trim() || "未命名赛事";
  const format = normalizeFormat(input?.format);
  const raceTo = Math.max(1, Math.trunc(Number(input?.raceTo ?? 7)) || 7);
  const tag = input?.tag === "live" ? "LIVE" : "PRACTICE";

  const t = await prisma.tournament.create({
    data: { name, format, raceTo, tag, createdById: user?.id ?? null },
  });

  return getTournament(t.id);
}

export async function updateTournament(id, input) {
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t) throw httpError(404, "Tournament not found");

  const data = {};
  if (input?.name != null) data.name = String(input.name).trim() || t.name;
  if (input?.raceTo != null) data.raceTo = Math.max(1, Math.trunc(Number(input.raceTo)) || t.raceTo);
  if (input?.tag != null) data.tag = input.tag === "live" ? "LIVE" : "PRACTICE";
  if (input?.format != null && t.status === "DRAFT") data.format = normalizeFormat(input.format);
  if (input?.status != null) data.status = String(input.status).toUpperCase();

  await prisma.tournament.update({ where: { id }, data });
  return getTournament(id);
}

export async function deleteTournament(id) {
  await prisma.$transaction(async (tx) => {
    // 删赛事前，先删掉本赛事录入比分时生成的正式比赛，让街灯榜一并回退。
    const scored = await tx.tournamentMatch.findMany({
      where: { tournamentId: id, approvedMatchId: { not: null } },
      select: { approvedMatchId: true },
    });
    const matchIds = scored.map((n) => n.approvedMatchId).filter(Boolean);
    if (matchIds.length) {
      await tx.match.deleteMany({ where: { id: { in: matchIds } } });
    }
    // 对阵节点/参赛者经 tournamentId 级联自动清理。
    await tx.tournament.delete({ where: { id } });
  });

  invalidateStatsCache();
  return { ok: true };
}

export async function setParticipants(id, playerIds) {
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t) throw httpError(404, "Tournament not found");
  if (t.status !== "DRAFT") throw httpError(409, "Participants can only be set before the draw");

  const ids = Array.isArray(playerIds) ? [...new Set(playerIds.map(String).filter(Boolean))] : [];

  await prisma.$transaction(async (tx) => {
    await tx.tournamentParticipant.deleteMany({ where: { tournamentId: id } });
    if (ids.length) {
      await tx.tournamentParticipant.createMany({
        data: ids.map((playerId) => ({ tournamentId: id, playerId })),
      });
    }
  });

  return getTournament(id);
}

// 一个 team = { p1, p2|null }。把队伍按单淘汰建成对阵树（轮空自动晋级）。
// 导出仅为可测试性：纯函数，无副作用。
export function buildBracketMatches(tournamentId, teams) {
  let bracketSize = 1;
  while (bracketSize < teams.length) bracketSize *= 2;
  bracketSize = Math.max(2, bracketSize);

  const totalRounds = Math.round(Math.log2(bracketSize));
  const byes = bracketSize - teams.length;

  // 预生成每轮的节点 id。
  const roundIds = [];
  for (let r = 1; r <= totalRounds; r += 1) {
    const count = bracketSize / 2 ** r;
    roundIds[r] = Array.from({ length: count }, () => randomUUID());
  }

  const matchById = new Map();
  for (let r = 1; r <= totalRounds; r += 1) {
    roundIds[r].forEach((mid, i) => {
      const node = {
        id: mid,
        tournamentId,
        round: r,
        slotIndex: i,
        a1Id: null, a2Id: null, b1Id: null, b2Id: null,
        leftScore: null, rightScore: null,
        winnerSide: null,
        status: "PENDING",
        nextMatchId: null,
        nextSlot: null,
        approvedMatchId: null,
      };
      if (r < totalRounds) {
        node.nextMatchId = roundIds[r + 1][Math.floor(i / 2)];
        node.nextSlot = i % 2 === 0 ? "A" : "B";
      }
      matchById.set(mid, node);
    });
  }

  const setTeam = (node, side, team) => {
    if (!team) return;
    if (side === "A") { node.a1Id = team.p1; node.a2Id = team.p2 ?? null; }
    else { node.b1Id = team.p1; node.b2Id = team.p2 ?? null; }
  };

  // 填第一轮：前 byes 个节点为轮空（只放 A 队，直接晋级）。
  const queue = [...teams];
  const round1 = roundIds[1].map((id) => matchById.get(id));
  round1.forEach((node, i) => {
    if (i < byes) {
      setTeam(node, "A", queue.shift());
      node.status = "DONE";
      node.winnerSide = "A";
    } else {
      setTeam(node, "A", queue.shift());
      setTeam(node, "B", queue.shift());
    }
  });

  // 把轮空胜者立即送进下一轮对应槽位。
  for (const node of round1) {
    if (node.status === "DONE" && node.nextMatchId) {
      const winnerTeam = { p1: node.a1Id, p2: node.a2Id };
      setTeam(matchById.get(node.nextMatchId), node.nextSlot, winnerTeam);
    }
  }

  return [...matchById.values()];
}

export async function drawBracket(id, input = {}) {
  const exists = await prisma.tournament.findUnique({ where: { id } });
  if (!exists) throw httpError(404, "Tournament not found");

  // 抽签时直接带上参赛名单，省去单独"保存球员"一步。
  if (Array.isArray(input?.playerIds)) {
    const ids = [...new Set(input.playerIds.map(String).filter(Boolean))];
    await prisma.$transaction(async (tx) => {
      await tx.tournamentParticipant.deleteMany({ where: { tournamentId: id } });
      if (ids.length) {
        await tx.tournamentParticipant.createMany({
          data: ids.map((playerId) => ({ tournamentId: id, playerId })),
        });
      }
    });
  }

  const t = await prisma.tournament.findUnique({
    where: { id },
    include: { participants: true },
  });
  if (!t.participants.length) throw httpError(400, "No participants to draw");

  const format = normalizeFormat(t.format);
  let teams;
  const teamAssignments = []; // { playerId, teammateId, seed }

  if (format === "DOUBLES") {
    const count = t.participants.length;
    // 双打要求队伍数为 2 的幂，保证每一轮都能对半晋级、绝不出现轮空。
    if (count % 2 !== 0 || !isPowerOfTwo(count / 2)) {
      throw httpError(
        400,
        `双打人数需为 4 / 8 / 16 / 32（队伍数是 2 的幂），当前 ${count} 人无法组成干净的单淘汰对阵`,
      );
    }

    let pairs;
    if (Array.isArray(input?.teams) && input.teams.length) {
      // 手动组队：[[p1,p2], ...]
      pairs = input.teams.map((pair) => [String(pair[0]), String(pair[1])]);
    } else {
      // 随机两两组队。
      const ids = shuffle(t.participants.map((p) => p.playerId));
      pairs = [];
      for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
    }
    const ordered = input?.teamsOrdered === false ? shuffle(pairs) : pairs;
    teams = ordered.map(([p1, p2]) => ({ p1, p2 }));
    ordered.forEach(([p1, p2], seed) => {
      teamAssignments.push({ playerId: p1, teammateId: p2, seed });
      teamAssignments.push({ playerId: p2, teammateId: p1, seed });
    });
  } else {
    // 单打也要求人数为 2 的幂，否则某一轮会出现奇数个胜者、被迫轮空。
    if (!isPowerOfTwo(t.participants.length) || t.participants.length < 2) {
      throw httpError(
        400,
        `单打人数需为 2 / 4 / 8 / 16 / 32（2 的幂），当前 ${t.participants.length} 人无法组成干净的单淘汰对阵`,
      );
    }

    let ids = t.participants.map((p) => p.playerId);
    if (Array.isArray(input?.order) && input.order.length) {
      ids = input.order.map(String).filter((pid) => ids.includes(pid));
    } else {
      ids = shuffle(ids);
    }
    teams = ids.map((p1) => ({ p1, p2: null }));
    ids.forEach((playerId, seed) => teamAssignments.push({ playerId, teammateId: null, seed }));
  }

  const matches = buildBracketMatches(id, teams);

  await prisma.$transaction(async (tx) => {
    await tx.tournamentMatch.deleteMany({ where: { tournamentId: id } });
    // 回写组队/种子，方便前端展示。
    for (const a of teamAssignments) {
      await tx.tournamentParticipant.updateMany({
        where: { tournamentId: id, playerId: a.playerId },
        data: { teammateId: a.teammateId, seed: a.seed },
      });
    }
    await tx.tournamentMatch.createMany({ data: matches });
    await tx.tournament.update({ where: { id }, data: { status: "ONGOING" } });
  });

  return getTournament(id);
}

// 手动改某节点的球员（仅 PENDING 节点，赛前调整对阵/换人）。
export async function updateMatchTeams(matchId, input = {}) {
  const node = await prisma.tournamentMatch.findUnique({ where: { id: matchId } });
  if (!node) throw httpError(404, "Match node not found");
  if (node.status === "DONE") throw httpError(409, "Cannot edit a finished match");

  const data = {};
  for (const key of ["a1Id", "a2Id", "b1Id", "b2Id"]) {
    if (key in input) data[key] = input[key] ? String(input[key]) : null;
  }
  await prisma.tournamentMatch.update({ where: { id: matchId }, data });
  return getTournament(node.tournamentId);
}

export async function setMatchScore(matchId, input, _user) {
  const node = await prisma.tournamentMatch.findUnique({ where: { id: matchId } });
  if (!node) throw httpError(404, "Match node not found");

  const t = await prisma.tournament.findUnique({ where: { id: node.tournamentId } });
  if (!t) throw httpError(404, "Tournament not found");

  const format = normalizeFormat(t.format);
  const teamAReady = format === "DOUBLES" ? node.a1Id && node.a2Id : node.a1Id;
  const teamBReady = format === "DOUBLES" ? node.b1Id && node.b2Id : node.b1Id;
  if (!teamAReady || !teamBReady) {
    throw httpError(400, "Both teams must be set before entering a score");
  }

  const leftScore = Math.trunc(Number(input?.leftScore ?? 0));
  const rightScore = Math.trunc(Number(input?.rightScore ?? 0));
  if (!Number.isFinite(leftScore) || !Number.isFinite(rightScore) || leftScore === rightScore) {
    throw httpError(400, "Scores must be valid and not tied");
  }

  // 生成正式比赛（走与管理员上报相同的归一化 + 直接入账）。
  const matchInput = {
    matchName: `${t.name} 第${node.round}轮`,
    dateISO: new Date().toISOString(),
    raceTo: t.raceTo,
    tag: dbTagToApi(t.tag),
    matchType: format === "DOUBLES" ? "doubles" : "singles",
    leftPlayerId: node.a1Id,
    rightPlayerId: node.b1Id,
    leftPlayer2Id: node.a2Id,
    rightPlayer2Id: node.b2Id,
    leftScore,
    rightScore,
  };
  const normalized = normalizeMatchInput(matchInput);

  const aWon = leftScore > rightScore;
  const winnerSide = aWon ? "A" : "B";

  await prisma.$transaction(async (tx) => {
    const created = await tx.match.create({
      data: {
        matchName: normalized.matchName,
        dateISO: normalized.dateISO,
        raceTo: normalized.raceTo,
        matchType: normalized.matchType,
        leftPlayerId: normalized.leftPlayerId,
        rightPlayerId: normalized.rightPlayerId,
        leftPlayer2Id: normalized.leftPlayer2Id ?? null,
        rightPlayer2Id: normalized.rightPlayer2Id ?? null,
        leftScore: normalized.leftScore,
        rightScore: normalized.rightScore,
        winnerId: normalized.winnerId,
        tag: normalized.tag,
        isHandicap: false,
        handicapGiverId: null,
        handicapReceiverId: null,
      },
    });

    await tx.tournamentMatch.update({
      where: { id: matchId },
      data: {
        leftScore,
        rightScore,
        winnerSide,
        status: "DONE",
        approvedMatchId: created.id,
      },
    });

    // 胜者晋级下一轮。
    if (node.nextMatchId) {
      const winnerTeam = aWon
        ? { p1: node.a1Id, p2: node.a2Id }
        : { p1: node.b1Id, p2: node.b2Id };
      const slotData = node.nextSlot === "A"
        ? { a1Id: winnerTeam.p1, a2Id: winnerTeam.p2 ?? null }
        : { b1Id: winnerTeam.p1, b2Id: winnerTeam.p2 ?? null };
      await tx.tournamentMatch.update({ where: { id: node.nextMatchId }, data: slotData });
    } else {
      // 决赛打完 → 赛事结束。
      await tx.tournament.update({ where: { id: t.id }, data: { status: "FINISHED" } });
    }
  });

  invalidateStatsCache();
  return getTournament(t.id);
}
