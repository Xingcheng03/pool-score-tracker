// src/pages/LeaderboardPage.jsx
import React, { useMemo, useState } from "react";
import { buildFargoLiteLeaderboard, tagLabel, exportLeaderboardToJSON, exportLeaderboardToExcel } from "../data/store.js";

export default function LeaderboardPage() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("all"); // all | practice | live
  const [minMatches, setMinMatches] = useState(0);

  // 排序：rating | rackWinRate | trend10 | matches
  // ⚠️ 注意：我们传给 store 时把 matches 映射成 effMatches（折算场次）
  const [sortKey, setSortKey] = useState("rating");
  const [sortDir, setSortDir] = useState("desc"); // asc | desc

  const rows = useMemo(() => {
    const keyMap = {
      rating: "rating",
      rackWinRate: "rackWinRate",
      trend10: "trend10",
      matches: "matches", // store 内部会用 effMatches 做排序字段（见你实现）
    };

    return buildFargoLiteLeaderboard({
      mode,
      q,
      minMatches,
      sortKey: keyMap[sortKey] ?? "rating",
      sortDir,
    });
  }, [mode, q, minMatches, sortKey, sortDir]);

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
            placeholder="搜索球员…"
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

      {/* Table */}
      <div className="card" style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
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
                ["最近10场", "trend10"],
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
            {rows.map((r, idx) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: 12, fontSize: 13 }}>{idx + 1}</td>
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

            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 18, color: "var(--muted)" }}>
                  暂无符合条件的数据。
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

        <div style={{ marginBottom: 8 }}>
            <b>1. 基本思想</b><br />
            每位球员都有一个初始 Rating（1000）。系统按比赛时间顺序，逐场比较
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
            <b>4. 比赛标签权重</b><br />
            直播比赛权重为 1.0，练习赛权重为 0.7。<br />
            同样的表现，在直播比赛中的积分变化幅度更大。
        </div>

        <div style={{ marginBottom: 8 }}>
            <b>5. 放门（让分）规则 —— 半场（0.5）折算</b><br />
            若开启放门，且<b>被放门方最终获胜</b>，则该场比赛只按
            <b>0.5 场</b>计入统计与积分计算：<br />
            • 积分变化幅度减半<br />
            • 局胜率统计中的局数按 0.5允许计入<br />
            若放门方获胜，则按正常整场计算（不折算）。
        </div>

        <div style={{ marginBottom: 8 }}>
            <b>6. 稳定系数（场次越多越稳定）</b><br />
            球员参与的比赛场次越多，单场比赛对 Rating 的影响越小，
            用于防止早期少量比赛造成积分剧烈波动。
        </div>

        <div style={{ marginBottom: 8 }}>
            <b>7. Rating 更新方式（简化表达）</b><br />
            Rating 变化 ≈ K ×（实际局胜率 − 预期局胜率）× 比赛权重 × 放门折算 × 稳定系数。<br />
            表现超出预期则加分，低于预期则扣分。
        </div>

        <div style={{ marginBottom: 8 }}>
            <b>8. 局胜率与可信度</b><br />
            表格中的局胜率、直播局胜率、练习局胜率，均基于局数统计，
            并与放门的 0.5 场折算规则保持一致。<br />
            比赛（折算后）场次越多，可信度越高，排名越可靠。
        </div>

        <div>
            <b>9. 最近 10 场趋势</b><br />
            用最近 10 场比赛的比分差近似表示当前状态，仅用于趋势展示，
            不直接参与 Rating 计算。
        </div>
        </div>

    </div>
  );
}
