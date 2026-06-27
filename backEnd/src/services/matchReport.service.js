import { prisma } from "../lib/prisma.js";
import { httpError } from "../utils/httpError.js";
import { normalizeMatchInput } from "./matchInput.service.js";
import { serializeReport } from "./shape.service.js";
import { invalidateStatsCache } from "./stats.service.js";

function assertPlayerCanSubmit(user, match) {
  if (user.role === "ADMIN") return;

  if (!user.playerId) {
    throw httpError(403, "This account is not bound to a player");
  }

  const participants = [
    match.leftPlayerId,
    match.rightPlayerId,
    match.leftPlayer2Id,
    match.rightPlayer2Id,
  ].filter(Boolean);

  if (!participants.includes(user.playerId)) {
    throw httpError(403, "Players can only submit reports for matches they participated in");
  }
}

// 比赛/报告共用的列，集中一处避免双打字段遗漏。
function matchDataFromNormalized(match) {
  return {
    matchName: match.matchName,
    dateISO: match.dateISO,
    raceTo: match.raceTo,
    matchType: match.matchType ?? "SINGLES",
    leftPlayerId: match.leftPlayerId,
    rightPlayerId: match.rightPlayerId,
    leftPlayer2Id: match.leftPlayer2Id ?? null,
    rightPlayer2Id: match.rightPlayer2Id ?? null,
    leftScore: match.leftScore,
    rightScore: match.rightScore,
    winnerId: match.winnerId,
    tag: match.tag,
    isHandicap: match.isHandicap,
    handicapGiverId: match.handicapGiverId,
    handicapReceiverId: match.handicapReceiverId,
  };
}

const REPORT_INCLUDE = {
  submittedBy: { include: { player: true } },
  reviewedBy: { include: { player: true } },
};

export async function createMatchReport(input, user) {
  const match = normalizeMatchInput(input);
  assertPlayerCanSubmit(user, match);

  const matchData = matchDataFromNormalized(match);

  // 管理员上报免审核：直接生成正式比赛，并记一条已通过的报告，统计立即刷新。
  if (user.role === "ADMIN") {
    const report = await prisma.$transaction(async (tx) => {
      const created = await tx.match.create({ data: matchData });
      return tx.matchReport.create({
        data: {
          ...matchData,
          status: "APPROVED",
          submittedById: user.id,
          reviewedById: user.id,
          reviewedAt: new Date(),
          approvedMatchId: created.id,
        },
        include: REPORT_INCLUDE,
      });
    });

    invalidateStatsCache();
    return serializeReport(report);
  }

  // 球员上报进待审核队列。
  const report = await prisma.matchReport.create({
    data: { ...matchData, submittedById: user.id },
    include: REPORT_INCLUDE,
  });

  return serializeReport(report);
}

export async function listMatchReports(query = {}) {
  const where = {};
  if (query.status) where.status = String(query.status).toUpperCase();
  if (query.submittedById) where.submittedById = query.submittedById;

  const reports = await prisma.matchReport.findMany({
    where,
    include: { submittedBy: { include: { player: true } }, reviewedBy: { include: { player: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  return reports.map(serializeReport);
}

export async function listMyMatchReports(user) {
  const reports = await prisma.matchReport.findMany({
    where: { submittedById: user.id },
    include: { submittedBy: { include: { player: true } }, reviewedBy: { include: { player: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  return reports.map(serializeReport);
}

export async function approveMatchReport(reportId, reviewerId) {
  const result = await prisma.$transaction(async (tx) => {
    const report = await tx.matchReport.findUnique({ where: { id: reportId } });
    if (!report) throw httpError(404, "Match report not found");
    if (report.status !== "PENDING") throw httpError(409, "Only pending reports can be approved");

    const match = await tx.match.create({
      data: {
        matchName: report.matchName,
        dateISO: report.dateISO,
        raceTo: report.raceTo,
        matchType: report.matchType ?? "SINGLES",
        leftPlayerId: report.leftPlayerId,
        rightPlayerId: report.rightPlayerId,
        leftPlayer2Id: report.leftPlayer2Id ?? null,
        rightPlayer2Id: report.rightPlayer2Id ?? null,
        leftScore: report.leftScore,
        rightScore: report.rightScore,
        winnerId: report.winnerId,
        tag: report.tag,
        isHandicap: report.isHandicap,
        handicapGiverId: report.handicapGiverId,
        handicapReceiverId: report.handicapReceiverId,
      },
    });

    const updatedReport = await tx.matchReport.update({
      where: { id: reportId },
      data: {
        status: "APPROVED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        approvedMatchId: match.id,
      },
      include: { submittedBy: { include: { player: true } }, reviewedBy: { include: { player: true } } },
    });

    await tx.auditLog.create({
      data: {
        action: "MATCH_REPORT_APPROVED",
        actorId: reviewerId,
        targetId: reportId,
        detail: JSON.stringify({ approvedMatchId: match.id }),
      },
    });

    return updatedReport;
  });

  invalidateStatsCache();
  return serializeReport(result);
}

export async function rejectMatchReport(reportId, reviewerId, reason) {
  const result = await prisma.$transaction(async (tx) => {
    const report = await tx.matchReport.findUnique({ where: { id: reportId } });
    if (!report) throw httpError(404, "Match report not found");
    if (report.status !== "PENDING") throw httpError(409, "Only pending reports can be rejected");

    const updatedReport = await tx.matchReport.update({
      where: { id: reportId },
      data: {
        status: "REJECTED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: String(reason ?? "").trim() || null,
      },
      include: { submittedBy: { include: { player: true } }, reviewedBy: { include: { player: true } } },
    });

    await tx.auditLog.create({
      data: {
        action: "MATCH_REPORT_REJECTED",
        actorId: reviewerId,
        targetId: reportId,
        detail: JSON.stringify({ reason: updatedReport.rejectionReason }),
      },
    });

    return updatedReport;
  });

  return serializeReport(result);
}
