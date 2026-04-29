import React, { useCallback, useEffect, useState } from "react";
import { apiRequest, jsonBody } from "../lib/api.js";
import { cachedApiRequest, invalidateApiCache, invalidatePoolDataCache } from "../lib/apiCache.js";

function fmtDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function playerName(players, id) {
  return players.find((player) => player.id === id)?.name ?? "未知球员";
}

function statusLabel(status) {
  if (status === "PENDING") return "待审核";
  if (status === "APPROVED") return "已通过";
  if (status === "REJECTED") return "已驳回";
  return status ?? "-";
}

function tagLabel(tag) {
  return tag === "live" ? "直播" : "练习赛";
}

function handicapLabel(report, players) {
  if (!report.isHandicap) return "否";

  const giver = playerName(players, report.handicapGiverId);
  const receiver = playerName(players, report.handicapReceiverId);
  return `${giver} 给 ${receiver} 放门`;
}

function reporterPlayerName(report, players) {
  return report.submittedBy?.player?.name ?? playerName(players, report.submittedBy?.playerId) ?? "未绑定球员";
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyReportIds, setBusyReportIds] = useState(() => new Set());

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
    const reason = window.prompt("请输入驳回原因（可留空）：") ?? "";
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
  }  return (
    <div>
      <h1 className="h1">审核比分</h1>
      <p className="sub">只有管理员批准后的上报比赛，才会进入正式比赛记录并参与排行榜计算。</p>

      <div className="card">
        <div className="rowBetween adminReportsToolbar" style={{ marginBottom: 12 }}>
          <div className="row adminReportsStatusTabs">
            {["PENDING", "APPROVED", "REJECTED"].map((item) => (
              <button key={item} className={status === item ? "btn btnBrand" : "btn"} type="button" onClick={() => setStatus(item)}>
                {statusLabel(item)}
              </button>
            ))}
          </div>
          <button className="btn adminReportsRefreshButton" type="button" onClick={() => load(true)}>刷新</button>
        </div>

        {error && <div className="errorBox" style={{ marginBottom: 12 }}>{error}</div>}
        {loading ? (
          <div className="sub">加载中...</div>
        ) : (
          <div className="tableWrap">
            <table className="adminReportsTable">
              <thead>
                <tr>
                  <th>比赛</th>
                  <th>时间</th>
                  <th>标签</th>
                  <th>左侧</th>
                  <th>比分</th>
                  <th>右侧</th>
                  <th>胜者</th>
                  <th>放门</th>
                  <th>上报人</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ color: "var(--muted)" }}>暂无记录。</td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id}>
                      <td style={{ fontWeight: 900 }}>{report.matchName}</td>
                      <td>{fmtDate(report.dateISO)}</td>
                      <td>{tagLabel(report.tag)}</td>
                      <td>{playerName(players, report.leftPlayerId)}</td>
                      <td>{report.leftScore} : {report.rightScore}</td>
                      <td>{playerName(players, report.rightPlayerId)}</td>
                      <td>{playerName(players, report.winnerId)}</td>
                      <td>{handicapLabel(report, players)}</td>
                      <td>{reporterPlayerName(report, players)}</td>
                      <td>{statusLabel(report.status)}</td>
                      <td>
                        {report.status === "PENDING" ? (
                          <div className="row">
                            <button className="btn btnBrand" type="button" disabled={busyReportIds.has(report.id)} onClick={() => approve(report.id)}>通过</button>
                            <button className="btn btnDanger" type="button" disabled={busyReportIds.has(report.id)} onClick={() => reject(report.id)}>驳回</button>
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
