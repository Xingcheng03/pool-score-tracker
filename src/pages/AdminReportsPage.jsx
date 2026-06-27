import React, { useCallback, useEffect, useState } from "react";
import { apiRequest, jsonBody } from "../lib/api.js";
import { cachedApiRequest, invalidateApiCache, invalidatePoolDataCache } from "../lib/apiCache.js";
import { useT } from "../lib/i18n.jsx";

function fmtDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

export default function AdminReportsPage() {
  const t = useT();
  const [reports, setReports] = useState([]);
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyReportIds, setBusyReportIds] = useState(() => new Set());

  function playerName(id) {
    return players.find((player) => player.id === id)?.name ?? t("未知球员", "Unknown player");
  }

  function isDoubles(report) {
    return report.matchType === "doubles";
  }

  function teamLabel(report, side) {
    if (!isDoubles(report)) {
      return playerName(side === "left" ? report.leftPlayerId : report.rightPlayerId);
    }
    const p1 = side === "left" ? report.leftPlayerId : report.rightPlayerId;
    const p2 = side === "left" ? report.leftPlayer2Id : report.rightPlayer2Id;
    return `${playerName(p1)} / ${playerName(p2)}`;
  }

  function winnerLabel(report) {
    if (!isDoubles(report)) return playerName(report.winnerId);
    const leftWon = report.leftScore > report.rightScore;
    return teamLabel(report, leftWon ? "left" : "right");
  }

  function statusLabel(s) {
    if (s === "PENDING") return t("待审核", "Pending");
    if (s === "APPROVED") return t("已通过", "Approved");
    if (s === "REJECTED") return t("已驳回", "Rejected");
    return s ?? "-";
  }

  function tagLabel(tag) {
    return tag === "live" ? t("直播", "Live") : t("练习赛", "Practice");
  }

  function handicapLabel(report) {
    if (!report.isHandicap) return t("否", "No");
    const giver = playerName(report.handicapGiverId);
    const receiver = playerName(report.handicapReceiverId);
    return t(`${giver} 给 ${receiver} 放门`, `${giver} gives handicap to ${receiver}`);
  }

  function reporterPlayerName(report) {
    return report.submittedBy?.player?.name
      ?? (report.submittedBy?.playerId ? playerName(report.submittedBy.playerId) : null)
      ?? t("未绑定球员", "No linked player");
  }

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const [reportResult, playerResult] = await Promise.all([
        apiRequest(`/match-reports?status=${status}`),
        cachedApiRequest("/players", { force }),
      ]);
      setReports(reportResult.reports);
      setPlayers(playerResult.players);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  function markReportBusy(id, busy) {
    setBusyReportIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function removeReportImmediately(id) {
    const removedReport = reports.find((report) => report.id === id);
    const removedIndex = reports.findIndex((report) => report.id === id);
    setReports((current) => current.filter((report) => report.id !== id));
    return { removedReport, removedIndex, wasLastVisible: reports.length <= 1 };
  }

  function restoreReport({ removedReport, removedIndex }) {
    if (!removedReport) return;
    setReports((current) => {
      if (current.some((report) => report.id === removedReport.id)) return current;
      const next = [...current];
      next.splice(Math.max(0, Math.min(removedIndex, next.length)), 0, removedReport);
      return next;
    });
  }

  async function approve(id) {
    markReportBusy(id, true);
    setError("");
    const optimistic = status === "PENDING" ? removeReportImmediately(id) : null;
    try {
      await apiRequest(`/match-reports/${id}/approve`, { method: "POST" });
      invalidateApiCache(["/match-reports"]);
      invalidatePoolDataCache();
      if (optimistic?.wasLastVisible) await load(true);
    } catch (err) {
      if (optimistic) restoreReport(optimistic);
      setError(err?.message ?? String(err));
    } finally {
      markReportBusy(id, false);
    }
  }

  async function reject(id) {
    const reason = window.prompt(t("请输入驳回原因（可留空）：", "Reason for rejection (optional):")) ?? "";
    markReportBusy(id, true);
    setError("");
    const optimistic = status === "PENDING" ? removeReportImmediately(id) : null;
    try {
      await apiRequest(`/match-reports/${id}/reject`, {
        method: "POST",
        body: jsonBody({ reason }),
      });
      invalidateApiCache(["/match-reports"]);
      if (optimistic?.wasLastVisible) await load(true);
    } catch (err) {
      if (optimistic) restoreReport(optimistic);
      setError(err?.message ?? String(err));
    } finally {
      markReportBusy(id, false);
    }
  }

  return (
    <div>
      <h1 className="h1">{t("审核比分", "Review Reports")}</h1>
      <p className="sub">{t(
        "只有管理员批准后的上报比赛，才会进入正式比赛记录并参与排行榜计算。",
        "Only after admin approval do submitted matches become official records and count toward the leaderboard.",
      )}</p>

      <div className="card">
        <div className="rowBetween adminReportsToolbar" style={{ marginBottom: 12 }}>
          <div className="row adminReportsStatusTabs">
            {["PENDING", "APPROVED", "REJECTED"].map((item) => (
              <button key={item} className={status === item ? "btn btnBrand" : "btn"} type="button" onClick={() => setStatus(item)}>
                {statusLabel(item)}
              </button>
            ))}
          </div>
          <button className="btn adminReportsRefreshButton" type="button" onClick={() => load(true)}>{t("刷新", "Refresh")}</button>
        </div>

        {error && <div className="errorBox" style={{ marginBottom: 12 }}>{error}</div>}
        {loading ? (
          <div className="sub">{t("加载中...", "Loading...")}</div>
        ) : (
          <div className="tableWrap">
            <table className="adminReportsTable">
              <thead>
                <tr>
                  <th>{t("比赛", "Match")}</th>
                  <th>{t("时间", "Time")}</th>
                  <th>{t("标签", "Tag")}</th>
                  <th>{t("左侧", "Left")}</th>
                  <th>{t("比分", "Score")}</th>
                  <th>{t("右侧", "Right")}</th>
                  <th>{t("胜者", "Winner")}</th>
                  <th>{t("放门", "Handicap")}</th>
                  <th>{t("上报人", "Reporter")}</th>
                  <th>{t("状态", "Status")}</th>
                  <th>{t("操作", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ color: "var(--muted)" }}>{t("暂无记录。", "No records.")}</td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id}>
                      <td style={{ fontWeight: 900 }}>
                        {report.matchName}
                        {isDoubles(report) && <span className="badge" style={{ marginLeft: 6 }}>{t("双打", "Doubles")}</span>}
                      </td>
                      <td>{fmtDate(report.dateISO)}</td>
                      <td>{tagLabel(report.tag)}</td>
                      <td>{teamLabel(report, "left")}</td>
                      <td>{report.leftScore} : {report.rightScore}</td>
                      <td>{teamLabel(report, "right")}</td>
                      <td>{winnerLabel(report)}</td>
                      <td>{isDoubles(report) ? "-" : handicapLabel(report)}</td>
                      <td>{reporterPlayerName(report)}</td>
                      <td>{statusLabel(report.status)}</td>
                      <td>
                        {report.status === "PENDING" ? (
                          <div className="row">
                            <button className="btn btnBrand" type="button" disabled={busyReportIds.has(report.id)} onClick={() => approve(report.id)}>{t("通过", "Approve")}</button>
                            <button className="btn btnDanger" type="button" disabled={busyReportIds.has(report.id)} onClick={() => reject(report.id)}>{t("驳回", "Reject")}</button>
                          </div>
                        ) : (
                          report.rejectionReason || "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
