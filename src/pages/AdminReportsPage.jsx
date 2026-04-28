import React, { useCallback, useEffect, useState } from "react";
import { apiRequest, jsonBody } from "../lib/api.js";

function fmtDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function playerName(players, id) {
  return players.find((player) => player.id === id)?.name ?? "Unknown";
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reportResult, playerResult] = await Promise.all([
        apiRequest(`/match-reports?status=${status}`),
        apiRequest("/players"),
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

  async function approve(id) {
    await apiRequest(`/match-reports/${id}/approve`, { method: "POST" });
    await load();
  }

  async function reject(id) {
    const reason = window.prompt("请输入驳回原因（可留空）：") ?? "";
    await apiRequest(`/match-reports/${id}/reject`, {
      method: "POST",
      body: jsonBody({ reason }),
    });
    await load();
  }

  return (
    <div>
      <h1 className="h1">审核比分</h1>
      <p className="sub">只有管理员批准后的上报比赛才会进入正式比赛记录，并计算进排行榜。</p>

      <div className="card">
        <div className="rowBetween" style={{ marginBottom: 12 }}>
          <div className="row">
            {["PENDING", "APPROVED", "REJECTED"].map((item) => (
              <button key={item} className={status === item ? "btn btnBrand" : "btn"} type="button" onClick={() => setStatus(item)}>
                {item === "PENDING" ? "待审核" : item === "APPROVED" ? "已通过" : "已驳回"}
              </button>
            ))}
          </div>
          <button className="btn" type="button" onClick={load}>刷新</button>
        </div>

        {error && <div className="errorBox" style={{ marginBottom: 12 }}>{error}</div>}
        {loading ? (
          <div className="sub">加载中...</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>比赛</th>
                  <th>时间</th>
                  <th>标签</th>
                  <th>左侧</th>
                  <th>比分</th>
                  <th>右侧</th>
                  <th>胜者</th>
                  <th>上报人</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ color: "var(--muted)" }}>暂无记录。</td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id}>
                      <td style={{ fontWeight: 900 }}>{report.matchName}</td>
                      <td>{fmtDate(report.dateISO)}</td>
                      <td>{report.tag === "live" ? "直播" : "练习赛"}</td>
                      <td>{playerName(players, report.leftPlayerId)}</td>
                      <td>{report.leftScore} : {report.rightScore}</td>
                      <td>{playerName(players, report.rightPlayerId)}</td>
                      <td>{playerName(players, report.winnerId)}</td>
                      <td>{report.submittedBy?.username ?? report.submittedById}</td>
                      <td>{report.status}</td>
                      <td>
                        {report.status === "PENDING" ? (
                          <div className="row">
                            <button className="btn btnBrand" type="button" onClick={() => approve(report.id)}>通过</button>
                            <button className="btn btnDanger" type="button" onClick={() => reject(report.id)}>驳回</button>
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
