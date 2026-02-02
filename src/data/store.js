import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const STORAGE_KEY = "pool_tracker_v1";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTag(tag) {
  return tag === "live" ? "live" : "practice";
}

export function tagLabel(tag) {
  return normalizeTag(tag) === "live" ? "直播" : "练习赛";
}

function compareStr(a, b) {
  return String(a).localeCompare(String(b), "zh-Hans-CN", { sensitivity: "base" });
}

function migrate(data) {
  const migrated = {
    players: Array.isArray(data?.players) ? data.players : [],
    matches: Array.isArray(data?.matches) ? data.matches : [],
  };

  migrated.players = migrated.players.map((p) => ({
    id: p?.id ?? uid(),
    name: String(p?.name ?? "Unknown"),
  }));

  migrated.matches = migrated.matches.map((m) => {
    const leftScore = Number(m?.leftScore ?? 0);
    const rightScore = Number(m?.rightScore ?? 0);

    const winnerId =
      m?.winnerId ??
      (leftScore > rightScore ? m?.leftPlayerId : rightScore > leftScore ? m?.rightPlayerId : null);

    const isHandicap = Boolean(m?.isHandicap);
    const giverId = isHandicap ? (m?.handicapGiverId ?? null) : null;
    const receiverId = isHandicap ? (m?.handicapReceiverId ?? null) : null;

    const handicapGiverId = typeof giverId === "string" && giverId.trim() ? giverId : null;
    const handicapReceiverId = typeof receiverId === "string" && receiverId.trim() ? receiverId : null;

    const validPair =
      isHandicap &&
      handicapGiverId &&
      handicapReceiverId &&
      handicapGiverId !== handicapReceiverId;

    return {
      id: m?.id ?? uid(),
      matchName: String(m?.matchName ?? "未命名比赛"),
      dateISO: m?.dateISO ?? new Date().toISOString(),
      raceTo: Number(m?.raceTo ?? 7),
      leftPlayerId: m?.leftPlayerId ?? "",
      rightPlayerId: m?.rightPlayerId ?? "",
      leftScore,
      rightScore,
      winnerId,
      tag: normalizeTag(m?.tag),
      isHandicap: Boolean(validPair),
      handicapGiverId: validPair ? handicapGiverId : null,
      handicapReceiverId: validPair ? handicapReceiverId : null,
    };
  });

  return migrated;
}

function loadAll() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const data = safeParse(raw, null);

  if (data && typeof data === "object") {
    const migrated = migrate(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  }

  const seed = {
    players: [
      { id: uid(), name: "Player A" },
      { id: uid(), name: "Player B" },
    ],
    matches: [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportToJSON() {
  const data = loadAll();
  const players = data.players;

  const matches = [...data.matches]
    .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime())
    .map((m) => ({
      id: m.id,
      matchName: m.matchName,
      dateISO: m.dateISO,
      raceTo: m.raceTo,
      leftPlayerId: m.leftPlayerId,
      rightPlayerId: m.rightPlayerId,
      leftScore: m.leftScore,
      rightScore: m.rightScore,
      winnerId: m.winnerId,
      tag: normalizeTag(m.tag),
      isHandicap: Boolean(m.isHandicap),
      handicapGiverId: m.isHandicap ? (m.handicapGiverId ?? null) : null,
      handicapReceiverId: m.isHandicap ? (m.handicapReceiverId ?? null) : null,
    }));

  const playerName = (id) => players.find((p) => p.id === id)?.name ?? "Unknown";
  const computed = buildComputedExport(players, data.matches, playerName);

  const payload = {
    exportedAtISO: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    players,
    matches,
    computed,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const filename = `pool-data-${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.json`;

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function replaceAllData(data) {
  const migrated = migrate(data);

  if (!Array.isArray(migrated.players) || !Array.isArray(migrated.matches)) {
    throw new Error("数据结构错误：必须包含 players 和 matches 数组");
  }

  saveAll(migrated);
  return true;
}

export function importFromJSONFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("未选择文件"));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed && parsed.players && parsed.matches) {
          replaceAllData({ players: parsed.players, matches: parsed.matches });
        } else {
          replaceAllData(parsed);
        }
        resolve(true);
      } catch (e) {
        reject(e);
      }
    };

    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}

