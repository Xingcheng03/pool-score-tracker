const SEASON_START_YEAR = 2025;
const SEASON_START_MONTH = 9; // October, zero-based.
const SEASON_MONTHS = 3;

// 双打进入街灯榜 Rating 的权重系数（相对单打）。娱乐向、影响略小，可调。
const DOUBLES_RATING_WEIGHT = 0.5;

export function normalizeTag(tag) {
  return tag === "live" ? "live" : "practice";
}

// 老数据无 matchType，默认单打。
function isSinglesMatch(match) {
  return match?.matchType !== "DOUBLES" && match?.matchType !== "doubles";
}

function isDoublesMatch(match) {
  return !isSinglesMatch(match);
}

function monthIndex(year, month) {
  return year * 12 + month;
}

function seasonStartMonthIndex(seasonNumber) {
  return monthIndex(SEASON_START_YEAR, SEASON_START_MONTH) + (seasonNumber - 1) * SEASON_MONTHS;
}

function monthIndexToYearMonth(index) {
  return {
    year: Math.floor(index / 12),
    month: index % 12,
  };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function normalizeSeasonId(seasonId) {
  const text = String(seasonId ?? "all");
  const match = text.match(/^season-(\d+)$/);
  if (!match) return "all";

  const seasonNumber = Number(match[1]);
  return Number.isInteger(seasonNumber) && seasonNumber >= 1 ? `season-${seasonNumber}` : "all";
}

export function getSeasonNumberFromDate(dateISO) {
  const date = new Date(dateISO);
  if (Number.isNaN(date.getTime())) return null;

  const currentMonthIndex = monthIndex(date.getFullYear(), date.getMonth());
  const firstMonthIndex = monthIndex(SEASON_START_YEAR, SEASON_START_MONTH);
  if (currentMonthIndex < firstMonthIndex) return null;

  return Math.floor((currentMonthIndex - firstMonthIndex) / SEASON_MONTHS) + 1;
}

export function getSeasonDateRange(seasonId) {
  const normalized = normalizeSeasonId(seasonId);
  if (normalized === "all") return null;

  const seasonNumber = Number(normalized.replace("season-", ""));
  const startIndex = seasonStartMonthIndex(seasonNumber);
  const endIndex = startIndex + SEASON_MONTHS - 1;
  const start = monthIndexToYearMonth(startIndex);
  const end = monthIndexToYearMonth(endIndex);

  return {
    seasonId: normalized,
    seasonNumber,
    startYear: start.year,
    startMonth: start.month,
    endYear: end.year,
    endMonth: end.month,
    startLabel: `${start.year}/${pad2(start.month + 1)}`,
    endLabel: `${end.year}/${pad2(end.month + 1)}`,
  };
}

export function seasonLabel(seasonId) {
  const range = getSeasonDateRange(seasonId);
  if (!range) return "全部赛季";
  return `第${range.seasonNumber}赛季（${range.startLabel}-${range.endLabel}）`;
}

export function filterMatchesBySeason(matches, seasonId = "all") {
  const normalized = normalizeSeasonId(seasonId);
  if (normalized === "all") return matches;

  const expectedSeasonNumber = Number(normalized.replace("season-", ""));
  return matches.filter((match) => getSeasonNumberFromDate(match.dateISO) === expectedSeasonNumber);
}

export function getAvailableSeasons(matchesInput = []) {
  const matches = Array.isArray(matchesInput) ? matchesInput : [];
  const seasonNumbers = matches
    .map((match) => getSeasonNumberFromDate(match.dateISO))
    .filter((seasonNumber) => Number.isInteger(seasonNumber) && seasonNumber >= 1);

  const currentSeasonNumber = getSeasonNumberFromDate(new Date().toISOString());
  if (Number.isInteger(currentSeasonNumber) && currentSeasonNumber >= 1) {
    seasonNumbers.push(currentSeasonNumber);
  }

  const maxSeasonNumber = Math.max(1, ...seasonNumbers);
  return Array.from({ length: maxSeasonNumber }, (_, index) => {
    const seasonId = `season-${index + 1}`;
    return {
      id: seasonId,
      label: seasonLabel(seasonId),
      ...getSeasonDateRange(seasonId),
    };
  });
}

// 球员参与的比赛：单打看左右，双打也看 player2。两者都算进去。
function playerOnLeft(m, playerId) {
  return m.leftPlayerId === playerId || m.leftPlayer2Id === playerId;
}
function playerOnRight(m, playerId) {
  return m.rightPlayerId === playerId || m.rightPlayer2Id === playerId;
}

export function getMatchesForPlayer(playerId, tag = "all", matchesOverride = []) {
  let filtered = matchesOverride.filter((m) => playerOnLeft(m, playerId) || playerOnRight(m, playerId));

  if (tag !== "all") {
    const t = normalizeTag(tag);
    filtered = filtered.filter((m) => normalizeTag(m.tag) === t);
  }

  return filtered;
}

function handicapStatsFactor(match, playerId) {
  if (!match?.isHandicap) return 1;
  if (!match?.winnerId) return 1;

  const giverId = match.handicapGiverId;
  const receiverId = match.handicapReceiverId;
  if (!giverId || !receiverId) return 1;

  const receiverWon = match.winnerId === receiverId;
  if (!receiverWon) return 1;

  if (playerId !== giverId && playerId !== receiverId) return 1;
  return match.tag === "live" ? 0.75 : 0.5;
}

export function calcPlayerStats(playerId, opts = {}) {
  const tag = opts?.tag ?? "all";
  const matchesAll = Array.isArray(opts?._matches) ? opts._matches : [];

  const matches = getMatchesForPlayer(playerId, tag, matchesAll);

  let wins = 0;
  let losses = 0;

  const beaten = new Map();
  const lostTo = new Map();

  for (const m of matches) {
    const onLeft = playerOnLeft(m, playerId);
    const doubles = isDoublesMatch(m);

    // 对手：单打 1 个；双打是对方两人。
    const opponentIds = doubles
      ? (onLeft ? [m.rightPlayerId, m.rightPlayer2Id] : [m.leftPlayerId, m.leftPlayer2Id]).filter(Boolean)
      : [onLeft ? m.rightPlayerId : m.leftPlayerId].filter(Boolean);

    // 胜负：双打按本方队伍比分判；单打沿用 winnerId。
    let didWin;
    if (doubles) {
      const myScore = onLeft ? Number(m.leftScore ?? 0) : Number(m.rightScore ?? 0);
      const oppScore = onLeft ? Number(m.rightScore ?? 0) : Number(m.leftScore ?? 0);
      if (myScore === oppScore) continue;
      didWin = myScore > oppScore;
    } else {
      if (!m.winnerId) continue;
      didWin = m.winnerId === playerId;
    }

    const factor = handicapStatsFactor(m, playerId);

    if (didWin) {
      wins += factor;
      for (const oid of opponentIds) beaten.set(oid, (beaten.get(oid) || 0) + factor);
    } else {
      losses += factor;
      for (const oid of opponentIds) lostTo.set(oid, (lostTo.get(oid) || 0) + factor);
    }
  }

  const total = wins + losses;
  const winRate = total > 0 ? wins / total : 0;

  const toSortedList = (map) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([opponentId, count]) => ({ opponentId, count }));

  return {
    total,
    wins,
    losses,
    winRate,
    beatenList: toSortedList(beaten),
    lostToList: toSortedList(lostTo),
    matches,
  };
}

