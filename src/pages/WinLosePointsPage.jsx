import React, { useCallback, useEffect, useState } from "react";
import { buildQuery } from "../lib/api.js";
import { cachedApiRequest } from "../lib/apiCache.js";
import { useDebouncedValue } from "../lib/useDebouncedValue.js";
import { useT, useTranslateTier } from "../lib/i18n.jsx";

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
  const t = useT();
  const translateTier = useTranslateTier();
  const [q, setQ] = useState("");
  const [cutoffLocal, setCutoffLocal] = useState("");
  const [players, setPlayers] = useState([]);
  const [computed, setComputed] = useState({ rows: [], logs: [], totalMatchesInRange: 0, countedMatches: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const cutoffISO = cutoffLocal ? new Date(cutoffLocal).toISOString() : "";

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const [pointsResult, playerResult] = await Promise.all([
        cachedApiRequest(`/leaderboard/win-lose${buildQuery({ q: debouncedQ, cutoffISO })}`, { force }),
        cachedApiRequest("/players", { force }),
      ]);
      setComputed(pointsResult);
      setPlayers(playerResult.players);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, cutoffISO]);

  useEffect(() => {
    load();
  }, [load]);

  const logsDesc = [...computed.logs].sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()).slice(0, 40);

  return (
    <div>
      <div className="pageTitle">
        <div>
          <h2 style={{ margin: 0 }}>{t(
            "胜负积分榜（非街灯榜）",
            "Win/Loss Points (Non-Street-Light)",
          )}</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            {t(
              `胜 +${WIN_POINTS}，负 -${LOSE_POINTS}，连胜/连败每满 3 场额外 ±${STREAK_BONUS}`,
              `Win +${WIN_POINTS}, Loss -${LOSE_POINTS}, every 3 in a streak adds ±${STREAK_BONUS}`,
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr auto", gap: 10 }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("搜索球员", "Search players")} />
          <input className="input" type="datetime-local" value={cutoffLocal} onChange={(e) => setCutoffLocal(e.target.value)} title={t("截止日期（为空=统计全部）", "Cutoff date (blank = all)")} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" type="button" onClick={() => setCutoffLocal("")}>{t("清空截止日期", "Clear Cutoff")}</button>
            <button className="btn" type="button" onClick={() => load(true)}>{t("刷新", "Refresh")}</button>
          </div>
        </div>

        <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
          {t(
            `统计范围内比赛：${computed.countedMatches} / ${computed.totalMatchesInRange} 场`,
            `Matches counted: ${computed.countedMatches} / ${computed.totalMatchesInRange}`,
          )}
          {cutoffLocal
            ? t(`（截止到 ${fmtDate(cutoffISO)}）`, ` (until ${fmtDate(cutoffISO)})`)
            : t("（全部日期）", " (all dates)")}
        </div>
      </div>

      {error && <div className="errorBox" style={{ marginTop: 12 }}>{error}</div>}
      {loading ? (
        <div className="card" style={{ marginTop: 12 }}>{t("加载中...", "Loading...")}</div>
      ) : (
        <>
          <div className="card" style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
            <table className="winLosePointsTable" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--soft)" }}>
                <tr>
                  <th>#</th>
                  <th>{t("球员", "Player")}</th>
                  <th>{t("积分", "Points")}</th>
                  <th>{t("段位", "Tier")}</th>
                  <th>{t("战绩", "Record")}</th>
                  <th>{t("当前连击", "Current Streak")}</th>
                  <th>{t("最后比赛时间", "Last Match Time")}</th>
                </tr>
              </thead>
              <tbody>
                {computed.rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ color: "var(--muted)" }}>{t("暂无数据", "No data")}</td></tr>
                ) : (
                  computed.rows.map((row, idx) => {
                    const streak = row.winStreak > 0
                      ? t(`连胜 ${row.winStreak}`, `${row.winStreak} W streak`)
                      : row.loseStreak > 0
                      ? t(`连败 ${row.loseStreak}`, `${row.loseStreak} L streak`)
                      : "-";
                    return (
                      <tr key={row.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 700 }}>{row.name}</td>
                        <td style={{ fontWeight: 700 }}>{row.points}</td>
                        <td>{translateTier(row.tier)}</td>
                        <td>{t(`${row.wins}胜 ${row.losses}负`, `${row.wins}W ${row.losses}L`)}</td>
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
            <div style={{ padding: 14, borderBottom: "1px solid var(--line)", fontWeight: 900 }}>{t("最近 40 场积分变动", "Last 40 Points Changes")}</div>
            <table className="pointsLogTable" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--soft)" }}>
                <tr>
                  <th>{t("时间", "Time")}</th>
                  <th>{t("比赛", "Match")}</th>
                  <th>{t("胜者变化", "Winner Change")}</th>
                  <th>{t("败者变化", "Loser Change")}</th>
                </tr>
              </thead>
              <tbody>
                {logsDesc.length === 0 ? (
                  <tr><td colSpan={4} style={{ color: "var(--muted)" }}>{t("暂无可展示的比赛记录", "No match records to display")}</td></tr>
                ) : (
                  logsDesc.map((log) => {
                    const winner = playerName(players, log.winnerId);
                    const loser = playerName(players, log.loserId);
                    const winnerExtra = log.winnerStreak % 3 === 0 ? t("（连胜奖励）", " (streak bonus)") : "";
                    const loserExtra = log.loserStreak % 3 === 0 ? t("（连败惩罚）", " (slump penalty)") : "";
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
