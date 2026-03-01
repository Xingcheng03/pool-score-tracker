import React, { useMemo, useState } from "react";
import { getMatches, getPlayers } from "../data/store.js";

const BASE_POINTS = 1000;
const WIN_POINTS = 20;
const LOSE_POINTS = 15;
const STREAK_BONUS = 10;

function compareStr(a, b) {
  return String(a).localeCompare(String(b), "zh-Hans-CN", { sensitivity: "base" });
}

function safeTime(iso) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function tierFromPoints(points) {
  if (points >= 1400) return "王者";
  if (points >= 1300) return "大师";
  if (points >= 1200) return "钻石";
  if (points >= 1100) return "铂金";
  if (points >= 1000) return "黄金";
  if (points >= 900) return "白银";
  return "青铜";
}

function buildWinLoseRows(players, matches, opts = {}) {
  const q = String(opts.q ?? "").trim().toLowerCase();
  const cutoffMs = opts.cutoffISO ? safeTime(opts.cutoffISO) : Infinity;

  const state = new Map(
    players.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name ?? "Unknown",
        points: BASE_POINTS,
        wins: 0,
        losses: 0,
        played: 0,
        winStreak: 0,
        loseStreak: 0,
        lastMatchISO: null,
      },
    ]),
  );

  const ordered = [...matches]
    .filter((m) => safeTime(m.dateISO) <= cutoffMs)
    .sort((a, b) => safeTime(a.dateISO) - safeTime(b.dateISO));

  const logs = [];

  for (const m of ordered) {
    if (!m?.winnerId) continue;

    const leftId = m.leftPlayerId;
    const rightId = m.rightPlayerId;
    const winnerId = m.winnerId;
    const loserId = winnerId === leftId ? rightId : winnerId === rightId ? leftId : null;

    if (!winnerId || !loserId) continue;

    const winner = state.get(winnerId);
    const loser = state.get(loserId);
    if (!winner || !loser) continue;

    winner.played += 1;
    loser.played += 1;
    winner.wins += 1;
    loser.losses += 1;

    winner.winStreak += 1;
    winner.loseStreak = 0;
    loser.loseStreak += 1;
    loser.winStreak = 0;

    let winnerDelta = WIN_POINTS;
    let loserDelta = -LOSE_POINTS;

    if (winner.winStreak % 3 === 0) winnerDelta += STREAK_BONUS;
    if (loser.loseStreak % 3 === 0) loserDelta -= STREAK_BONUS;

    winner.points += winnerDelta;
    loser.points += loserDelta;

    winner.lastMatchISO = m.dateISO;
    loser.lastMatchISO = m.dateISO;

    logs.push({
      id: m.id,
      dateISO: m.dateISO,
      matchName: m.matchName ?? "未命名比赛",
      winnerId,
      loserId,
      winnerDelta,
      loserDelta,
      winnerStreak: winner.winStreak,
      loserStreak: loser.loseStreak,
    });
  }

  let rows = [...state.values()].map((r) => ({
    ...r,
    tier: tierFromPoints(r.points),
  }));

  if (q) {
    rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  }

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return compareStr(a.name, b.name);
  });

  return {
    rows,
    logs,
    totalMatchesInRange: ordered.length,
    countedMatches: logs.length,
  };
}

