import { AI_TASKS } from "./aiContext.service.js";

const RACE_TO_VALUES = [3, 5, 7, 11, 15];
const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(safeNumber(value) * factor) / factor;
}

function dateMs(iso) {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : 0;
}

function daysBetween(laterISO, earlierISO) {
  const diff = dateMs(laterISO) - dateMs(earlierISO);
  return Number.isFinite(diff) ? Math.max(0, diff / DAY_MS) : 0;
}

function dateKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function noonISOFromDateKey(key) {
  return key ? `${key}T12:00:00.000Z` : "";
}

function average(values) {
  const numbers = values.map((value) => Number(value)).filter(Number.isFinite);
  if (!numbers.length) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function sortRecent(matches) {
  return [...matches].sort((a, b) => {
    const diff = dateMs(b.dateISO) - dateMs(a.dateISO);
    if (diff !== 0) return diff;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

function sortOldest(matches) {
  return [...matches].sort((a, b) => {
    const diff = dateMs(a.dateISO) - dateMs(b.dateISO);
    if (diff !== 0) return diff;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

function playerName(context, id) {
  return context.players.find((player) => player.id === id)?.name ?? "Unknown";
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

function perspective(match, playerId, context) {
  const isLeft = match.leftPlayerId === playerId;
  const opponentId = isLeft ? match.rightPlayerId : match.leftPlayerId;
  const myScore = isLeft ? safeNumber(match.leftScore) : safeNumber(match.rightScore);
  const opponentScore = isLeft ? safeNumber(match.rightScore) : safeNumber(match.leftScore);
  const margin = myScore - opponentScore;

  return {
    matchId: match.id,
    dateISO: match.dateISO,
    matchName: match.matchName ?? "Unnamed match",
    tag: match.tag,
    raceTo: match.raceTo,
    opponentId,
    opponentName: playerName(context, opponentId),
    myScore,
    opponentScore,
    margin,
    result: match.winnerId === playerId ? "win" : match.winnerId ? "loss" : "unknown",
    isHandicap: Boolean(match.isHandicap),
  };
}

function performanceAgainst(playerId, opponentId, matches) {
  const games = matches.filter((match) => isHeadToHead(match, playerId, opponentId));
  let wins = 0;
  let losses = 0;
  let racksFor = 0;
  let racksAgainst = 0;
  let marginTotal = 0;

  for (const match of games) {
    const isLeft = match.leftPlayerId === playerId;
    const myScore = isLeft ? safeNumber(match.leftScore) : safeNumber(match.rightScore);
    const opponentScore = isLeft ? safeNumber(match.rightScore) : safeNumber(match.leftScore);
    racksFor += myScore;
    racksAgainst += opponentScore;
    marginTotal += myScore - opponentScore;
    if (match.winnerId === playerId) wins += 1;
    else if (match.winnerId === opponentId) losses += 1;
  }

  const total = wins + losses;
  const racks = racksFor + racksAgainst;
  const winRate = total ? wins / total : 0;
  const rackShare = racks ? racksFor / racks : 0;
  const score = total ? (winRate - 0.5) * 0.7 + (rackShare - 0.5) * 0.3 : 0;

  return {
    opponentId,
    matches: games.length,
    wins,
    losses,
    winRate,
    racksFor,
    racksAgainst,
    rackShare,
    averageMargin: games.length ? marginTotal / games.length : 0,
    score,
  };
}

export function buildHeadToHeadStats(playerId, opponentId, matches = []) {
  const directMatches = sortRecent(matches.filter((match) => isHeadToHead(match, playerId, opponentId)));
  let playerWins = 0;
  let opponentWins = 0;
  let totalDiff = 0;
  let closeMatchCount = 0;
  let handicapCount = 0;

  for (const match of directMatches) {
    if (match.winnerId === playerId) playerWins += 1;
    if (match.winnerId === opponentId) opponentWins += 1;

    const view = perspective(match, playerId, { players: [] });
    const diff = Math.abs(view.margin);
    totalDiff += diff;
    if (diff <= 2) closeMatchCount += 1;
    if (match.isHandicap) handicapCount += 1;
  }

  return {
    total: directMatches.length,
    playerWins,
    opponentWins,
    playerWinRate: directMatches.length ? playerWins / directMatches.length : 0,
    opponentWinRate: directMatches.length ? opponentWins / directMatches.length : 0,
    lastWinnerId: directMatches[0]?.winnerId ?? null,
    averageScoreDiff: directMatches.length ? totalDiff / directMatches.length : 0,
    closeMatchCount,
    handicapCount,
    matchIds: directMatches.map((match) => match.id),
  };
}

function confidenceFromSamples(sampleCount) {
  if (sampleCount >= 10) return "high";
  if (sampleCount >= 4) return "medium";
  return "low";
}

function buildActivityProfile(context, playerId) {
  const matches = sortRecent(context.modeMatches.filter((match) => isPlayerInMatch(match, playerId)));
  const playDays = [...new Set(matches.map((match) => dateKey(match.dateISO)).filter(Boolean))].sort();
  const recentPlayDays = playDays.slice(-5);
  const gaps = [];

  for (let index = 1; index < playDays.length; index += 1) {
    gaps.push(daysBetween(noonISOFromDateKey(playDays[index]), noonISOFromDateKey(playDays[index - 1])));
  }

  const recentGaps = [];
  for (let index = 1; index < recentPlayDays.length; index += 1) {
    recentGaps.push(daysBetween(noonISOFromDateKey(recentPlayDays[index]), noonISOFromDateKey(recentPlayDays[index - 1])));
  }

  const lastPlayDay = playDays[playDays.length - 1] ?? "";
  const lastPlayedDaysAgo = lastPlayDay ? daysBetween(new Date().toISOString(), noonISOFromDateKey(lastPlayDay)) : null;
  const recentPracticeCount = matches.slice(0, 5).filter((match) => match.tag === "practice").length;
  const recentLiveCount = matches.slice(0, 5).filter((match) => match.tag === "live").length;
  const avgGapDays = average(gaps);
  const recentAvgGapDays = average(recentGaps);

  let activityLabel = "样本不足";
  if (matches.length >= 2) {
    if (recentAvgGapDays && avgGapDays && recentAvgGapDays <= avgGapDays * 0.65) activityLabel = "最近打得更频繁";
    else if (recentAvgGapDays && avgGapDays && recentAvgGapDays >= avgGapDays * 1.5) activityLabel = "最近打得更少";
    else activityLabel = "打球频率稳定";
  }

  return {
    totalMatches: matches.length,
    totalPlayDays: playDays.length,
    recentPlayDays,
    lastPlayedDaysAgo: lastPlayedDaysAgo == null ? null : round(lastPlayedDaysAgo, 1),
    averageGapDays: round(avgGapDays, 1),
    recentAverageGapDays: round(recentAvgGapDays, 1),
    recentPracticeCount,
    recentLiveCount,
    activityLabel,
  };
}

function buildRecentFive(context, playerId) {
  return sortRecent(context.modeMatches.filter((match) => isPlayerInMatch(match, playerId)))
    .slice(0, 5)
    .map((match) => perspective(match, playerId, context));
}

function buildRatingTrend(context, history) {
  const points = Array.isArray(history?.points) ? history.points : [];
  const recentPoints = points.slice(-5).map((point) => ({
    matchId: point.matchId,
    dateISO: point.dateISO,
    opponentId: point.opponentId,
    opponentName: playerName(context, point.opponentId),
    myScore: point.myScore,
    opponentScore: point.opponentScore,
    rating: round(point.rating, 1),
    delta: round(point.delta, 1),
  }));
  const recentDelta = recentPoints.reduce((sum, point) => sum + safeNumber(point.delta), 0);
  const positiveCount = recentPoints.filter((point) => point.delta > 0).length;
  const negativeCount = recentPoints.filter((point) => point.delta < 0).length;

  return {
    startRating: round(history?.startRating ?? 500, 1),
    currentRating: round(history?.currentRating ?? 500, 1),
    netChange: round(history?.netChange ?? 0, 1),
    recentDelta: round(recentDelta, 1),
    positiveCount,
    negativeCount,
    recentPoints,
  };
}

function buildRestBuckets(playerMatches, playerId) {
  const chronological = sortOldest(playerMatches);
  const buckets = [
    { id: "0-2", label: "0-2 天", min: 0, max: 2, wins: 0, losses: 0, margins: [] },
    { id: "3-6", label: "3-6 天", min: 3, max: 6, wins: 0, losses: 0, margins: [] },
    { id: "7-13", label: "7-13 天", min: 7, max: 13, wins: 0, losses: 0, margins: [] },
    { id: "14+", label: "14 天以上", min: 14, max: Infinity, wins: 0, losses: 0, margins: [] },
  ];

  for (let index = 1; index < chronological.length; index += 1) {
    const previous = chronological[index - 1];
    const current = chronological[index];
    const gap = daysBetween(current.dateISO, previous.dateISO);
    const bucket = buckets.find((item) => gap >= item.min && gap <= item.max);
    if (!bucket) continue;

    const view = perspective(current, playerId, { players: [] });
    if (current.winnerId === playerId) bucket.wins += 1;
    else if (current.winnerId) bucket.losses += 1;
    bucket.margins.push(view.margin);
  }

  return buckets.map((bucket) => {
    const total = bucket.wins + bucket.losses;
    return {
      id: bucket.id,
      label: bucket.label,
      wins: bucket.wins,
      losses: bucket.losses,
      total,
      winRate: total ? bucket.wins / total : 0,
      averageMargin: round(average(bucket.margins), 1),
    };
  });
}

function buildNextVisitOutlook(context, playerId, recentFive, ratingTrend) {
  const playerMatches = sortRecent(context.modeMatches.filter((match) => isPlayerInMatch(match, playerId)));
  const restBuckets = buildRestBuckets(playerMatches, playerId);
  const bestBucket = [...restBuckets]
    .filter((bucket) => bucket.total > 0)
    .sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.averageMargin !== a.averageMargin) return b.averageMargin - a.averageMargin;
      return b.total - a.total;
    })[0] ?? null;
  const recentWins = recentFive.filter((match) => match.result === "win").length;
  const recentWinRate = recentFive.length ? recentWins / recentFive.length : 0;
  const recentAverageMargin = average(recentFive.map((match) => match.margin));
  const predictedWinProbability = clamp(
    50 + (recentWinRate - 0.5) * 35 + recentAverageMargin * 2 + safeNumber(ratingTrend.recentDelta) * 0.35,
    5,
    95,
  );

  let outlook = "五五开";
  if (predictedWinProbability >= 62) outlook = "更可能赢多";
  else if (predictedWinProbability <= 42) outlook = "更可能输多";

  return {
    predictedWinProbability: round(predictedWinProbability, 1),
    outlook,
    recentWinRate: round(recentWinRate, 3),
    recentAverageMargin: round(recentAverageMargin, 1),
    recommendedRestWindow: bestBucket?.label ?? "样本不足",
    bestRestBucket: bestBucket,
    restBuckets,
  };
}

export function buildPlayerBaseline(context) {
  const recentFive = buildRecentFive(context, context.selectedPlayer.id);
  const activity = buildActivityProfile(context, context.selectedPlayer.id);
  const ratingTrend = buildRatingTrend(context, context.selectedPlayerRatingHistory);
  const nextVisitOutlook = buildNextVisitOutlook(context, context.selectedPlayer.id, recentFive, ratingTrend);
  const wins = recentFive.filter((match) => match.result === "win").length;
  const losses = recentFive.filter((match) => match.result === "loss").length;
  const cautions = [...context.insufficientDataReasons];
  const summaryPoints = [
    `${context.selectedPlayer.name} 最近 5 场为 ${wins} 胜 ${losses} 负，平均分差 ${round(average(recentFive.map((match) => match.margin)), 1)}。`,
    `最近打球频率：${activity.activityLabel}，最近平均间隔 ${activity.recentAverageGapDays || 0} 天，生涯平均间隔 ${activity.averageGapDays || 0} 天。`,
    `最近 5 次街灯榜变化合计 ${ratingTrend.recentDelta > 0 ? "+" : ""}${ratingTrend.recentDelta}。`,
    `下次去俱乐部的状态预测：${nextVisitOutlook.outlook}，建议参考休息窗口 ${nextVisitOutlook.recommendedRestWindow}。`,
  ];

  return {
    playerId: context.selectedPlayer.id,
    confidence: confidenceFromSamples(recentFive.length),
    summaryPoints,
    cautions,
    activity,
    recentFive,
    ratingTrend,
    nextVisitOutlook,
    evidenceMatchIds: context.evidenceMatches.map((match) => match.id),
  };
}

function recentFormValue(context, playerId) {
  const recent = buildRecentFive(context, playerId);
  if (!recent.length) return 0;
  const winRate = recent.filter((match) => match.result === "win").length / recent.length;
  const margin = average(recent.map((match) => match.margin));
  return (winRate - 0.5) * 0.45 + clamp(margin / 20, -0.35, 0.35) * 0.55;
}

function buildCommonOpponentComparisons(context, playerId, opponentId) {
  return context.players
    .filter((player) => player.id !== playerId && player.id !== opponentId)
    .map((commonOpponent) => {
      const playerPerf = performanceAgainst(playerId, commonOpponent.id, context.modeMatches);
      const opponentPerf = performanceAgainst(opponentId, commonOpponent.id, context.modeMatches);
      if (!playerPerf.matches || !opponentPerf.matches) return null;
      const edge = playerPerf.score - opponentPerf.score;
      return {
        opponentId: commonOpponent.id,
        opponentName: commonOpponent.name,
        player: playerPerf,
        comparedPlayer: opponentPerf,
        edge: round(edge, 3),
        edgeOwnerId: edge >= 0 ? playerId : opponentId,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))
    .slice(0, 12);
}

function buildMatchupModel(context, playerId, opponentId) {
  const direct = buildHeadToHeadStats(playerId, opponentId, context.modeMatches);
  const commonOpponents = buildCommonOpponentComparisons(context, playerId, opponentId);
  const directComponent = direct.total ? (direct.playerWinRate - 0.5) * Math.min(0.42, 0.18 + direct.total * 0.04) : 0;
  const commonComponent = commonOpponents.length
    ? clamp(average(commonOpponents.map((item) => item.edge)), -0.5, 0.5) * 0.55
    : 0;
  const recentComponent = (recentFormValue(context, playerId) - recentFormValue(context, opponentId)) * 0.25;
  const raw = 0.5 + directComponent + commonComponent + recentComponent;
  const playerWinProbability = clamp(raw * 100, 5, 95);
  const sampleCount = direct.total + commonOpponents.reduce((sum, item) => sum + Math.min(item.player.matches, item.comparedPlayer.matches), 0);

  return {
    playerId,
    playerName: playerName(context, playerId),
    opponentId,
    opponentName: playerName(context, opponentId),
    playerWinProbability: round(playerWinProbability, 1),
    opponentWinProbability: round(100 - playerWinProbability, 1),
    confidence: confidenceFromSamples(sampleCount),
    direct,
    commonOpponents,
    components: {
      direct: round(directComponent, 3),
      commonOpponents: round(commonComponent, 3),
      recentForm: round(recentComponent, 3),
      sampleCount,
    },
  };
}

function categorizeRecommendation(model) {
  if (model.playerWinProbability >= 58) return "stabilize";
  if (model.playerWinProbability <= 44) return "challenge";
  return "balanced";
}

function categoryDistance(model, category) {
  if (category === "balanced") return Math.abs(model.playerWinProbability - 50);
  if (category === "challenge") return Math.abs(model.playerWinProbability - 38);
  return Math.abs(model.playerWinProbability - 68);
}

function categoryLabel(category) {
  if (category === "challenge") return "向上挑战";
  if (category === "stabilize") return "稳住状态";
  return "均衡对局";
}

function categoryDescription(category) {
  if (category === "challenge") return "比你更难打，适合测试上限和找短板。";
  if (category === "stabilize") return "你胜率更高，适合恢复手感和稳住状态。";
  return "胜率接近，适合打得胶着、检验临场稳定性。";
}

function sortCategoryItems(category) {
  return (a, b) => {
    const distanceDiff = categoryDistance(a, category) - categoryDistance(b, category);
    if (distanceDiff !== 0) return distanceDiff;
    return b.components.sampleCount - a.components.sampleCount;
  };
}

function expectedRackWinRate(myR, oppR, D = 200) {
  return 1 / (1 + Math.pow(10, (oppR - myR) / D));
}

function projectedDelta(context, playerScore, opponentScore) {
  const playerRow = context.leaderboardRows.find((row) => row.id === context.selectedPlayer.id);
  const opponentRow = context.leaderboardRows.find((row) => row.id === context.opponent.id);
  const playerRating = safeNumber(playerRow?.rating, 500);
  const opponentRating = safeNumber(opponentRow?.rating, 500);
  const playerPlayed = safeNumber(playerRow?.played);
  const opponentPlayed = safeNumber(opponentRow?.played);
  const totalRacks = playerScore + opponentScore;
  const expected = expectedRackWinRate(playerRating, opponentRating);
  const actual = totalRacks > 0 ? playerScore / totalRacks : 0.5;
  const robustPlayer = 1 / Math.sqrt(1 + playerPlayed / 10);
  const robustOpponent = 1 / Math.sqrt(1 + opponentPlayed / 10);

  const rankMap = new Map(context.leaderboardRows.map((row, index) => [row.id, index + 1]));
  const playerRank = rankMap.get(context.selectedPlayer.id) ?? 0;
  const opponentRank = rankMap.get(context.opponent.id) ?? 0;
  const rankDiff = Math.abs(playerRank - opponentRank);
  const tier = rankDiff >= 15 ? 3 : rankDiff >= 10 ? 2 : rankDiff >= 5 ? 1 : 0;
  const weights = {
    higher: [1.0, 0.8, 0.6, 0.4],
    upset: [1.0, 1.2, 1.4, 1.6],
  };
  let matchWeight = weights.higher[tier];
  if (tier > 0 && playerRank && opponentRank && playerRank !== opponentRank) {
    const playerIsHigherRank = playerRank < opponentRank;
    const playerWon = playerScore > opponentScore;
    const higherWon = (playerIsHigherRank && playerWon) || (!playerIsHigherRank && !playerWon);
    matchWeight = higherWon ? weights.higher[tier] : weights.upset[tier];
  }

  const delta = 40 * (actual - expected) * matchWeight;
  return {
    playerDelta: round(delta * robustPlayer, 1),
    opponentDelta: round(-delta * robustOpponent, 1),
    expectedRackWinRate: round(expected, 3),
    weight: matchWeight,
  };
}

function buildScoreDeltaTable(context) {
  return RACE_TO_VALUES.map((raceTo) => {
    const scorelines = [];
    for (let loserScore = 0; loserScore < raceTo; loserScore += 1) {
      scorelines.push({
        raceTo,
        score: `${raceTo}-${loserScore}`,
        winnerId: context.selectedPlayer.id,
        ...projectedDelta(context, raceTo, loserScore),
      });
      scorelines.push({
        raceTo,
        score: `${loserScore}-${raceTo}`,
        winnerId: context.opponent.id,
        ...projectedDelta(context, loserScore, raceTo),
      });
    }
    return { raceTo, scorelines };
  });
}

export function buildMatchupBaseline(context) {
  const matchupModel = buildMatchupModel(context, context.selectedPlayer.id, context.opponent.id);
  const advantagePlayerId = matchupModel.playerWinProbability >= matchupModel.opponentWinProbability
    ? context.selectedPlayer.id
    : context.opponent.id;

  return {
    playerId: context.selectedPlayer.id,
    opponentId: context.opponent.id,
    confidence: matchupModel.confidence,
    matchupModel,
    scoreDeltaTable: buildScoreDeltaTable(context),
    headToHead: {
      ...matchupModel.direct,
      advantagePlayerId,
      advantagePlayerName: playerName(context, advantagePlayerId),
    },
    reasons: [
      `${context.selectedPlayer.name} 预测胜率 ${matchupModel.playerWinProbability}%，${context.opponent.name} 预测胜率 ${matchupModel.opponentWinProbability}%。`,
      `共同对手样本 ${matchupModel.commonOpponents.length} 个，直接交手 ${matchupModel.direct.total} 场。`,
    ],
    cautions: [...context.insufficientDataReasons],
    evidenceMatchIds: context.evidenceMatches.map((match) => match.id),
  };
}

export function buildOpponentRecommendationBaseline(context) {
  const allRecommendations = context.players
    .filter((player) => player.id !== context.selectedPlayer.id)
    .map((player) => buildMatchupModel(context, context.selectedPlayer.id, player.id))
    .filter((model) => model.direct.total > 0 || model.commonOpponents.length > 0)
    .sort((a, b) => {
      if (b.playerWinProbability !== a.playerWinProbability) return b.playerWinProbability - a.playerWinProbability;
      return b.components.sampleCount - a.components.sampleCount;
    });

  const categories = ["balanced", "challenge", "stabilize"].map((category) => {
    let items = allRecommendations
      .filter((model) => categorizeRecommendation(model) === category)
      .sort(sortCategoryItems(category))
      .slice(0, 5);

    if (items.length === 0) {
      items = allRecommendations
        .filter((model) => {
          if (category === "balanced") return model.playerWinProbability > 44 && model.playerWinProbability < 58;
          if (category === "challenge") return model.playerWinProbability < 50;
          return model.playerWinProbability > 50;
        })
        .sort(sortCategoryItems(category))
        .slice(0, 5);
    }

    return {
      category,
      label: categoryLabel(category),
      description: categoryDescription(category),
      items,
    };
  });

  const recommendations = allRecommendations.slice(0, 5);
  const balancedBest = categories.find((item) => item.category === "balanced")?.items[0];
  const best = balancedBest ?? recommendations[0] ?? null;

  return {
    recommendedOpponentId: best?.opponentId ?? null,
    recommendedOpponentName: best?.opponentName ?? null,
    confidence: best?.confidence ?? "low",
    recommendations,
    recommendationCategories: categories,
    reasons: best
      ? [`按比赛记录交叉比较，已分成均衡对局、向上挑战、稳住状态三类。默认优先展示均衡对局：${best.opponentName}，预测胜率 ${best.playerWinProbability}%。`]
      : ["没有足够的直接交手或共同对手数据来推荐。"],
    cautions: [...context.insufficientDataReasons],
    evidenceMatchIds: context.evidenceMatches.map((match) => match.id),
  };
}

export function buildAiBaseline(context) {
  if (context.task === AI_TASKS.PLAYER_ANALYSIS) return buildPlayerBaseline(context);
  if (context.task === AI_TASKS.MATCHUP_ANALYSIS) return buildMatchupBaseline(context);
  return buildOpponentRecommendationBaseline(context);
}

export function baselineEvidence(context) {
  return context.evidenceMatches.map((match) => ({
    matchId: match.id,
    reason: "本场比赛用于最近状态、交叉对手或直接对阵分析。",
  }));
}

export function getRecommendationEvidenceMatches(context, recommendationIds = []) {
  const ids = new Set([context.selectedPlayer.id, ...recommendationIds]);
  return context.modeMatches.filter((match) => ids.has(match.leftPlayerId) || ids.has(match.rightPlayerId));
}