export function buildFargoLiteLeaderboardFromData(players, matchesInput, opts = {}) {
  const mode = normalizeMode(opts.mode ?? "all"); // all | practice | live
  const seasonId = normalizeSeasonId(opts.seasonId ?? "all");
  const q = String(opts.q ?? "").trim().toLowerCase();
  const minMatches = Number(opts.minMatches ?? 0);

  const sortKey = opts.sortKey ?? "rating";     // rating | rackWinRate | trend10 | matches
  const sortDir = opts.sortDir ?? "desc";       // asc | desc

  const matchesAll = filterMatchesBySeason(matchesInput, seasonId);
  const matches = mode === "all" ? matchesAll : matchesAll.filter((m) => normalizeTag(m.tag) === mode);

  const { rating, played } = computeRatingsFargoLiteHalf(players, matches);

  let rows = players.map((p) => {
    const raw = rating.get(p.id) ?? 500;
    const rounded = Math.round(raw);

    const stats = calcRackStatsForPlayerHalf(p.id, matchesAll, mode);
    return {
      id: p.id,
      name: p.name ?? "Unknown",
      hidden: p.hidden ?? false,
      retired: p.retired ?? false,
      rating: raw,
      ratingRounded: rounded,
      tier: tierFromRating(rounded),
      played: played.get(p.id) ?? 0,
      effMatches: stats.effMatches,
      racks: stats.racks,
      rackWinRate: stats.rackWinRate,
      liveRackWinRate: stats.liveRackWinRate,
      pracRackWinRate: stats.pracRackWinRate,
      trend10: stats.trend10,
      confidence: stats.confidence,
    };
  });

  rows = rows
    .filter((x) => !x.hidden && !x.retired)
    .filter((x) => (q ? x.name.toLowerCase().includes(q) : true))
    .filter((x) => x.effMatches >= minMatches);

  const dir = sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const va =
      sortKey === "rating" ? a.rating :
      sortKey === "rackWinRate" ? a.rackWinRate :
      sortKey === "trend10" ? a.trend10 :
      a.effMatches;

    const vb =
      sortKey === "rating" ? b.rating :
      sortKey === "rackWinRate" ? b.rackWinRate :
      sortKey === "trend10" ? b.trend10 :
      b.effMatches;

    return (va - vb) * dir;
  });

  return rows;
}