export default function WinLosePointsPage() {
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [cutoffLocal, setCutoffLocal] = useState("");

  const players = useMemo(() => getPlayers(), [tick]);
  const matches = useMemo(() => getMatches("all"), [tick]);

  const cutoffISO = cutoffLocal ? new Date(cutoffLocal).toISOString() : "";

  const computed = useMemo(() => {
    return buildWinLoseRows(players, matches, { q, cutoffISO });
  }, [players, matches, q, cutoffISO]);

  const logsDesc = useMemo(() => {
    return [...computed.logs].sort((a, b) => safeTime(b.dateISO) - safeTime(a.dateISO)).slice(0, 40);
  }, [computed.logs]);

  return (
    <div>
      <div className="pageTitle">
        <div>
          <h2 style={{ margin: 0 }}>胜负积分榜（非 Fargo）</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            全部比赛按日期顺序结算：胜 +{WIN_POINTS}，负 -{LOSE_POINTS}，连胜/连败每满 3 场额外 ±{STREAK_BONUS}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr auto", gap: 10 }}>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索球员"
          />

          <input
            className="input"
            type="datetime-local"
            value={cutoffLocal}
            onChange={(e) => setCutoffLocal(e.target.value)}
            title="截止日期（为空=统计全部）"
          />

          <div className="row" style={{ gap: 8 }}>
            <button className="btn" type="button" onClick={() => setCutoffLocal("")}>清空截止日期</button>
            <button className="btn" type="button" onClick={() => setTick((t) => t + 1)}>刷新</button>
          </div>
        </div>

        <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
          统计范围内比赛：{computed.countedMatches} / {computed.totalMatchesInRange} 场
          {cutoffLocal ? `（截止到 ${fmtDate(cutoffISO)}）` : "（全部日期）"}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "var(--soft)" }}>
            <tr>
              <th style={{ padding: 12 }}>#</th>
              <th style={{ padding: 12 }}>球员</th>
              <th style={{ padding: 12 }}>积分</th>
              <th style={{ padding: 12 }}>段位</th>
              <th style={{ padding: 12 }}>战绩</th>
              <th style={{ padding: 12 }}>当前连击</th>
              <th style={{ padding: 12 }}>最后比赛时间</th>
            </tr>
          </thead>
          <tbody>
            {computed.rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: "var(--muted)" }}>暂无数据</td>
              </tr>
            ) : (
              computed.rows.map((r, idx) => {
                const streak = r.winStreak > 0 ? `连胜 ${r.winStreak}` : r.loseStreak > 0 ? `连败 ${r.loseStreak}` : "-";
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: 12 }}>{idx + 1}</td>
                    <td style={{ padding: 12, fontWeight: 700 }}>{r.name}</td>
                    <td style={{ padding: 12, fontWeight: 700 }}>{r.points}</td>
                    <td style={{ padding: 12 }}>{r.tier}</td>
                    <td style={{ padding: 12 }}>{r.wins}胜 {r.losses}负</td>
                    <td style={{ padding: 12 }}>{streak}</td>
                    <td style={{ padding: 12 }}>{r.lastMatchISO ? fmtDate(r.lastMatchISO) : "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid var(--line)", fontWeight: 900 }}>最近 40 场积分变动</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "var(--soft)" }}>
            <tr>
              <th style={{ padding: 12 }}>时间</th>
              <th style={{ padding: 12 }}>比赛</th>
              <th style={{ padding: 12 }}>胜者变化</th>
              <th style={{ padding: 12 }}>败者变化</th>
            </tr>
          </thead>
          <tbody>
            {logsDesc.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 16, color: "var(--muted)" }}>暂无可展示的比赛记录</td>
              </tr>
            ) : (
              logsDesc.map((x) => {
                const winner = players.find((p) => p.id === x.winnerId)?.name ?? "Unknown";
                const loser = players.find((p) => p.id === x.loserId)?.name ?? "Unknown";
                const winnerExtra = x.winnerStreak % 3 === 0 ? "（连胜奖励）" : "";
                const loserExtra = x.loserStreak % 3 === 0 ? "（连败惩罚）" : "";
                return (
                  <tr key={x.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: 12 }}>{fmtDate(x.dateISO)}</td>
                    <td style={{ padding: 12 }}>{x.matchName}</td>
                    <td style={{ padding: 12, color: "var(--primary)" }}>{winner} +{x.winnerDelta} {winnerExtra}</td>
                    <td style={{ padding: 12, color: "var(--danger)" }}>{loser} {x.loserDelta} {loserExtra}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
