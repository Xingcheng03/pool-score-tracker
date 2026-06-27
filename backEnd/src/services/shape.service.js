export function dbTagToApi(tag) {
  return tag === "LIVE" ? "live" : "practice";
}

export function apiTagToDb(tag) {
  return tag === "live" ? "LIVE" : "PRACTICE";
}

export function serializeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    playerId: user.playerId,
    player: user.player
      ? {
          id: user.player.id,
          name: user.player.name,
        }
      : null,
    createdAt: user.createdAt?.toISOString?.() ?? user.createdAt,
    updatedAt: user.updatedAt?.toISOString?.() ?? user.updatedAt,
  };
}

export function serializePlayer(player, opts = {}) {
  if (!player) return null;

  const result = {
    id: player.id,
    name: player.name,
    hidden: player.hidden ?? false,
    retired: player.retired ?? false,
    retirementNote: player.retirementNote ?? null,
    retiredAt: player.retiredAt?.toISOString?.() ?? player.retiredAt ?? null,
    createdAt: player.createdAt?.toISOString?.() ?? player.createdAt,
    updatedAt: player.updatedAt?.toISOString?.() ?? player.updatedAt,
  };

  if (player.highlightMatches) {
    result.highlightMatchIds = player.highlightMatches.map((m) => m.id);
  }

  if (opts.includeAccount) {
    result.account = player.user
      ? {
          id: player.user.id,
          username: player.user.username,
          role: player.user.role,
        }
      : null;
  }

  return result;
}

export function serializeMatch(match) {
  if (!match) return null;

  return {
    id: match.id,
    matchName: match.matchName,
    dateISO: match.dateISO?.toISOString?.() ?? match.dateISO,
    raceTo: match.raceTo,
    leftPlayerId: match.leftPlayerId,
    rightPlayerId: match.rightPlayerId,
    leftPlayer2Id: match.leftPlayer2Id ?? null,
    rightPlayer2Id: match.rightPlayer2Id ?? null,
    matchType: match.matchType === "DOUBLES" ? "doubles" : "singles",
    leftScore: match.leftScore,
    rightScore: match.rightScore,
    winnerId: match.winnerId,
    tag: dbTagToApi(match.tag),
    isHandicap: Boolean(match.isHandicap),
    handicapGiverId: match.handicapGiverId,
    handicapReceiverId: match.handicapReceiverId,
    createdAt: match.createdAt?.toISOString?.() ?? match.createdAt,
    updatedAt: match.updatedAt?.toISOString?.() ?? match.updatedAt,
  };
}

export function serializeShameRecord(record) {
  if (!record) return null;

  return {
    id: record.id,
    dateISO: record.dateISO?.toISOString?.() ?? record.dateISO,
    pins: record.pins,
    loser: record.loser ? { id: record.loser.id, name: record.loser.name } : null,
    participants: (record.participants ?? []).map((p) => ({ id: p.id, name: p.name })),
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
  };
}

export function serializeReport(report) {
  if (!report) return null;

  return {
    ...serializeMatch(report),
    status: report.status,
    submittedById: report.submittedById,
    reviewedById: report.reviewedById,
    reviewedAt: report.reviewedAt?.toISOString?.() ?? report.reviewedAt,
    rejectionReason: report.rejectionReason,
    approvedMatchId: report.approvedMatchId,
    submittedBy: report.submittedBy ? serializeUser(report.submittedBy) : undefined,
    reviewedBy: report.reviewedBy ? serializeUser(report.reviewedBy) : undefined,
  };
}
