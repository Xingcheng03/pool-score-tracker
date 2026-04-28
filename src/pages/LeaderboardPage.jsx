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
          <div className="leaderboardMainColumn">
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

      <div className="card leaderboardRulesCard">
        <div className="leaderboardRulesTitle">积分计算规则说明</div>
        <div className="leaderboardRulesGrid">
          <div className="leaderboardRuleBlock">
            <h3>1. 基础逻辑</h3>
            <p>每位球员初始 Rating 都是 500。系统会把筛选范围内的正式比赛按时间从早到晚重新回放，每打一场就更新一次双方 Rating。</p>
            <p>单场核心公式是：变化值 = 40 ×（实际局胜率 - 预期局胜率）× 比赛权重 × 稳定系数。</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>2. 实际局胜率与预期局胜率</h3>
            <p>实际局胜率按比分算，例如 7:3 获胜，实际局胜率就是 7 / 10 = 70%。</p>
            <p>预期局胜率由双方赛前 Rating 计算：1 / (1 + 10^((对手Rating - 我的Rating) / 200))。强者本来就应该赢更多局，所以强者只小赢会少加分，弱者打出高于预期的比分会多加分。</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>3. 练习赛和直播权重</h3>
            <p>练习赛基础权重是 1.0，直播基础权重是 1.5。也就是说，同样的比分表现，直播比赛对 Rating 的影响比练习赛更大。</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>4. 非放门比赛的强弱对阵加权</h3>
            <p>非放门比赛会根据双方赛前排名差调整权重。排名差小于 5 名时不额外调整。</p>
            <p>练习赛：差 5-9 名，强者赢权重 0.8、爆冷权重 1.2；差 10-14 名，强者赢 0.6、爆冷 1.4；差 15 名以上，强者赢 0.4、爆冷 1.6。</p>
            <p>直播：差 5-9 名，强者赢 1.3、爆冷 1.7；差 10-14 名，强者赢 1.1、爆冷 1.9；差 15 名以上，强者赢 0.9、爆冷 2.1。</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>5. 放门比赛怎么算</h3>
            <p>放门比赛不再套用强弱排名差加权，因为让球已经补偿了强弱差距。</p>
            <p>如果放门方获胜，按标签基础权重计算：练习赛 1.0，直播 1.5。如果被放门方获胜，Rating 权重减半：练习赛 0.5，直播 0.75。</p>
            <p>排行榜里的局数、折算场次、胜负统计也会按同一放门折算：只有“被放门方获胜”时，双方本场按练习赛 0.5 或直播 0.75 计入；其他情况按 1 场计入。</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>6. 稳定系数</h3>
            <p>打得越多，单场波动越小。稳定系数 = 1 / sqrt(1 + 已参加场次 / 10)。新玩家变化更明显，老玩家更稳定。</p>
            <p>例如一个人此前 0 场，稳定系数是 1；此前 30 场，稳定系数约为 0.5，本场加减分会被压到一半左右。</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>7. 左右双方如何同时更新</h3>
            <p>系统先按左侧球员计算 delta。左侧 Rating 增加 delta × 左侧稳定系数；右侧 Rating 减少 delta × 右侧稳定系数。delta 可能为负，所以左侧表现低于预期会扣分，右侧相应加分。</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>8. 排行榜其他字段</h3>
            <p>局胜率 = 折算后赢下的局数 / 折算后总局数。直播局胜率和练习局胜率分别只看对应标签。</p>
            <p>最近10场趋势 = 最近 10 场中每场（我的局数 - 对手局数）× 2，并限制在 -20 到 +20 之间，再叠加放门折算。</p>
            <p>可信度按折算场次显示：低于 10 场为低，10 到 29.99 场为中，30 场及以上为高。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
