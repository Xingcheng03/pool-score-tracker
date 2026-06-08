import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildQuery } from "../lib/api.js";
import { cachedApiRequest } from "../lib/apiCache.js";
import { useDebouncedValue } from "../lib/useDebouncedValue.js";
import { useT, useTranslateTier } from "../lib/i18n.jsx";

function pct(value) {
  return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

const SPECIAL_TITLES = {
  "敏敏": "豆腐煲接全世界",
};

function renderPlayerName(name) {
  const title = SPECIAL_TITLES[name];
  if (!title) return name;
  return (
    <span className="leaderboardSpecialTitle">{title}-{name}</span>
  );
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
  const t = useT();
  const translateTier = useTranslateTier();
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
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const query = buildQuery({ mode, seasonId, q: debouncedQ, minMatches, sortKey, sortDir });
      const summary = await cachedApiRequest(`/leaderboard/summary${query}`, { force });
      setRows(summary.leaderboard.rows);
      setWinLoseRows(summary.winLose.rows);
      setSeasons(summary.seasons);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [mode, seasonId, debouncedQ, minMatches, sortKey, sortDir]);

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

  // 折算场次低于此值的球员不计入排名，统一排到榜尾、名次显示横杠
  const RANK_MIN_MATCHES = 5;
  const rankedRows = rows.filter((r) => r.effMatches >= RANK_MIN_MATCHES);
  const unrankedRows = rows.filter((r) => r.effMatches < RANK_MIN_MATCHES);

  const topThree = rankedRows.slice(0, Math.min(3, rankedRows.length));
  // 表格行：上榜球员（带名次）在前，未上榜球员（名次为 null）排在最后
  const tableRows = [
    ...rankedRows.slice(topThree.length).map((row, i) => ({ row, rank: topThree.length + i + 1 })),
    ...unrankedRows.map((row) => ({ row, rank: null })),
  ];
  // 表格里第一个未上榜球员的位置，用于在其上方插入一行说明
  const firstUnrankedIndex = tableRows.findIndex((e) => e.rank == null);
  const seasonQuery = seasonId === "all" ? "" : `?season=${seasonId}`;

  return (
    <div>
      <div className="pageTitle">
        <div>
          <h2 style={{ margin: 0 }}>{t("街灯榜", "Street Light Leaderboard")}</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            {t(
              "街灯榜：读取正式比赛记录，并按页面底部的逻辑计算。",
              "Street Light Leaderboard: reads official match records and computes by the rules at the bottom of this page.",
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="leaderboardFilterGrid">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("搜索球员...", "Search players...")} />

          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="all">{t("全部比赛", "All matches")}</option>
            <option value="practice">{t("练习赛", "Practice")}</option>
            <option value="live">{t("直播", "Live")}</option>
          </select>

          <select className="input" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
            <option value="all">{t("全部赛季", "All seasons")}</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>{season.label}</option>
            ))}
          </select>

          <select className="input" value={minMatches} onChange={(e) => setMinMatches(Number(e.target.value))}>
            <option value={0}>{t("不限可信度", "Any confidence")}</option>
            <option value={5}>{t("至少 5 场", "At least 5 matches")}</option>
            <option value={10}>{t("至少 10 场", "At least 10 matches")}</option>
            <option value={30}>{t("至少 30 场", "At least 30 matches")}</option>
          </select>

          <button className="btn" type="button" onClick={() => load(true)}>{t("刷新", "Refresh")}</button>
        </div>
      </div>

      {error && <div className="errorBox" style={{ marginTop: 12 }}>{error}</div>}
      {loading ? (
        <div className="card" style={{ marginTop: 12 }}>{t("加载中...", "Loading...")}</div>
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
                        {renderPlayerName(row.name)}
                      </Link>
                      {rank === 1 && <div className="leaderboardTopCardTrophy">{"🏆"}</div>}
                    </div>
                    <div className="leaderboardTopCardStats">
                      <span>Rating: {Math.round(row.rating)}</span>
                      <span style={tierStyle(row.tier)}>{t("段位", "Tier")}: {translateTier(row.tier)}</span>
                      <span style={{ color: row.trend10 >= 0 ? "var(--primary)" : "var(--danger)" }}>
                        Trend: {row.trend10 >= 0 ? "+" : ""}{row.trend10}
                      </span>
                      <span>{t("局胜率", "Rack Win")}: {pct(row.rackWinRate)}</span>
                      <span>{t("练习局胜率", "Practice Win")}: {pct(row.pracRackWinRate)}</span>
                      <span>{t("直播局胜率", "Live Win")}: {pct(row.liveRackWinRate)}</span>
                      <span>{t("可信度", "Confidence")}: {row.confidence}</span>
                      <span>{t("局数", "Racks")}: {row.racks}</span>
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
                    [t("球员", "Player"), null],
                    ["Rating", "rating"],
                    [t("段位", "Tier"), null],
                    [t("可信度", "Confidence"), "matches"],
                    [t("局胜率", "Rack Win"), "rackWinRate"],
                    [t("最近10场趋势", "Last 10 Trend"), "trend10"],
                    [t("直播局胜率", "Live Win"), null],
                    [t("练习局胜率", "Practice Win"), null],
                  ].map(([label, key]) => (
                    <th key={label} onClick={() => key && toggleSort(key)} style={{ cursor: key ? "pointer" : "default" }}>
                      {label}{key && sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr><td colSpan={9} style={{ color: "var(--muted)" }}>{t("暂无符合条件的数据。", "No matching data.")}</td></tr>
                ) : (
                  tableRows.map(({ row, rank }, idx) => (
                    <React.Fragment key={row.id}>
                    {idx === firstUnrankedIndex && (
                      <tr className="leaderboardUnrankedDivider">
                        <td colSpan={9}>
                          {t(
                            "以下球员因比赛场次不足 5 场或暂无比赛记录，暂不计入排名",
                            "Players below are not ranked: fewer than 5 matches or no match records",
                          )}
                        </td>
                      </tr>
                    )}
                    <tr className={rank == null ? "leaderboardUnrankedRow" : undefined}>
                      <td style={rank == null ? { color: "var(--muted)" } : undefined}>{rank == null ? "—" : rank}</td>
                      <td style={{ fontWeight: 700 }}><Link to={`/players/${row.id}${seasonQuery}`}>{renderPlayerName(row.name)}</Link></td>
                      <td>{Math.round(row.rating)}</td>
                      <td style={tierStyle(row.tier)}>{translateTier(row.tier)}</td>
                      <td>{row.confidence} · {t(`${row.effMatches}场 / ${row.racks}局`, `${row.effMatches} matches / ${row.racks} racks`)}</td>
                      <td>{pct(row.rackWinRate)}</td>
                      <td style={{ color: row.trend10 >= 0 ? "var(--primary)" : "var(--danger)" }}>
                        {row.trend10 >= 0 ? "+" : ""}{row.trend10}
                      </td>
                      <td>{pct(row.liveRackWinRate)}</td>
                      <td>{pct(row.pracRackWinRate)}</td>
                    </tr>
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>

          <div className="card leaderboardWinLoseCard" style={{ padding: 0, overflow: "hidden" }}>
            <div className="leaderboardWinLoseHead">{t("胜负战绩榜", "Win/Loss Records")}</div>
            <div className="leaderboardWinLoseWrap">
              <table className="leaderboardMiniTable" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "var(--soft)" }}>
                  <tr>
                    <th>#</th>
                    <th>{t("球员", "Player")}</th>
                    <th>{t("战绩", "Record")}</th>
                    <th>{t("连击", "Streak")}</th>
                  </tr>
                </thead>
                <tbody>
                  {winLoseRows.length === 0 ? (
                    <tr><td colSpan={4} style={{ color: "var(--muted)" }}>{t("暂无数据", "No data")}</td></tr>
                  ) : (
                    winLoseRows.slice(0, 24).map((row, idx) => {
                      const streak = row.winStreak > 0
                        ? t(`连胜 ${row.winStreak}`, `${row.winStreak} W streak`)
                        : row.loseStreak > 0
                        ? t(`连败 ${row.loseStreak}`, `${row.loseStreak} L streak`)
                        : "-";
                      return (
                        <tr key={row.id}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 700 }}><Link to={`/players/${row.id}${seasonQuery}`}>{row.name}</Link></td>
                          <td>{t(`${row.wins}胜 ${row.losses}负`, `${row.wins}W ${row.losses}L`)}</td>
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
        <div className="leaderboardRulesTitle">{t("积分计算规则说明", "Rating Calculation Rules")}</div>
        <div className="leaderboardRulesGrid">
          <div className="leaderboardRuleBlock">
            <h3>{t("1. 基础逻辑", "1. Basics")}</h3>
            <p>{t(
              "每位球员初始 Rating 都是 500。系统会把筛选范围内的正式比赛按时间从早到晚重新回放，每打一场就更新一次双方 Rating。",
              "Every player starts at Rating 500. The system replays official matches in the selected scope from oldest to newest, updating both players' Rating after each match.",
            )}</p>
            <p>{t(
              "单场核心公式是：变化值 = 40 ×（实际局胜率 - 预期局胜率）× 比赛权重 × 稳定系数。",
              "The per-match formula is: delta = 40 × (actual rack win rate - expected rack win rate) × match weight × stability coefficient.",
            )}</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>{t("2. 实际局胜率与预期局胜率", "2. Actual vs Expected Rack Win Rate")}</h3>
            <p>{t(
              "实际局胜率按比分算，例如 7:3 获胜，实际局胜率就是 7 / 10 = 70%。",
              "Actual rack win rate is computed from the score, e.g. winning 7:3 gives 7 / 10 = 70%.",
            )}</p>
            <p>{t(
              "预期局胜率由双方赛前 Rating 计算：1 / (1 + 10^((对手Rating - 我的Rating) / 200))。强者本来就应该赢更多局，所以强者只小赢会少加分，弱者打出高于预期的比分会多加分。",
              "Expected rack win rate is computed from pre-match Ratings: 1 / (1 + 10^((opponentRating - myRating) / 200)). The stronger player is expected to win more racks, so a narrow win gains less; the underdog gains more by exceeding expectations.",
            )}</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>{t("3. 练习赛和直播权重", "3. Practice vs Live Weight")}</h3>
            <p>{t(
              "练习赛基础权重是 1.0，直播基础权重是 1.5。也就是说，同样的比分表现，直播比赛对 Rating 的影响比练习赛更大。",
              "Practice base weight is 1.0; live base weight is 1.5. The same score shifts Rating more in a live match than in a practice match.",
            )}</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>{t("4. 非放门比赛的强弱对阵加权", "4. Strong/Weak Matchup Weighting (No Handicap)")}</h3>
            <p>{t(
              "非放门比赛会根据双方赛前排名差调整权重。排名差小于 5 名时不额外调整。",
              "Non-handicap matches adjust weight by pre-match ranking gap. No extra adjustment if the gap is under 5.",
            )}</p>
            <p>{t(
              "练习赛：差 5-9 名，强者赢权重 0.8、爆冷权重 1.2；差 10-14 名，强者赢 0.6、爆冷 1.4；差 15 名以上，强者赢 0.4、爆冷 1.6。",
              "Practice: gap 5-9 → favorite-win 0.8, upset 1.2; gap 10-14 → 0.6 / 1.4; gap 15+ → 0.4 / 1.6.",
            )}</p>
            <p>{t(
              "直播：差 5-9 名，强者赢 1.3、爆冷 1.7；差 10-14 名，强者赢 1.1、爆冷 1.9；差 15 名以上，强者赢 0.9、爆冷 2.1。",
              "Live: gap 5-9 → favorite-win 1.3, upset 1.7; gap 10-14 → 1.1 / 1.9; gap 15+ → 0.9 / 2.1.",
            )}</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>{t("5. 放门比赛怎么算", "5. Handicap Match Rules")}</h3>
            <p>{t(
              "放门比赛不再套用强弱排名差加权，因为让球已经补偿了强弱差距。",
              "Handicap matches skip the strong/weak ranking weighting, because the handicap already compensates for the skill gap.",
            )}</p>
            <p>{t(
              "如果放门方获胜，按标签基础权重计算：练习赛 1.0，直播 1.5。如果被放门方获胜，Rating 权重减半：练习赛 0.5，直播 0.75。",
              "If the handicap giver wins, weight uses the tag base: practice 1.0, live 1.5. If the receiver wins, Rating weight halves: practice 0.5, live 0.75.",
            )}</p>
            <p>{t(
              "排行榜里的局数、折算场次、胜负统计也会按同一放门折算：只有\"被放门方获胜\"时，双方本场按练习赛 0.5 或直播 0.75 计入；其他情况按 1 场计入。",
              "Racks, effective matches, and W/L counts on the leaderboard use the same handicap conversion: only when the receiver wins do both players count this match as 0.5 (practice) or 0.75 (live); otherwise it counts as 1.",
            )}</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>{t("6. 稳定系数", "6. Stability Coefficient")}</h3>
            <p>{t(
              "打得越多，单场波动越小。稳定系数 = 1 / sqrt(1 + 已参加场次 / 10)。新玩家变化更明显，老玩家更稳定。",
              "The more you play, the smaller per-match swings. Stability coefficient = 1 / sqrt(1 + played matches / 10). New players move more, veterans are steadier.",
            )}</p>
            <p>{t(
              "例如一个人此前 0 场，稳定系数是 1；此前 30 场，稳定系数约为 0.5，本场加减分会被压到一半左右。",
              "E.g. with 0 prior matches the coefficient is 1; with 30 prior matches it's about 0.5, halving the per-match delta.",
            )}</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>{t("7. 左右双方如何同时更新", "7. Updating Both Sides Simultaneously")}</h3>
            <p>{t(
              "系统先按左侧球员计算 delta。左侧 Rating 增加 delta × 左侧稳定系数；右侧 Rating 减少 delta × 右侧稳定系数。delta 可能为负，所以左侧表现低于预期会扣分，右侧相应加分。",
              "The system computes delta from the left player's perspective. Left Rating += delta × left stability; right Rating -= delta × right stability. Delta may be negative, so the left side loses Rating when underperforming and the right side gains correspondingly.",
            )}</p>
          </div>

          <div className="leaderboardRuleBlock">
            <h3>{t("8. 排行榜其他字段", "8. Other Leaderboard Fields")}</h3>
            <p>{t(
              "局胜率 = 折算后赢下的局数 / 折算后总局数。直播局胜率和练习局胜率分别只看对应标签。",
              "Rack win rate = adjusted racks won / adjusted total racks. Live and Practice rack win rates filter by the corresponding tag only.",
            )}</p>
            <p>{t(
              "最近10场趋势 = 最近 10 场中每场（我的局数 - 对手局数）× 2，并限制在 -20 到 +20 之间，再叠加放门折算。",
              "Last-10 trend = sum of (my racks - opponent racks) × 2 across the last 10 matches, clamped to [-20, +20], with handicap conversion applied.",
            )}</p>
            <p>{t(
              "可信度按折算场次显示：低于 10 场为低，10 到 29.99 场为中，30 场及以上为高。",
              "Confidence is based on effective matches: below 10 → low, 10 to 29.99 → medium, 30+ → high.",
            )}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
