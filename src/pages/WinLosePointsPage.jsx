import React, { useCallback, useEffect, useState } from "react";
import { INTERNAL_POINTS_NAME } from "../constants/labels.js";
import { apiRequest, buildQuery } from "../lib/api.js";

const WIN_POINTS = 20;
const LOSE_POINTS = 15;
const STREAK_BONUS = 10;

function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function playerName(players, id) {
  return players.find((player) => player.id === id)?.name ?? "Unknown";
}

export default function WinLosePointsPage() {
  const [q, setQ] = useState("");
  const [cutoffLocal, setCutoffLocal] = useState("");
  const [players, setPlayers] = useState([]);
  const [computed, setComputed] = useState({ rows: [], logs: [], totalMatchesInRange: 0, countedMatches: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cutoffISO = cutoffLocal ? new Date(cutoffLocal).toISOString() : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pointsResult, playerResult] = await Promise.all([
        apiRequest(`/leaderboard/win-lose${buildQuery({ q, cutoffISO })}`),
        apiRequest("/players"),
      ]);
      setComputed(pointsResult);
      setPlayers(playerResult.players);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [q, cutoffISO]);

  useEffect(() => {
    load();
  }, [load]);

  const logsDesc = [...computed.logs].sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()).slice(0, 40);

  return (
    <div>
      <div className="pageTitle">
        <div>
          <h2 style={{ margin: 0 }}>胜负积分榜（非{INTERNAL_POINTS_NAME}）</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            后端按原页面逻辑计算：胜 +{WIN_POINTS}，负 -{LOSE_POINTS}，连胜/连败每满 3 场额外 ±{STREAK_BONUS}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr auto", gap: 10 }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索球员" />
          <input className="input" type="datetime-local" value={cutoffLocal} onChange={(e) => setCutoffLocal(e.target.value)} title="截止日期（为空=统计全部）" />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" type="button" onClick={() => setCutoffLocal("")}>清空截止日期</button>
            <button className="btn" type="button" onClick={load}>刷新</button>
          </div>
        </div>

        <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
          统计范围内比赛：{computed.countedMatches} / {computed.totalMatchesInRange} 场
          {cutoffLocal ? `（截止到 ${fmtDate(cutoffISO)}）` : "（全部日期）"}
        </div>
      </div>

      {error && <div className="errorBox" style={{ marginTop: 12 }}>{error}</div>}
      {loading ? (
        <div className="card" style={{ marginTop: 12 }}>加载中...</div>
      ) : (
        <>
          <div className="card" style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
            <table className="winLosePointsTable" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--soft)" }}>
                <tr>
                  <th>#</th>
                  <th>球员</th>
                  <th>积分</th>
                  <th>段位</th>
                  <th>战绩</th>
                  <th>当前连击</th>
                  <th>最后比赛时间</th>
                </tr>
              </thead>
              <tbody>
                {computed.rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ color: "var(--muted)" }}>暂无数据</td></tr>
                ) : (
                  computed.rows.map((row, idx) => {
                    const streak = row.winStreak > 0 ? `连胜 ${row.winStreak}` : row.loseStreak > 0 ? `连败 ${row.loseStreak}` : "-";
                    return (
                      <tr key={row.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 700 }}>{row.name}</td>
                        <td style={{ fontWeight: 700 }}>{row.points}</td>
                        <td>{row.tier}</td>
                        <td>{row.wins}胜 {row.losses}负</td>
                        <td>{streak}</td>
                        <td>{row.lastMatchISO ? fmtDate(row.lastMatchISO) : "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: 14, borderBottom: "1px solid var(--line)", fontWeight: 900 }}>最近 40 场积分变动</div>
            <table className="pointsLogTable" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--soft)" }}>
                <tr>
                  <th>时间</th>
                  <th>比赛</th>
                  <th>胜者变化</th>
                  <th>败者变化</th>
                </tr>
              </thead>
              <tbody>
                {logsDesc.length === 0 ? (
                  <tr><td colSpan={4} style={{ color: "var(--muted)" }}>暂无可展示的比赛记录</td></tr>
                ) : (
                  logsDesc.map((log) => {
                    const winner = playerName(players, log.winnerId);
                    const loser = playerName(players, log.loserId);
                    const winnerExtra = log.winnerStreak % 3 === 0 ? "（连胜奖励）" : "";
                    const loserExtra = log.loserStreak % 3 === 0 ? "（连败惩罚）" : "";
                    return (
                      <tr key={log.id}>
                        <td>{fmtDate(log.dateISO)}</td>
                        <td>{log.matchName}</td>
                        <td style={{ color: "var(--primary)" }}>{winner} +{log.winnerDelta} {winnerExtra}</td>
                        <td style={{ color: "var(--danger)" }}>{loser} {log.loserDelta} {loserExtra}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