function styleHeaderRow(row) {
  row.height = 20;
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  });
}

function setNumFmtRange(ws, col, rowStart, rowEnd, numFmt) {
  for (let r = rowStart; r <= rowEnd; r++) {
    ws.getCell(r, col).numFmt = numFmt;
  }
}

function addTitleRow(ws, text) {
  const r = ws.addRow([text]);
  r.font = { bold: true, size: 14 };
  ws.addRow([]);
}

function addSectionLabel(ws, text) {
  const r = ws.addRow([text]);
  r.font = { bold: true };
  ws.addRow([]);
}

function listToText(list, playerName) {
  if (!list || list.length === 0) return "—";
  return list.map((x) => `${playerName(x.opponentId)}×${x.count}`).join("；");
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

function buildComputedExport(players, matches, playerName) {
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
        beaten: s.beatenList.map((x) => ({ opponentId: x.opponentId, opponentName: playerName(x.opponentId), count: x.count })),
        lostTo: s.lostToList.map((x) => ({ opponentId: x.opponentId, opponentName: playerName(x.opponentId), count: x.count })),
        matches: s.matches.map((m) => ({
          id: m.id,
          tag: normalizeTag(m.tag),
          matchName: m.matchName,
          dateISO: m.dateISO,
          raceTo: m.raceTo,
          left: playerName(m.leftPlayerId),
          right: playerName(m.rightPlayerId),
          leftScore: m.leftScore,
          rightScore: m.rightScore,
          winner: m.winnerId ? playerName(m.winnerId) : null,
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
        left: playerName(m.leftPlayerId),
        right: playerName(m.rightPlayerId),
        leftScore: m.leftScore,
        rightScore: m.rightScore,
        winner: m.winnerId ? playerName(m.winnerId) : null,
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

function writeTagSheet(wb, sheetName, tag, players, matches, playerName) {
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = [{ width: 26 }, { width: 20 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 40 }, { width: 40 }, { width: 10 }];

  addTitleRow(ws, `标签：${tagLabel(tag)}（导出全量：球员详情 / 比赛记录 / 排名）`);

  addSectionLabel(ws, "球员详情（可用表头筛选球员）");
  const playerHeaderRowIndex = ws.rowCount + 1;

  const headerRow = ws.addRow(["球员", "总场", "胜", "负", "胜率", "战胜对手（次数）", "战败对手（次数）"]);
  styleHeaderRow(headerRow);

  const details = players.map((p) => {
    const s = calcPlayerStats(p.id, { tag, _matches: matches });
    return {
      name: p.name,
      total: s.total,
      wins: s.wins,
      losses: s.losses,
      winRate: s.winRate,
      beatenText: listToText(s.beatenList, playerName),
      lostToText: listToText(s.lostToList, playerName),
    };
  });

  details.forEach((d) => ws.addRow([d.name, d.total, d.wins, d.losses, d.winRate, d.beatenText, d.lostToText]));

  const playerTableStart = playerHeaderRowIndex;
  const playerTableEnd = ws.rowCount;
  setNumFmtRange(ws, 5, playerTableStart + 1, playerTableEnd, "0.0%");
  ws.autoFilter = { from: { row: playerTableStart, column: 1 }, to: { row: playerTableEnd, column: 7 } };

  ws.addRow([]);
  ws.addRow([]);

  addSectionLabel(ws, "比赛记录（可用表头筛选）");
  const matchHeaderRowIndex = ws.rowCount + 1;

  const mHeader = ws.addRow(["比赛名称", "时间", "赛制", "左侧", "比分", "右侧", "胜者", "放门"]);
  styleHeaderRow(mHeader);

  const filteredMatches = matches
    .filter((m) => normalizeTag(m.tag) === normalizeTag(tag))
    .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

  filteredMatches.forEach((m) => {
    const L = playerName(m.leftPlayerId);
    const R = playerName(m.rightPlayerId);
    const W = m.winnerId ? playerName(m.winnerId) : "—";
    ws.addRow([m.matchName ?? "未命名比赛", new Date(m.dateISO), `抢 ${m.raceTo}`, L, `${m.leftScore} : ${m.rightScore}`, R, W, m.isHandicap ? "是" : "否"]);
  });

  const matchTableStart = matchHeaderRowIndex;
  const matchTableEnd = ws.rowCount;
  setNumFmtRange(ws, 2, matchTableStart + 1, matchTableEnd, "yyyy-mm-dd hh:mm");
  ws.autoFilter = { from: { row: matchTableStart, column: 1 }, to: { row: matchTableEnd, column: 8 } };

  ws.addRow([]);
  ws.addRow([]);

  addSectionLabel(ws, "胜场排名（可筛选）");
  const winsRankHeaderIdx = ws.rowCount + 1;

  const wHeader = ws.addRow(["排名", "球员", "胜", "负", "总场", "胜率"]);
  styleHeaderRow(wHeader);

  const rankWins = buildRankingWins(players, matches, tag);
  rankWins.forEach((r) => ws.addRow([r.rank, r.name, r.wins, r.losses, r.total, r.winRate]));

  const winsRankEnd = ws.rowCount;
  setNumFmtRange(ws, 6, winsRankHeaderIdx + 1, winsRankEnd, "0.0%");
  ws.autoFilter = { from: { row: winsRankHeaderIdx, column: 1 }, to: { row: winsRankEnd, column: 6 } };

  ws.addRow([]);
  ws.addRow([]);

  addSectionLabel(ws, "胜率排名（可筛选）");
  const rateRankHeaderIdx = ws.rowCount + 1;

  const rHeader = ws.addRow(["排名", "球员", "胜率", "胜", "负", "总场"]);
  styleHeaderRow(rHeader);

  const rankRate = buildRankingWinRate(players, matches, tag);
  rankRate.forEach((r) => ws.addRow([r.rank, r.name, r.winRate, r.wins, r.losses, r.total]));

  const rateRankEnd = ws.rowCount;
  setNumFmtRange(ws, 3, rateRankHeaderIdx + 1, rateRankEnd, "0.0%");
  ws.autoFilter = { from: { row: rateRankHeaderIdx, column: 1 }, to: { row: rateRankEnd, column: 6 } };

  return ws;
}

export async function exportToExcel() {
  try {
    const data = loadAll();
    const players = data.players;
    const matches = data.matches;

    const wb = new ExcelJS.Workbook();
    wb.creator = "Pool Match Tracker";
    wb.created = new Date();

    const playerName = (id) => players.find((p) => p.id === id)?.name ?? "Unknown";

    writeTagSheet(wb, "练习赛", "practice", players, matches, playerName);
    writeTagSheet(wb, "直播", "live", players, matches, playerName);

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const filename = `pool-record-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.xlsx`;

    saveAs(blob, filename);
  } catch (err) {
    console.error(err);
    alert(`导出 Excel 失败：${err?.message ?? String(err)}`);
  }
}

export function getPlayers() {
  return loadAll().players;
}

export function getMatches(tag = "all") {
  const all = loadAll().matches;
  if (tag === "all") return all;
  const t = normalizeTag(tag);
  return all.filter((m) => normalizeTag(m.tag) === t);
}

export function addPlayer(name) {
  const data = loadAll();
  const player = { id: uid(), name: name.trim() };
  data.players.unshift(player);
  saveAll(data);
  return player;
}

export function updatePlayer(id, name) {
  const data = loadAll();
  data.players = data.players.map((p) => (p.id === id ? { ...p, name: name.trim() } : p));
  saveAll(data);
}

export function deletePlayer(id) {
  const data = loadAll();

  const hasMatch = data.matches.some((m) => m.leftPlayerId === id || m.rightPlayerId === id);

  if (hasMatch) {
    return { ok: false, reason: "该球员已有比赛记录，不能删除。你可以改名替代删除。" };
  }

  data.players = data.players.filter((p) => p.id !== id);
  saveAll(data);
  return { ok: true };
}

export function addMatch(matchInput) {
  const data = loadAll();

  const leftScore = Number(matchInput.leftScore ?? 0);
  const rightScore = Number(matchInput.rightScore ?? 0);
  const raceTo = Number(matchInput.raceTo ?? 7);

  if (leftScore === rightScore) {
    throw new Error("不允许平局：左右比分不能相同。");
  }

  const winnerId = leftScore > rightScore ? matchInput.leftPlayerId : matchInput.rightPlayerId;

  const isHandicap = Boolean(matchInput.isHandicap);
  const giverId = isHandicap ? (matchInput.handicapGiverId ?? null) : null;
  const receiverId = isHandicap ? (matchInput.handicapReceiverId ?? null) : null;

  const handicapGiverId = typeof giverId === "string" && giverId.trim() ? giverId : null;
  const handicapReceiverId = typeof receiverId === "string" && receiverId.trim() ? receiverId : null;

  const validPair =
    isHandicap &&
    handicapGiverId &&
    handicapReceiverId &&
    handicapGiverId !== handicapReceiverId;

  const match = {
    id: uid(),
    matchName: String(matchInput.matchName ?? "未命名比赛").trim() || "未命名比赛",
    dateISO: matchInput.dateISO ?? new Date().toISOString(),
    raceTo,
    leftPlayerId: matchInput.leftPlayerId,
    rightPlayerId: matchInput.rightPlayerId,
    leftScore,
    rightScore,
    winnerId,
    tag: normalizeTag(matchInput.tag),
    isHandicap: Boolean(validPair),
    handicapGiverId: validPair ? handicapGiverId : null,
    handicapReceiverId: validPair ? handicapReceiverId : null,
  };

  data.matches.unshift(match);
  saveAll(data);
  return match;
}

export function deleteMatch(matchId) {
  const data = loadAll();
  data.matches = data.matches.filter((m) => m.id !== matchId);
  saveAll(data);
}

export function getPlayerById(id) {
  return getPlayers().find((p) => p.id === id) || null;
}

export function getMatchesForPlayer(playerId, tag = "all", _matchesOverride = null) {
  const matches = Array.isArray(_matchesOverride) ? _matchesOverride : loadAll().matches;

  let filtered = matches.filter((m) => m.leftPlayerId === playerId || m.rightPlayerId === playerId);

  if (tag !== "all") {
    const t = normalizeTag(tag);
    filtered = filtered.filter((m) => normalizeTag(m.tag) === t);
  }

  return filtered;
}

function applyHandicapWinRateAdjustment(match, playerId, adjusted) {
  if (!match?.isHandicap) return;
  if (!match?.winnerId) return;

  const giverId = match.handicapGiverId;
  const receiverId = match.handicapReceiverId;

  if (!giverId || !receiverId) return;

  const receiverWon = match.winnerId === receiverId;
  if (!receiverWon) return;

  if (playerId === giverId) adjusted.losses -= 0.5;
  else if (playerId === receiverId) adjusted.wins -= 0.5;
}

export function calcPlayerStats(playerId, opts = {}) {
  const tag = opts?.tag ?? "all";
  const matchesAll = Array.isArray(opts?._matches) ? opts._matches : loadAll().matches;

  const matches = getMatchesForPlayer(playerId, tag, matchesAll);

  let wins = 0;
  let losses = 0;

  const beaten = new Map();
  const lostTo = new Map();

  for (const m of matches) {
    const isLeft = m.leftPlayerId === playerId;
    const opponentId = isLeft ? m.rightPlayerId : m.leftPlayerId;

    if (!m.winnerId) continue;

    if (m.winnerId === playerId) {
      wins += 1;
      beaten.set(opponentId, (beaten.get(opponentId) || 0) + 1);
    } else {
      losses += 1;
      lostTo.set(opponentId, (lostTo.get(opponentId) || 0) + 1);
    }
  }

  const total = wins + losses;

  const adjusted = { wins, losses };
  for (const m of matches) {
    applyHandicapWinRateAdjustment(m, playerId, adjusted);
  }

  const denom = adjusted.wins + adjusted.losses;
  const winRate = denom > 0 ? adjusted.wins / denom : 0;

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