function handicapHalfFactor(match, playerId) {
  return handicapStatsFactor(match, playerId);
}

function normalizeMode(mode) {
  return mode === "live" ? "live" : mode === "practice" ? "practice" : "all";
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function calcRackStatsForPlayerHalf(playerId, matchesAll, mode) {
  const m = normalizeMode(mode);
  // 单打 + 双打都计入街灯榜的局分统计。
  const filtered = m === "all" ? matchesAll : matchesAll.filter((x) => x.tag === m);

  let effMatches = 0;
  let racks = 0;
  let won = 0;

  let liveRacks = 0, liveWon = 0;
  let pracRacks = 0, pracWon = 0;

  const recent = [];

  for (const match of filtered) {
    const isLeft = match.leftPlayerId === playerId || match.leftPlayer2Id === playerId;
    const isRight = match.rightPlayerId === playerId || match.rightPlayer2Id === playerId;
    if (!isLeft && !isRight) continue;

    const my = isLeft ? Number(match.leftScore ?? 0) : Number(match.rightScore ?? 0);
    const opp = isLeft ? Number(match.rightScore ?? 0) : Number(match.leftScore ?? 0);
    const total = my + opp;
    if (total <= 0) continue;

    const f = handicapHalfFactor(match, playerId);

    racks += total * f;
    won += my * f;

    effMatches += f;

    if (match.tag === "live") { liveRacks += total * f; liveWon += my * f; }
    else { pracRacks += total * f; pracWon += my * f; }

    const t = new Date(match.dateISO).getTime();
    recent.push({ t, diff: clamp((my - opp) * 2, -20, 20) * f });
  }

  recent.sort((a, b) => b.t - a.t);
  const trend10 = recent.slice(0, 10).reduce((s, x) => s + x.diff, 0);

  const rackWinRate = racks ? won / racks : 0;
  const liveRackWinRate = liveRacks ? liveWon / liveRacks : 0;
  const pracRackWinRate = pracRacks ? pracWon / pracRacks : 0;

  let confidence = "低";
  if (effMatches >= 30) confidence = "高";
  else if (effMatches >= 10) confidence = "中";

  return {
    effMatches,
    racks,
    rackWinRate,
    liveRackWinRate,
    pracRackWinRate,
    trend10,
    confidence,
  };
}

// 历史球员卡片用的全量统计：场级胜负 + 局级胜率 + 当前 Rating/段位。
// 用全体 players（含已退役/禁用）算 rating，保证与街灯榜口径一致、对手不受影响。
export function calcPlayerCardStats(playerId, players, matches) {
  const { rating, played } = computeRatingsFargoLiteHalf(players, matches);
  const matchStats = calcPlayerStats(playerId, { tag: "all", _matches: matches });
  const rackAll = calcRackStatsForPlayerHalf(playerId, matches, "all");
  const history = getPlayerFargoRatingHistoryFromData(playerId, players, matches);

  const ratingRaw = rating.get(playerId) ?? 500;
  const ratingRounded = Math.round(ratingRaw);
  const peakRatingRounded = Math.round(history.highestRating ?? ratingRaw);

  return {
    ratingRounded,
    tier: tierFromRating(ratingRounded),
    peakRatingRounded,
    peakTier: tierFromRating(peakRatingRounded),
    matchCount: matchStats.matches.length,
    wins: matchStats.wins,
    losses: matchStats.losses,
    winRate: matchStats.winRate,
    played: played.get(playerId) ?? 0,
    racks: rackAll.racks,
    rackWinRate: rackAll.rackWinRate,
    liveRackWinRate: rackAll.liveRackWinRate,
    pracRackWinRate: rackAll.pracRackWinRate,
    trend10: rackAll.trend10,
    confidence: rackAll.confidence,
  };
}

function expectedRackWinRate(myR, oppR, D = 200) {
  return 1 / (1 + Math.pow(10, (oppR - myR) / D));
}

function tierFromRating(r) {
  const n = Math.floor(Number(r) || 0);

  if (n >= 550) return "斗帝";

  if (n >= 549) return "九星斗圣";
  if (n >= 548) return "八星斗圣";
  if (n >= 547) return "七星斗圣";
  if (n >= 546) return "六星斗圣";
  if (n >= 545) return "五星斗圣";
  if (n >= 544) return "四星斗圣";
  if (n >= 543) return "三星斗圣";
  if (n >= 542) return "二星斗圣";
  if (n >= 540) return "一星斗圣";

  if (n >= 539) return "九星斗尊";
  if (n >= 538) return "八星斗尊";
  if (n >= 537) return "七星斗尊";
  if (n >= 536) return "六星斗尊";
  if (n >= 535) return "五星斗尊";
  if (n >= 534) return "四星斗尊";
  if (n >= 533) return "三星斗尊";
  if (n >= 532) return "二星斗尊";
  if (n >= 530) return "一星斗尊";

  if (n >= 529) return "九星斗宗";
  if (n >= 528) return "八星斗宗";
  if (n >= 527) return "七星斗宗";
  if (n >= 526) return "六星斗宗";
  if (n >= 525) return "五星斗宗";
  if (n >= 524) return "四星斗宗";
  if (n >= 523) return "三星斗宗";
  if (n >= 522) return "二星斗宗";
  if (n >= 520) return "一星斗宗";

  if (n >= 519) return "九星斗皇";
  if (n >= 518) return "八星斗皇";
  if (n >= 517) return "七星斗皇";
  if (n >= 516) return "六星斗皇";
  if (n >= 515) return "五星斗皇";
  if (n >= 514) return "四星斗皇";
  if (n >= 513) return "三星斗皇";
  if (n >= 512) return "二星斗皇";
  if (n >= 510) return "一星斗皇";

  if (n >= 509) return "九星斗王";
  if (n >= 508) return "八星斗王";
  if (n >= 507) return "七星斗王";
  if (n >= 506) return "六星斗王";
  if (n >= 505) return "五星斗王";
  if (n >= 504) return "四星斗王";
  if (n >= 503) return "三星斗王";
  if (n >= 502) return "二星斗王";
  if (n >= 500) return "一星斗王";

  if (n >= 499) return "九星斗灵";
  if (n >= 498) return "八星斗灵";
  if (n >= 497) return "七星斗灵";
  if (n >= 496) return "六星斗灵";
  if (n >= 495) return "五星斗灵";
  if (n >= 494) return "四星斗灵";
  if (n >= 493) return "三星斗灵";
  if (n >= 492) return "二星斗灵";
  if (n >= 490) return "一星斗灵";

  if (n >= 489) return "九星大斗师";
  if (n >= 488) return "八星大斗师";
  if (n >= 487) return "七星大斗师";
  if (n >= 486) return "六星大斗师";
  if (n >= 485) return "五星大斗师";
  if (n >= 484) return "四星大斗师";
  if (n >= 483) return "三星大斗师";
  if (n >= 482) return "二星大斗师";
  if (n >= 480) return "一星大斗师";

  if (n >= 479) return "九星斗师";
  if (n >= 478) return "八星斗师";
  if (n >= 477) return "七星斗师";
  if (n >= 476) return "六星斗师";
  if (n >= 475) return "五星斗师";
  if (n >= 474) return "四星斗师";
  if (n >= 473) return "三星斗师";
  if (n >= 472) return "二星斗师";
  if (n >= 470) return "一星斗师";

  if (n >= 469) return "九星斗者";
  if (n >= 468) return "八星斗者";
  if (n >= 467) return "七星斗者";
  if (n >= 466) return "六星斗者";
  if (n >= 465) return "五星斗者";
  if (n >= 464) return "四星斗者";
  if (n >= 463) return "三星斗者";
  if (n >= 462) return "二星斗者";
  if (n >= 460) return "一星斗者";

  if (n >= 459) return "一星匕首";
  if (n >= 458) return "二星匕首";
  if (n >= 457) return "三星匕首";
  if (n >= 456) return "四星匕首";
  if (n >= 455) return "五星匕首";
  if (n >= 454) return "六星匕首";
  if (n >= 453) return "七星匕首";
  if (n >= 452) return "八星匕首";
  if (n >= 450) return "九星匕首";

  return "大匕首";
}

function sortMatchesForRatingReplay(matches) {
  return [...matches].sort((a, b) => {
    const dt = new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime();
    if (dt !== 0) return dt;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

function runFargoLiteRatings(players, matches, onMatchApplied) {
  const rating = new Map(players.map((p) => [p.id, 500]));
  const played = new Map(players.map((p) => [p.id, 0]));

  // 街灯榜 Rating：单打 + 双打都按局分 ELO 重放（双打用两队平均 Rating 计算预期）。
  const sorted = sortMatchesForRatingReplay(matches);

  const K = 40;
  const D = 200;
  const RANK_TIER_1 = 5;
  const RANK_TIER_2 = 10;
  const RANK_TIER_3 = 15;
  const BASE_WEIGHT_BY_TAG = {
    practice: 1.0,
    live: 1.5,
  };
  const NON_HANDICAP_WEIGHT_BY_TAG = {
    practice: {
      higher: [1.0, 0.8, 0.6, 0.4],
      upset: [1.0, 1.2, 1.4, 1.6],
    },
    live: {
      higher: [1.5, 1.3, 1.1, 0.9],
      upset: [1.5, 1.7, 1.9, 2.1],
    },
  };
  const playerIds = players.map((p) => p.id);

  for (const m of sorted) {
    const aScore = Number(m.leftScore ?? 0);
    const bScore = Number(m.rightScore ?? 0);
    const totalRacks = aScore + bScore;
    if (totalRacks <= 0) continue;

    const tag = m.tag === "live" ? "live" : "practice";

    // 双打：两队各取两人 Rating 平均算预期，四人各按自己的稳定系数同涨同跌。
    if (isDoublesMatch(m)) {
      const teamA = [m.leftPlayerId, m.leftPlayer2Id].filter(Boolean);
      const teamB = [m.rightPlayerId, m.rightPlayer2Id].filter(Boolean);
      if (teamA.length < 2 || teamB.length < 2) continue;

      const ratingOf = (id) => rating.get(id) ?? 500;
      const Ra = (ratingOf(teamA[0]) + ratingOf(teamA[1])) / 2;
      const Rb = (ratingOf(teamB[0]) + ratingOf(teamB[1])) / 2;
      const expectedA = expectedRackWinRate(Ra, Rb, D);
      const actualA = aScore / totalRacks;
      const delta = K * (actualA - expectedA) * BASE_WEIGHT_BY_TAG[tag] * DOUBLES_RATING_WEIGHT;

      const involved = [];
      for (const id of teamA) {
        const p = played.get(id) ?? 0;
        const next = ratingOf(id) + delta * (1 / Math.sqrt(1 + p / 10));
        rating.set(id, next);
        played.set(id, p + 1);
        involved.push({ id, side: "A", ratingAfter: next });
      }
      for (const id of teamB) {
        const p = played.get(id) ?? 0;
        const next = ratingOf(id) - delta * (1 / Math.sqrt(1 + p / 10));
        rating.set(id, next);
        played.set(id, p + 1);
        involved.push({ id, side: "B", ratingAfter: next });
      }
      onMatchApplied?.({ match: m, involved });
      continue;
    }

    const A = m.leftPlayerId;
    const B = m.rightPlayerId;
    if (!A || !B) continue;

    const Ra = rating.get(A) ?? 500;
    const Rb = rating.get(B) ?? 500;

    const expectedA = expectedRackWinRate(Ra, Rb, D);
    const actualA = aScore / totalRacks;

    const baseWeight = BASE_WEIGHT_BY_TAG[tag];

    const pa = played.get(A) ?? 0;
    const pb = played.get(B) ?? 0;
    const robustA = 1 / Math.sqrt(1 + pa / 10);
    const robustB = 1 / Math.sqrt(1 + pb / 10);

    let matchWeight = baseWeight;
    if (m.isHandicap && m.handicapReceiverId && m.winnerId) {
      const receiverWon = m.winnerId === m.handicapReceiverId;
      if (receiverWon) matchWeight = baseWeight / 2;
    }

    if (!m.isHandicap) {
      const tierWeights = NON_HANDICAP_WEIGHT_BY_TAG[tag];
      const rankedIds = [...playerIds].sort((id1, id2) => {
        const r2 = rating.get(id2) ?? 500;
        const r1 = rating.get(id1) ?? 500;
        if (r2 !== r1) return r2 - r1;
        return String(id1).localeCompare(String(id2));
      });
      const rankMap = new Map(rankedIds.map((id, idx) => [id, idx + 1]));
      const rankA = rankMap.get(A) ?? 0;
      const rankB = rankMap.get(B) ?? 0;
      const rankDiff = Math.abs(rankA - rankB);

      let tier = 0;
      if (rankDiff >= RANK_TIER_3) tier = 3;
      else if (rankDiff >= RANK_TIER_2) tier = 2;
      else if (rankDiff >= RANK_TIER_1) tier = 1;

      matchWeight = tierWeights.higher[tier];
      if (tier > 0 && rankA > 0 && rankB > 0 && rankA !== rankB) {
        const aIsHigherRank = rankA < rankB;
        const aWon = aScore > bScore;
        const higherWon = (aIsHigherRank && aWon) || (!aIsHigherRank && !aWon);
        matchWeight = higherWon ? tierWeights.higher[tier] : tierWeights.upset[tier];
      }
    }

    const delta = K * (actualA - expectedA) * matchWeight;
    const nextRa = Ra + delta * robustA;
    const nextRb = Rb - delta * robustB;

    rating.set(A, nextRa);
    rating.set(B, nextRb);

    played.set(A, pa + 1);
    played.set(B, pb + 1);

    onMatchApplied?.({
      match: m,
      involved: [
        { id: A, side: "A", ratingAfter: nextRa },
        { id: B, side: "B", ratingAfter: nextRb },
      ],
    });
  }

  return { rating, played };
}

function computeRatingsFargoLiteHalf(players, matches) {
  return runFargoLiteRatings(players, matches);
}

export function getPlayerFargoRatingHistoryFromData(playerId, players, matches) {
  if (!players.some((player) => player.id === playerId)) {
    return {
      playerId,
      startRating: 500,
      currentRating: 500,
      netChange: 0,
      highestRating: 500,
      lowestRating: 500,
      points: [],
    };
  }

  const points = [];
  let previousRating = 500;

  runFargoLiteRatings(players, matches, ({ match, involved }) => {
    const me = involved.find((x) => x.id === playerId);
    if (!me) return;

    const rating = me.ratingAfter;
    const opponentId = involved.find((x) => x.side !== me.side)?.id ?? null;
    const delta = rating - previousRating;
    const myScore = me.side === "A" ? match.leftScore : match.rightScore;
    const opponentScore = me.side === "A" ? match.rightScore : match.leftScore;

    points.push({
      matchId: match.id,
      dateISO: match.dateISO,
      matchName: match.matchName ?? "未命名比赛",
      tag: normalizeTag(match.tag),
      opponentId,
      rating,
      delta,
      myScore,
      opponentScore,
    });

    previousRating = rating;
  });

  const values = [500, ...points.map((point) => point.rating)];
  const currentRating = points.length > 0 ? points[points.length - 1].rating : 500;

  return {
    playerId,
    startRating: 500,
    currentRating,
    netChange: currentRating - 500,
    highestRating: Math.max(...values),
    lowestRating: Math.min(...values),
    points,
  };
}
