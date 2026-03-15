// src/pages/LeaderboardPage.jsx
import React, { useMemo, useState } from "react";
import {
  buildFargoLiteLeaderboard,
  tagLabel,
  exportLeaderboardToJSON,
  exportLeaderboardToExcel,
  getPlayers,
  getMatches,
} from "../data/store.js";

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
  const winLoseRows = useMemo(() => {
    const players = getPlayers();
    const matches = [...getMatches("all")].sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime(),
    );

    const state = new Map(
      players.map((p) => [
        p.id,
        {
          id: p.id,
          name: p.name ?? "Unknown",
          wins: 0,
          losses: 0,
          winStreak: 0,
          loseStreak: 0,
        },
      ]),
    );

    for (const m of matches) {
      if (!m?.winnerId) continue;
      const leftId = m.leftPlayerId;
      const rightId = m.rightPlayerId;
      const winnerId = m.winnerId;
      const loserId = winnerId === leftId ? rightId : winnerId === rightId ? leftId : null;
      if (!winnerId || !loserId) continue;

      const winner = state.get(winnerId);
      const loser = state.get(loserId);
      if (!winner || !loser) continue;

      winner.wins += 1;
      loser.losses += 1;
      winner.winStreak += 1;
      winner.loseStreak = 0;
      loser.loseStreak += 1;
      loser.winStreak = 0;
    }

    const qLower = q.trim().toLowerCase();
    return [...state.values()]
      .filter((r) => !qLower || r.name.toLowerCase().includes(qLower))
      .map((r) => {
        const ratio = r.losses === 0 ? (r.wins > 0 ? Number.POSITIVE_INFINITY : 0) : r.wins / r.losses;
        const streak = r.winStreak > 0 ? `连胜 ${r.winStreak}` : r.loseStreak > 0 ? `连败 ${r.loseStreak}` : "-";
        return { ...r, ratio, streak };
      })
      .sort((a, b) => {
        if (b.ratio !== a.ratio) return b.ratio - a.ratio;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (a.losses !== b.losses) return a.losses - b.losses;
        return String(a.name).localeCompare(String(b.name), "zh-Hans-CN", { sensitivity: "base" });
      });
  }, [q]);
  const miniDense = winLoseRows.length > 14;
  const miniFontSize = winLoseRows.length > 20 ? 11 : winLoseRows.length > 16 ? 12 : 13;
  const miniCellPad = winLoseRows.length > 20 ? "7px 8px" : winLoseRows.length > 16 ? "9px 9px" : "11px 10px";
  const isBigDaggerTier = (tier) => String(tier ?? "").includes("大匕首");
  const isDaggerTier = (tier) => String(tier ?? "").includes("匕首");
  const tierStyle = (tier) => {
    if (isBigDaggerTier(tier)) {
      return {
        color: "var(--danger)",
        textShadow: "0 0 6px rgba(225,29,72,.55), 0 0 12px rgba(225,29,72,.35)",
        WebkitTextStroke: "0.4px rgba(255, 120, 150, .7)",
      };
    }
    if (isDaggerTier(tier)) {
      return { color: "var(--danger)" };
    }
    return undefined;
  };

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
                    <span style={tierStyle(r.tier)}>
                      段位: {r.tier}
                    </span>
                    <span style={{ color: r.trend10 >= 0 ? "var(--primary)" : "var(--danger)" }}>
                      Trend: {r.trend10 >= 0 ? "+" : ""}
                      {r.trend10}
                    </span>
                    <span>局胜率: {(r.rackWinRate * 100).toFixed(1)}%</span>
                    <span>练习局胜率: {(r.pracRackWinRate * 100).toFixed(1)}%</span>
                    <span>直播局胜率: {(r.liveRackWinRate * 100).toFixed(1)}%</span>
                    <span>可信度: {r.confidence}</span>
                    <span>局数: {r.racks}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table */}
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
                  <th
                    key={label}
                    onClick={() => key && toggleSort(key)}
                    style={{
                      textAlign: "center",
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
                  <td style={{ padding: 12, ...tierStyle(r.tier) }}>{r.tier}</td>
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

        <div className={`card leaderboardWinLoseCard${miniDense ? " isDense" : ""}`} style={{ padding: 0, overflow: "hidden" }}>
          <div className="leaderboardWinLoseHead">胜负战绩榜</div>
          <div className="leaderboardWinLoseWrap">
            <table className="leaderboardMiniTable" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--soft)" }}>
                <tr>
                  <th style={{ padding: miniCellPad, fontSize: miniFontSize }}>#</th>
                  <th style={{ padding: miniCellPad, fontSize: miniFontSize }}>球员</th>
                  <th style={{ padding: miniCellPad, fontSize: miniFontSize }}>战绩</th>
                  <th style={{ padding: miniCellPad, fontSize: miniFontSize }}>连击</th>
                </tr>
              </thead>
              <tbody>
                {winLoseRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: miniCellPad, color: "var(--muted)", fontSize: miniFontSize }}>暂无数据</td>
                  </tr>
                ) : (
                  winLoseRows.map((r, idx) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: miniCellPad, fontSize: miniFontSize }}>{idx + 1}</td>
                      <td style={{ padding: miniCellPad, fontWeight: 700, fontSize: miniFontSize }}>{r.name}</td>
                      <td style={{ padding: miniCellPad, fontSize: miniFontSize }}>{r.wins}胜 {r.losses}负</td>
                      <td style={{ padding: miniCellPad, fontSize: miniFontSize }}>{r.streak}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
        <div style={{ marginBottom: 8 }}>
          <b>1. 基本思想</b><br />
          每位球员都有一个初始 Rating（500）。系统按比赛时间顺序，逐场比较
          「<b>实际局胜率</b>」与「<b>基于对手强度的预期局胜率</b>」，根据差异对
          Rating 进行增减。
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>2. 实际局胜率（Actual）</b><br />
          实际局胜率 = 本场赢的局数 ÷ 本场总局数。<br />
          例如：7 : 5 → 实际局胜率 = 7 / 12。
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>3. 预期局胜率（Expected）</b><br />
          由双方当前 Rating 计算，Rating 越高的一方，系统预期其局胜率越高。
          若你击败了比你更强的对手，得到的加分会更多；反之亦然。
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>4. 强弱对阵规则（文字说明）</b><br />
          若双方排名差距小于 5 名（例如只差 2-3 名），按正常逻辑结算，不做额外加权。<br />
          只有排名差距达到分档时才启用加权：差 5 名一档、差 10 名一档、差 15 名一档。<br />
          在这些分档中，若高排名选手赢，积分变化会缩小（高分少加、低分少扣）；
          若低排名选手爆冷赢，积分变化会放大（低分多加、高分多扣）。<br />
          注意：放门比赛不套用这条强弱对阵分档规则。
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>5. 比赛标签权重</b><br />
          练习赛基准权重为 1.0，直播比赛基准权重为 1.5。<br />
          同样的表现，在直播比赛中的积分变化幅度更大。
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>6. 放门（让分）规则</b><br />
          放门比赛不套用强弱对阵分档，直接按标签基准权重结算 Rating：<br />
          • 练习赛：放门方赢 = 1.0；被放门方赢 = 0.5<br />
          • 直播：放门方赢 = 1.5；被放门方赢 = 0.75<br />
          局胜率与折算场次统计也按标签折算：练习赛按 0.5 场，直播按 0.75 场。
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>7. 稳定系数（场次越多越稳定）</b><br />
          球员参与的比赛场次越多，单场比赛对 Rating 的影响越小，
          用于防止早期少量比赛造成积分剧烈波动。
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>8. Rating 更新方式（简化表达）</b><br />
          Rating 变化 ≈ K ×（实际局胜率 − 预期局胜率）× 综合权重 × 稳定系数。<br />
          非放门比赛的综合权重规则：<br />
          • 练习赛：差距 &lt; 5 名 = 1.00；[5,10) = 高排赢 0.80 / 低排爆冷赢 1.20；[10,15) = 0.60 / 1.40；≥ 15 = 0.40 / 1.60<br />
          • 直播：差距 &lt; 5 名 = 1.50；[5,10) = 高排赢 1.30 / 低排爆冷赢 1.70；[10,15) = 1.10 / 1.90；≥ 15 = 0.90 / 2.10
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>9. 局胜率与可信度</b><br />
          表格中的局胜率、直播局胜率、练习局胜率，均基于局数统计，
          并与放门折算规则保持一致：练习赛为 0.5，直播为 0.75。<br />
          比赛（折算后）场次越多，可信度越高，排名越可靠。
        </div>

        <div>
          <b>10. 最近 10 场趋势</b><br />
          用最近 10 场比赛的比分差近似表示当前状态，仅用于趋势展示，
          不直接参与 Rating 计算。
        </div>
      </div>

    </div>
  );
}
