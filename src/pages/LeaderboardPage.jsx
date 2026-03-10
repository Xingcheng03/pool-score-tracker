// src/pages/LeaderboardPage.jsx
import React, { useMemo, useState } from "react";
import { buildFargoLiteLeaderboard, tagLabel, exportLeaderboardToJSON, exportLeaderboardToExcel } from "../data/store.js";

export default function LeaderboardPage() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("all"); // all | practice | live
  const [minMatches, setMinMatches] = useState(0);

  // 鎺掑簭锛歳ating | rackWinRate | trend10 | matches
  // 鈿狅笍 娉ㄦ剰锛氭垜浠紶缁?store 鏃舵妸 matches 鏄犲皠鎴?effMatches锛堟姌绠楀満娆★級
  const [sortKey, setSortKey] = useState("rating");
  const [sortDir, setSortDir] = useState("desc"); // asc | desc

  const rows = useMemo(() => {
    const keyMap = {
      rating: "rating",
      rackWinRate: "rackWinRate",
      trend10: "trend10",
      matches: "matches", // store 鍐呴儴浼氱敤 effMatches 鍋氭帓搴忓瓧娈碉紙瑙佷綘瀹炵幇锛?
    };

    return buildFargoLiteLeaderboard({
      mode,
      q,
      minMatches,
      sortKey: keyMap[sortKey] ?? "rating",
      sortDir,
    });
  }, [mode, q, minMatches, sortKey, sortDir]);

  const topCount = Math.min(3, rows.length);
  const topThree = rows.slice(0, topCount);
  const tableRows = rows.slice(topCount);

  function toggleSort(k) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  return (
    <div>
      <div className="pageTitle">
        <div>
          <h2 style={{ margin: 0 }}>球员积分榜</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            简化 Fargo：按“局胜率 + 对手强度”计算 Rating（直播权重大于练习）
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 10 }}>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索球员..."
          />

          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">全部比赛</option>
            <option value="practice">{tagLabel("practice")}</option>
            <option value="live">{tagLabel("live")}</option>
          </select>

          <select className="input" value={minMatches} onChange={(e) => setMinMatches(Number(e.target.value))}>
            <option value={0}>不限可信度</option>
            <option value={5}>至少 5 场</option>
            <option value={10}>至少 10 场</option>
            <option value={30}>至少 30 场</option>
          </select>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
                说明：排名按 Rating 默认降序
            </div>

            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                {/* <button
                className="btn"
                type="button"
                onClick={() => exportLeaderboardToJSON({ mode, q, minMatches, sortKey, sortDir })}
                >
                导出积分榜 JSON
                </button> */}

                <button
                className="btn"
                type="button"
                onClick={() => exportLeaderboardToExcel({ mode, q, minMatches, sortKey, sortDir })}
                >
                导出积分榜 Excel
                </button>
            </div>
            </div>

        </div>
      </div>

      <div className="leaderboardSplit">
        {topThree.length > 0 && (
          <div className="leaderboardTop3">
            {topThree.map((r, idx) => {
              const rank = idx + 1;
              return (
                <div key={r.id} className={`leaderboardTopCard leaderboardTopCardRank${rank}`}>
                  <div className="leaderboardTopCardHeader">
                    <div className={`leaderboardTopCardRankNum leaderboardTopCardRankNum${rank}`}>{rank}</div>
                    <div className="leaderboardTopCardName">{r.name}</div>
                    {rank === 1 && <div className="leaderboardTopCardTrophy">{"\uD83C\uDFC6"}</div>}
                  </div>
                  <div className="leaderboardTopCardStats">
                    <span>Rating: {Math.round(r.rating)}</span>
                    <span>段位: {r.tier}</span>
                    <span style={{ color: r.trend10 >= 0 ? "var(--primary)" : "var(--danger)" }}>
                      Trend: {r.trend10 >= 0 ? "+" : ""}
                      {r.trend10}
                    </span>
                    <span>局胜率: {(r.rackWinRate * 100).toFixed(1)}%</span>
                    <span>练习局胜率: {(r.pracRackWinRate * 100).toFixed(1)}%</span>
                    <span>直播局胜率: {(r.liveRackWinRate * 100).toFixed(1)}%</span>
                    <span>可信度: {r.confidence}</span>
                    <span>场次/局数: {r.totalMatches}/{r.racks}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table */}
        <div className="card leaderboardTableCard" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--soft)" }}>
              <tr>
                {[
                  ["#", null],
                  ["球员", null],
                  ["Rating", "rating"],
                  ["段位", null],
                  ["可信度", "matches"],
                  ["局胜率", "rackWinRate"],
                  ["最近10场趋势", "trend10"],
                  ["直播局胜率", null],
                  ["练习局胜率", null],
                ].map(([label, key]) => (
                  <th
                    key={label}
                    onClick={() => key && toggleSort(key)}
                    style={{
                      textAlign: "left",
                      padding: "12px 12px",
                      fontSize: 13,
                      color: "var(--muted)",
                      borderBottom: "1px solid var(--line)",
                      cursor: key ? "pointer" : "default",
                      userSelect: "none",
                    }}
                  >
                    {label}{key && sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {tableRows.map((r, idx) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: 12, fontSize: 13 }}>{topCount + idx + 1}</td>
                  <td style={{ padding: 12, fontWeight: 700 }}>{r.name}</td>
                  <td style={{ padding: 12 }}>{Math.round(r.rating)}</td>
                  <td style={{ padding: 12 }}>{r.tier}</td>
                  <td style={{ padding: 12 }}>
                    {r.confidence} · {r.totalMatches}场 / {r.racks}局
                  </td>
                  <td style={{ padding: 12 }}>{(r.rackWinRate * 100).toFixed(1)}%</td>
                  <td style={{ padding: 12, color: r.trend10 >= 0 ? "var(--primary)" : "var(--danger)" }}>
                    {r.trend10 >= 0 ? "+" : ""}{r.trend10}
                  </td>
                  <td style={{ padding: 12 }}>{(r.liveRackWinRate * 100).toFixed(1)}%</td>
                  <td style={{ padding: 12 }}>{(r.pracRackWinRate * 100).toFixed(1)}%</td>
                </tr>
              ))}

              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 18, color: "var(--muted)" }}>
                    暂无符合条件的数据。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>
        提示：可信度越高（场次越多），积分波动越小，排名更可靠。
      </div>
      <div
        className="card"
        style={{
          marginTop: 16,
          fontSize: 13,
          lineHeight: 1.7,
          color: "var(--muted)",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6, color: "var(--text)" }}>
          积分计算规则说明（Fargo-lite）
        </div>
        <div>
          评分由局胜率、对手强度、比赛标签权重与稳定系数共同计算。
          场次越多，评分越稳定。放门规则会按半场折算影响统计与积分波动。
        </div>
      </div>

    </div>
  );
}
