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

// ===== Leaderboard 导出（JSON / Excel）=====

function safeFilenamePart(s) {
  return String(s ?? "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim()
    .slice(0, 40);
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function pctToNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// 你页面里的可选：rating | rackWinRate | trend10 | matches
// store 内部实现用 effMatches，所以这里帮你统一
function normalizeLeaderboardSortKey(k) {
  if (k === "matches") return "matches"; // buildFargoLiteLeaderboard 里你已经用 effMatches 去排序
  if (k === "rackWinRate") return "rackWinRate";
  if (k === "trend10") return "trend10";
  return "rating";
}

/**
 * 导出积分榜 JSON（只导出“当前筛选条件下”的榜单结果）
 * opts: { mode, q, minMatches, sortKey, sortDir }
 */
export function exportLeaderboardToJSON(opts = {}) {
  const mode = normalizeMode(opts.mode ?? "all");
  const q = String(opts.q ?? "").trim();
  const minMatches = Number(opts.minMatches ?? 0);
  const sortKey = normalizeLeaderboardSortKey(opts.sortKey ?? "rating");
  const sortDir = opts.sortDir === "asc" ? "asc" : "desc";

  const rows = buildFargoLiteLeaderboard({ mode, q, minMatches, sortKey, sortDir });

  const payload = {
    exportedAtISO: new Date().toISOString(),
    type: "leaderboard",
    filters: { mode, q, minMatches, sortKey, sortDir },
    // 只保留展示需要的字段（更干净）
    rows: rows.map((r, idx) => ({
      rank: idx + 1,
      id: r.id,
      name: r.name,
      rating: Math.round(r.rating),
      tier: r.tier,
      confidence: r.confidence,
      // 可信度展示用折算场次 + 折算局数（和你 Leaderboard UI 口径一致）
      effMatches: r.effMatches,
      racks: r.racks,
      rackWinRate: r.rackWinRate,
      liveRackWinRate: r.liveRackWinRate,
      pracRackWinRate: r.pracRackWinRate,
      trend10: r.trend10,
      // 真实参与场次（用于稳健系数，不一定展示，但导出带上也有价值）
      played: r.played,
    })),
    // 可选：把你“0.5 放门规则”的说明也塞进去，方便别人看 JSON 就懂
    notes: {
      handicapRule:
        "若 isHandicap=true 且 handicapReceiverId 获胜，则该场按 0.5 场折算（用于局数统计与 Rating 更新）；否则按 1.0 场。",
      ratingRule:
        "Rating 约等于 K*(actualRackWR-expectedRackWR)*tagWeight*handicapFactor*robustness，其中练习赛权重0.7，直播权重1.0。",
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  const fname = `leaderboard-${safeFilenamePart(mode)}-${nowStamp()}.json`;
  a.href = url;
  a.download = fname;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 导出积分榜 Excel（只导出“当前筛选条件下”的榜单结果）
 * opts: { mode, q, minMatches, sortKey, sortDir }
 */
export async function exportLeaderboardToExcel(opts = {}) {
  const mode = normalizeMode(opts.mode ?? "all");
  const q = String(opts.q ?? "").trim();
  const minMatches = Number(opts.minMatches ?? 0);
  const sortKey = normalizeLeaderboardSortKey(opts.sortKey ?? "rating");
  const sortDir = opts.sortDir === "asc" ? "asc" : "desc";

  const rows = buildFargoLiteLeaderboard({ mode, q, minMatches, sortKey, sortDir });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pool Match Tracker";
  wb.created = new Date();

  const ws = wb.addWorksheet("积分榜", { views: [{ state: "frozen", ySplit: 2 }] });

  // 标题行
  const title = `积分榜导出（mode=${mode}，minMatches=${minMatches}，sort=${sortKey}-${sortDir}${q ? `，q=${q}` : ""}）`;
  addTitleRow(ws, title);

  // 表头
  const header = ws.addRow([
    "排名",
    "球员",
    "Rating",
    "段位",
    "可信度",
    "折算场次",
    "折算局数",
    "局胜率",
    "直播局胜率",
    "练习局胜率",
    "最近10场",
    "真实场次(稳健)",
  ]);
  styleHeaderRow(header);

  // 列宽
  ws.columns = [
    { width: 8 },   // 排名
    { width: 18 },  // 球员
    { width: 10 },  // Rating
    { width: 10 },  // 段位
    { width: 12 },  // 可信度
    { width: 12 },  // 折算场次
    { width: 12 },  // 折算局数
    { width: 12 },  // 局胜率
    { width: 14 },  // 直播局胜率
    { width: 14 },  // 练习局胜率
    { width: 12 },  // 最近10场
    { width: 14 },  // 真实场次
  ];

  // 数据行
  rows.forEach((r, idx) => {
    ws.addRow([
      idx + 1,
      r.name,
      Math.round(r.rating),
      r.tier,
      r.confidence,
      pctToNumber(r.effMatches),
      pctToNumber(r.racks),
      pctToNumber(r.rackWinRate),
      pctToNumber(r.liveRackWinRate),
      pctToNumber(r.pracRackWinRate),
      pctToNumber(r.trend10),
      pctToNumber(r.played),
    ]);
  });

  // 百分比格式：局胜率相关列
  // 表头是第 (ws.rowCount - rows.length) 行之后，最简单：从第 4 行开始（因为 addTitleRow 会插一空行）
  // 你的 addTitleRow: 标题行 + 空行，因此 header 在第 3 行，数据从第 4 行开始
  const dataStart = 4;
  const dataEnd = ws.rowCount;

  // “局胜率/直播/练习”三列：8,9,10
  setNumFmtRange(ws, 8, dataStart, dataEnd, "0.0%");
  setNumFmtRange(ws, 9, dataStart, dataEnd, "0.0%");
  setNumFmtRange(ws, 10, dataStart, dataEnd, "0.0%");

  // 自动筛选（覆盖表头到最后一行）
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: dataEnd, column: 12 } };

  // 备注 sheet：把规则说明写进去（你说要给别人展示完整步骤，这个很加分）
  const note = wb.addWorksheet("计分规则");
  note.columns = [{ width: 120 }];
  addTitleRow(note, "积分计算规则（Fargo-lite + 放门半场）");

  note.addRow([
    "1) Rating 初始值：每位球员初始 Rating = 1000。",
  ]);
  note.addRow([
    "2) 按时间顺序逐场迭代：越早的比赛先计算，用当前双方 Rating 估计预期局胜率。",
  ]);
  note.addRow([
    "3) 实际局胜率 Actual = 本场赢局数 / 本场总局数。",
  ]);
  note.addRow([
    "4) 预期局胜率 Expected = 1 / (1 + 10^((对手Rating-我Rating)/D))，D=200。",
  ]);
  note.addRow([
    "5) 标签权重：直播 weight=1.0，练习 weight=0.7。",
  ]);
  note.addRow([
    "6) 稳健系数：robust = 1 / sqrt(1 + 场次/10)，场次越多单场波动越小。",
  ]);
  note.addRow([
    "7) 放门半场折算：若 isHandicap=true 且 被放门方(handicapReceiverId) 获胜，则 handicapFactor=0.5；否则为 1.0。",
  ]);
  note.addRow([
    "8) 单场 Rating 更新（A 为 left，B 为 right）：delta = K*(ActualA-ExpectedA)*weight*handicapFactor；A += delta*robustA，B -= delta*robustB。K=40。",
  ]);
  note.addRow([
    "9) 积分榜局胜率统计：局数与赢局数也按 handicapFactor 折算，确保与 0.5 规则一致。",
  ]);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const fname = `leaderboard-${safeFilenamePart(mode)}-${nowStamp()}.xlsx`;
  saveAs(blob, fname);
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

export function buildFargoLiteLeaderboard(opts = {}) {
  const mode = normalizeMode(opts.mode ?? "all"); // all | practice | live
  const q = String(opts.q ?? "").trim().toLowerCase();
  const minMatches = Number(opts.minMatches ?? 0);

  const sortKey = opts.sortKey ?? "rating";     // rating | rackWinRate | trend10 | matches
  const sortDir = opts.sortDir ?? "desc";       // asc | desc

  const players = getPlayers();
  const matchesAll = getMatches("all");
  const matches = mode === "all" ? matchesAll : matchesAll.filter((m) => m.tag === mode);

  const { rating, played } = computeRatingsFargoLiteHalf(players, matches);

  let rows = players.map((p) => {
    const r = rating.get(p.id) ?? 1000;
    const stats = calcRackStatsForPlayerHalf(p.id, matchesAll, "all"); // 展示层用全量更直观（你也可以改成 mode）
    return {
      id: p.id,
      name: p.name ?? "Unknown",
      rating: r,
      tier: tierFromRating(r),
      played: played.get(p.id) ?? 0,           // 真实参与场次（用于“更稳定”）
      effMatches: stats.effMatches,            // 折算场次（用于可信度展示）
      racks: stats.racks,
      rackWinRate: stats.rackWinRate,
      liveRackWinRate: stats.liveRackWinRate,
      pracRackWinRate: stats.pracRackWinRate,
      trend10: stats.trend10,
      confidence: stats.confidence,
    };
  });

  // 过滤
  rows = rows
    .filter((x) => (q ? x.name.toLowerCase().includes(q) : true))
    .filter((x) => x.effMatches >= minMatches);

  // 排序
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
  // 只有“被放门方赢”才折算半场
  if (!match?.isHandicap) return 1;
  if (!match?.winnerId) return 1;

  const giverId = match.handicapGiverId;
  const receiverId = match.handicapReceiverId;
  if (!giverId || !receiverId) return 1;

  const receiverWon = match.winnerId === receiverId;
  if (!receiverWon) return 1;

  // 这场对双方都只算“半场”
  if (playerId === giverId || playerId === receiverId) return 0.5;
  return 1;
}

function normalizeMode(mode) {
  return mode === "live" ? "live" : mode === "practice" ? "practice" : "all";
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function calcRackStatsForPlayerHalf(playerId, matchesAll, mode) {
  const m = normalizeMode(mode);
  const filtered = m === "all" ? matchesAll : matchesAll.filter((x) => x.tag === m);

  let effMatches = 0;   // 折算后的“总场”
  let effWins = 0;      // 折算后的“胜场”（用于可信度展示可选）
  let racks = 0;
  let won = 0;

  let liveRacks = 0, liveWon = 0;
  let pracRacks = 0, pracWon = 0;

  const recent = [];

  for (const match of filtered) {
    const isLeft = match.leftPlayerId === playerId;
    const isRight = match.rightPlayerId === playerId;
    if (!isLeft && !isRight) continue;

    const my = isLeft ? Number(match.leftScore ?? 0) : Number(match.rightScore ?? 0);
    const opp = isLeft ? Number(match.rightScore ?? 0) : Number(match.leftScore ?? 0);
    const total = my + opp;
    if (total <= 0) continue;

    const f = handicapHalfFactor(match, playerId); // 1 或 0.5

    // “局”层面也按半场权重计入（使局胜率和你旧胜率规则一致）
    racks += total * f;
    won += my * f;

    // 可选：把“可信度”也用折算后的场次（更贴合你半场逻辑）
    effMatches += f;

    // 统计胜负（折算后只用于 confidence 展示，你也可以不用）
    if (match.winnerId) {
      if (match.winnerId === playerId) effWins += f;
    }

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

  // 可信度用“折算后的场次”更合理（半场不如整场可靠）
  let confidence = "低";
  if (effMatches >= 30) confidence = "高";
  else if (effMatches >= 10) confidence = "中";

  return {
    effMatches,      // 折算场次（用于可信度显示）
    racks,           // 折算局数
    rackWinRate,
    liveRackWinRate,
    pracRackWinRate,
    trend10,
    confidence,
  };
}

function expectedRackWinRate(myR, oppR, D = 200) {
  return 1 / (1 + Math.pow(10, (oppR - myR) / D));
}

function tierFromRating(r) {
  if (r >= 1300) return "一段";
  if (r >= 1200) return "二段";
  if (r >= 1100) return "三段";
  if (r >= 1000) return "四段";
  if (r >= 900) return "匕首";
  return "新手";
}

function computeRatingsFargoLiteHalf(players, matches) {
  const rating = new Map(players.map((p) => [p.id, 1000]));
  const played = new Map(players.map((p) => [p.id, 0])); // 真实参与场次（不折算），用于稳健

  const sorted = [...matches].sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());

  const K = 40;
  const D = 200;

  for (const m of sorted) {
    const A = m.leftPlayerId;
    const B = m.rightPlayerId;
    if (!A || !B) continue;

    const aScore = Number(m.leftScore ?? 0);
    const bScore = Number(m.rightScore ?? 0);
    const totalRacks = aScore + bScore;
    if (totalRacks <= 0) continue;

    const Ra = rating.get(A) ?? 1000;
    const Rb = rating.get(B) ?? 1000;

    const expectedA = expectedRackWinRate(Ra, Rb, D);
    const actualA = aScore / totalRacks;

    const tag = m.tag === "live" ? "live" : "practice";
    const weight = tag === "live" ? 1.0 : 0.7;

    const pa = played.get(A) ?? 0;
    const pb = played.get(B) ?? 0;
    const robustA = 1 / Math.sqrt(1 + pa / 10);
    const robustB = 1 / Math.sqrt(1 + pb / 10);

    // ✅ 放门半场：如果 receiverWon，则这场对双方更新“只算半场”
    let handicapFactor = 1.0;
    if (m.isHandicap && m.handicapReceiverId && m.winnerId) {
      const receiverWon = m.winnerId === m.handicapReceiverId;
      if (receiverWon) handicapFactor = 0.5;  // <-- 你要的 0.5 口径
    }

    const delta = K * (actualA - expectedA) * weight * handicapFactor;

    rating.set(A, Ra + delta * robustA);
    rating.set(B, Rb - delta * robustB);

    played.set(A, pa + 1);
    played.set(B, pb + 1);
  }

  return { rating, played };
}
