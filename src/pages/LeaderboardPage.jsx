import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { INTERNAL_POINTS_NAME } from "../constants/labels.js";
import { apiRequest, buildQuery } from "../lib/api.js";

function pct(value) {
  return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

function tierStyle(tier) {
  if (String(tier ?? "").includes("大匕首")) {
    return {
      color: "var(--danger)",
      textShadow: "0 0 6px rgba(225,29,72,.55), 0 0 12px rgba(225,29,72,.35)",
      WebkitTextStroke: "0.4px rgba(255, 120, 150, .7)",
    };
  }
  if (String(tier ?? "").includes("匕首")) return { color: "var(--danger)" };
  return undefined;
}

export default function LeaderboardPage() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("all");
  const [seasonId, setSeasonId] = useState("all");
  const [minMatches, setMinMatches] = useState(0);
  const [sortKey, setSortKey] = useState("rating");
  const [sortDir, setSortDir] = useState("desc");
  const [rows, setRows] = useState([]);
  const [winLoseRows, setWinLoseRows] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = buildQuery({ mode, seasonId, q, minMatches, sortKey, sortDir });
      const [leaderboard, winLose, seasonResult] = await Promise.all([
        apiRequest(`/leaderboard${query}`),
        apiRequest(`/leaderboard/win-lose${buildQuery({ q })}`),
        apiRequest("/leaderboard/seasons"),
      ]);
      setRows(leaderboard.rows);
      setWinLoseRows(winLose.rows);
      setSeasons(seasonResult.seasons);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [mode, seasonId, q, minMatches, sortKey, sortDir]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const topThree = rows.slice(0, Math.min(3, rows.length));
  const tableRows = rows.slice(topThree.length);
  const seasonQuery = seasonId === "all" ? "" : `?season=${seasonId}`;

  return (
    <div>
      <div className="pageTitle">
        <div>
          <h2 style={{ margin: 0 }}>球员积分榜</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            {INTERNAL_POINTS_NAME}：后端读取正式比赛记录，并按原 `store.js` 的 Rating 逻辑计算。
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="leaderboardFilterGrid">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索球员..." />

          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">全部比赛</option>
            <option value="practice">练习赛</option>
            <option value="live">直播</option>
          </select>

          <select className="input" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            <option value="all">全部赛季</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>{season.label}</option>
            ))}
          </select>

          <select className="input" value={minMatches} onChange={(e) => setMinMatches(Number(e.target.value))}>
            <option value={0}>不限可信度</option>
            <option value={5}>至少 5 场</option>
            <option value={10}>至少 10 场</option>
            <option value={30}>至少 30 场</option>
          </select>

          <button className="btn" type="button" onClick={load}>刷新</button>
        </div>
      </div>

      {error && <div className="errorBox" style={{ marginTop: 12 }}>{error}</div>}
      {loading ? (
        <div className="card" style={{ marginTop: 12 }}>加载中...</div>
      ) : (
        <div className="leaderboardSplit">
          {topThree.length > 0 && (
            <div className="leaderboardTop3">
              {topThree.map((row, idx) => {
                const rank = idx + 1;
                return (
                  <div key={row.id} className={`leaderboardTopCard leaderboardTopCardRank${rank}`}>
                    <div className="leaderboardTopCardHeader">
                      <div className={`leaderboardTopCardRankNum leaderboardTopCardRankNum${rank}`}>{rank}</div>
                      <Link className="leaderboardTopCardName" to={`/players/${row.id}${seasonQuery}`}>
                        {row.name}
                      </Link>
                      {rank === 1 && <div className="leaderboardTopCardTrophy">{"\uD83C\uDFC6"}</div>}
                    </div>
                    <div className="leaderboardTopCardStats">
                      <span>Rating: {Math.round(row.rating)}</span>
                      <span style={tierStyle(row.tier)}>段位: {row.tier}</span>
                      <span style={{ color: row.trend10 >= 0 ? "var(--primary)" : "var(--danger)" }}>
                        Trend: {row.trend10 >= 0 ? "+" : ""}{row.trend10}
                      </span>
                      <span>局胜率: {pct(row.rackWinRate)}</span>
                      <span>练习局胜率: {pct(row.pracRackWinRate)}</span>
                      <span>直播局胜率: {pct(row.liveRackWinRate)}</span>
                      <span>可信度: {row.confidence}</span>
                      <span>局数: {row.racks}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card leaderboardTableCard" style={{ padding: 0, overflow: "hidden" }}>
            <table className="leaderboardMainTable" style={{ width: "100%", borderCollapse: "collapse" }}>
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
                    <th key={label} onClick={() => key && toggleSort(key)} style={{ cursor: key ? "pointer" : "default" }}>
                      {label}{key && sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr><td colSpan={9} style={{ color: "var(--muted)" }}>暂无符合条件的数据。</td></tr>
                ) : (
                  tableRows.map((row, idx) => (
                    <tr key={row.id}>
                      <td>{topThree.length + idx + 1}</td>
                      <td style={{ fontWeight: 700 }}><Link to={`/players/${row.id}${seasonQuery}`}>{row.name}</Link></td>
                      <td>{Math.round(row.rating)}</td>
                      <td style={tierStyle(row.tier)}>{row.tier}</td>
                      <td>{row.confidence} · {row.effMatches}场 / {row.racks}局</td>
                      <td>{pct(row.rackWinRate)}</td>
                      <td style={{ color: row.trend10 >= 0 ? "var(--primary)" : "var(--danger)" }}>
                        {row.trend10 >= 0 ? "+" : ""}{row.trend10}
                      </td>
                      <td>{pct(row.liveRackWinRate)}</td>
                      <td>{pct(row.pracRackWinRate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card leaderboardWinLoseCard" style={{ padding: 0, overflow: "hidden" }}>
            <div className="leaderboardWinLoseHead">胜负战绩榜</div>
            <div className="leaderboardWinLoseWrap">
              <table className="leaderboardMiniTable" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "var(--soft)" }}>
                  <tr>
                    <th>#</th>
                    <th>球员</th>
                    <th>战绩</th>
                    <th>连击</th>
                  </tr>
                </thead>
                <tbody>
                  {winLoseRows.length === 0 ? (
                    <tr><td colSpan={4} style={{ color: "var(--muted)" }}>暂无数据</td></tr>
                  ) : (
                    winLoseRows.slice(0, 24).map((row, idx) => {
                      const streak = row.winStreak > 0 ? `连胜 ${row.winStreak}` : row.loseStreak > 0 ? `连败 ${row.loseStreak}` : "-";
                      return (
                        <tr key={row.id}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 700 }}><Link to={`/players/${row.id}${seasonQuery}`}>{row.name}</Link></td>
                          <td>{row.wins}胜 {row.losses}负</td>
                          <td>{streak}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card leaderboardRulesCard" style={{ marginTop: 16 }}>
        <div className="leaderboardRulesTitle">积分计算规则说明</div>
        <div>
          后端使用和原 `store.js` 相同的 FargoLite 计算逻辑：初始 Rating 500，按比赛时间顺序回放，比较实际局胜率与预期局胜率，并按直播/练习、放门、强弱对阵和稳定系数进行加权。
        </div>
      </div>
    </div>
  );
}
