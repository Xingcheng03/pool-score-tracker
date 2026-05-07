import { prisma } from "../lib/prisma.js";
import { httpError } from "../utils/httpError.js";
import { AI_TASKS } from "./aiContext.service.js";
import { randomUUID } from "node:crypto";

export const AI_REPORT_LIMITS = {
  [AI_TASKS.PLAYER_ANALYSIS]: 1,
  [AI_TASKS.MATCHUP_ANALYSIS]: 2,
  [AI_TASKS.OPPONENT_RECOMMENDATION]: 1,
};

const AI_REPORT_LABELS = {
  [AI_TASKS.PLAYER_ANALYSIS]: "球员状态报告",
  [AI_TASKS.MATCHUP_ANALYSIS]: "对阵分析报告",
  [AI_TASKS.OPPONENT_RECOMMENDATION]: "推荐对手报告",
};

const EMPTY_CYCLE_KEY = "no-approved-match";
let tableReady = false;

async function ensureAiReportTable() {
  if (tableReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AiReport" (
      "id" TEXT PRIMARY KEY,
      "playerId" TEXT NOT NULL REFERENCES "Player"("id") ON DELETE CASCADE,
      "reportType" TEXT NOT NULL,
      "opponentId" TEXT REFERENCES "Player"("id") ON DELETE SET NULL,
      "cycleKey" TEXT NOT NULL,
      "cycleMatchId" TEXT REFERENCES "Match"("id") ON DELETE SET NULL,
      "generatedById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
      "request" JSONB NOT NULL,
      "response" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AiReport_playerId_cycleKey_reportType_idx" ON "AiReport"("playerId", "cycleKey", "reportType")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AiReport_playerId_createdAt_idx" ON "AiReport"("playerId", "createdAt")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AiReport_generatedById_idx" ON "AiReport"("generatedById")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AiReport_opponentId_idx" ON "AiReport"("opponentId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AiReport_cycleMatchId_idx" ON "AiReport"("cycleMatchId")');

  tableReady = true;
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactResponseMatchLabel(match) {
  const score = `${match.leftScore ?? "-"} - ${match.rightScore ?? "-"}`;
  return `${match.matchName ?? "这场比赛"}（${match.leftPlayerName ?? "左侧球员"} ${score} ${match.rightPlayerName ?? "右侧球员"}）`;
}

function replaceVisibleMatchIds(value, idLabels) {
  if (value == null) return value;

  let text = String(value);
  for (const [matchId, label] of idLabels.entries()) {
    const pattern = new RegExp(`(?:比赛\\s*ID\\s*[:：]?\\s*)?${escapeRegExp(matchId)}`, "g");
    text = text.replace(pattern, label);
  }

  return text;
}

function sanitizeStoredResponse(response) {
  if (!response || typeof response !== "object") return response;

  const evidenceMatches = Array.isArray(response.evidence?.matches) ? response.evidence.matches : [];
  const idLabels = new Map(
    evidenceMatches
      .filter((match) => match?.id)
      .map((match) => [match.id, compactResponseMatchLabel(match)]),
  );

  if (idLabels.size === 0 || !response.analysis || typeof response.analysis !== "object") {
    return response;
  }

  const clean = (value) => replaceVisibleMatchIds(value, idLabels);
  const analysis = response.analysis;

  return {
    ...response,
    analysis: {
      ...analysis,
      summary: clean(analysis.summary),
      playerForm: clean(analysis.playerForm),
      rankingSuggestion: clean(analysis.rankingSuggestion),
      recommendedOpponent: analysis.recommendedOpponent && typeof analysis.recommendedOpponent === "object"
        ? {
          ...analysis.recommendedOpponent,
          reason: clean(analysis.recommendedOpponent.reason),
        }
        : analysis.recommendedOpponent,
      headToHead: analysis.headToHead && typeof analysis.headToHead === "object"
        ? {
          ...analysis.headToHead,
          rationale: clean(analysis.headToHead.rationale),
        }
        : analysis.headToHead,
      cautions: Array.isArray(analysis.cautions) ? analysis.cautions.map(clean) : analysis.cautions,
      evidence: Array.isArray(analysis.evidence)
        ? analysis.evidence.map((item) => ({
          ...item,
          reason: clean(item.reason),
        }))
        : analysis.evidence,
    },
  };
}

function assertKnownReportType(reportType) {
  if (!Object.hasOwn(AI_REPORT_LIMITS, reportType)) {
    throw httpError(400, "Invalid AI report type");
  }
}

function assertCanUsePlayer(user, requestedPlayerId) {
  const playerId = String(requestedPlayerId ?? user.playerId ?? "").trim();

  if (!playerId) {
    throw httpError(403, "当前账号还没有绑定球员，无法生成 AI 报告");
  }

  if (user.role !== "ADMIN" && user.playerId !== playerId) {
    throw httpError(403, "只能为当前登录账号绑定的球员生成 AI 报告");
  }

  return playerId;
}

async function getCurrentCycle(playerId) {
  const latestMatch = await prisma.match.findFirst({
    where: {
      OR: [
        { leftPlayerId: playerId },
        { rightPlayerId: playerId },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      matchName: true,
      dateISO: true,
      createdAt: true,
    },
  });

  return {
    key: latestMatch?.id ?? EMPTY_CYCLE_KEY,
    latestMatch: latestMatch
      ? {
        id: latestMatch.id,
        matchName: latestMatch.matchName,
        dateISO: iso(latestMatch.dateISO),
        approvedAt: iso(latestMatch.createdAt),
      }
      : null,
  };
}

function emptyQuota() {
  return Object.fromEntries(
    Object.entries(AI_REPORT_LIMITS).map(([reportType, limit]) => [
      reportType,
      {
        reportType,
        label: AI_REPORT_LABELS[reportType],
        limit,
        used: 0,
        remaining: limit,
        canGenerate: true,
      },
    ]),
  );
}

function serializeReport(record) {
  if (!record) return null;

  const response = sanitizeStoredResponse(record.response && typeof record.response === "object" ? record.response : {});
  const generatedAt = iso(record.createdAt);

  return {
    ...response,
    generatedAt: response.generatedAt ?? generatedAt,
    reportMeta: {
      id: record.id,
      reportType: record.reportType,
      playerId: record.playerId,
      opponentId: record.opponentId,
      cycleKey: record.cycleKey,
      cycleMatchId: record.cycleMatchId,
      generatedAt,
    },
  };
}

export async function getAiReportStateForPlayer(playerId) {
  await ensureAiReportTable();
  const cycle = await getCurrentCycle(playerId);
  const reports = await prisma.$queryRaw`
    SELECT
      "id",
      "playerId",
      "reportType",
      "opponentId",
      "cycleKey",
      "cycleMatchId",
      "generatedById",
      "request",
      "response",
      "createdAt"
    FROM "AiReport"
    WHERE "playerId" = ${playerId} AND "cycleKey" = ${cycle.key}
    ORDER BY "createdAt" DESC, "id" DESC
  `;

  const quota = emptyQuota();
  const latestReports = {};
  const reportHistory = Object.fromEntries(Object.keys(AI_REPORT_LIMITS).map((reportType) => [reportType, []]));

  for (const report of reports) {
    if (!quota[report.reportType]) continue;
    quota[report.reportType].used += 1;
    reportHistory[report.reportType].push(serializeReport(report));
    if (!latestReports[report.reportType]) {
      latestReports[report.reportType] = serializeReport(report);
    }
  }

  for (const item of Object.values(quota)) {
    item.remaining = Math.max(0, item.limit - item.used);
    item.canGenerate = item.remaining > 0;
  }

  return {
    cycle,
    quota,
    reports: latestReports,
    reportHistory,
  };
}

export async function getAiReportStateForUser(user) {
  if (!user.playerId) {
    return {
      cycle: null,
      quota: emptyQuota(),
      reports: {},
      reportHistory: Object.fromEntries(Object.keys(AI_REPORT_LIMITS).map((reportType) => [reportType, []])),
    };
  }

  return getAiReportStateForPlayer(user.playerId);
}

export async function generateLimitedAiReport({ user, reportType, input, generate }) {
  assertKnownReportType(reportType);
  const playerId = assertCanUsePlayer(user, input.playerId);
  const opponentId = reportType === AI_TASKS.MATCHUP_ANALYSIS ? String(input.opponentId ?? "").trim() : null;

  if (reportType === AI_TASKS.MATCHUP_ANALYSIS && !opponentId) {
    throw httpError(400, "opponentId is required");
  }

  if (opponentId && opponentId === playerId) {
    throw httpError(400, "Choose two different players");
  }

  const beforeState = await getAiReportStateForPlayer(playerId);
  const typeQuota = beforeState.quota[reportType];

  if (!typeQuota.canGenerate) {
    throw httpError(
      429,
      `${typeQuota.label}本周期已达到上限。等该球员下一场比赛上报并由管理员通过后，才能再次生成。`,
    );
  }

  const request = {
    ...input,
    playerId,
    opponentId,
  };
  const response = await generate(request);
  const generatedAt = new Date().toISOString();
  const responsePayload = { ...response, generatedAt };
  const id = randomUUID();
  const cycleMatchId = beforeState.cycle.latestMatch?.id ?? null;
  const [record] = await prisma.$queryRaw`
    INSERT INTO "AiReport" (
      "id",
      "playerId",
      "reportType",
      "opponentId",
      "cycleKey",
      "cycleMatchId",
      "generatedById",
      "request",
      "response"
    )
    VALUES (
      ${id},
      ${playerId},
      ${reportType},
      ${opponentId},
      ${beforeState.cycle.key},
      ${cycleMatchId},
      ${user.id},
      ${JSON.stringify(request)}::jsonb,
      ${JSON.stringify(responsePayload)}::jsonb
    )
    RETURNING
      "id",
      "playerId",
      "reportType",
      "opponentId",
      "cycleKey",
      "cycleMatchId",
      "generatedById",
      "request",
      "response",
      "createdAt"
  `;

  const nextState = await getAiReportStateForPlayer(playerId);
  return {
    ...serializeReport(record),
    quotaState: nextState,
  };
}
