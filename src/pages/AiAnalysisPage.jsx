import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, jsonBody } from "../lib/api.js";
import { cachedApiRequest } from "../lib/apiCache.js";
import { useAuth } from "../auth/useAuth.js";

const TABS = [
  { id: "player", label: "球员分析" },
  { id: "matchup", label: "对阵分析" },
  { id: "recommendation", label: "推荐对手" },
];

const MODE_LABELS = {
  all: "全部比赛",
  practice: "练习赛",
  live: "直播",
};

const CONFIDENCE_LABELS = {
  low: "低",
  medium: "中",
  high: "高",
};

const TAB_REPORT_TYPES = {
  player: "player_analysis",
  matchup: "matchup_analysis",
  recommendation: "opponent_recommendation",
};

const EMPTY_REPORT_STATE = {
  cycle: null,
  quota: {},
  reports: {},
  reportHistory: {},
};

function formatDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function formatNumber(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "0";
  const rounded = Math.round(number * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatPercent(value) {
  return `${formatNumber(Number(value ?? 0) * 100)}%`;
}

function playerName(players, id) {
  return players.find((player) => player.id === id)?.name ?? "Unknown";
}

function sourceLabel(source) {
  return source === "gemini" ? "Gemini" : "规则 baseline";
}

function reportTypeLabel(reportType) {
  if (reportType === TAB_REPORT_TYPES.player) return "球员状态报告";
  if (reportType === TAB_REPORT_TYPES.matchup) return "对阵分析报告";
  if (reportType === TAB_REPORT_TYPES.recommendation) return "推荐对手报告";
  return "AI 报告";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function listItems(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function buildPrintableReportHtml(result, players) {
  const analysis = result?.analysis ?? {};
  const baseline = result?.baseline ?? {};
  const reportType = result?.reportMeta?.reportType ?? result?.task;
  const title = reportTypeLabel(reportType);
  const generatedAt = formatDate(result?.reportMeta?.generatedAt ?? result?.generatedAt);
  const recommendedName = analysis.recommendedOpponent?.playerId ? playerName(players, analysis.recommendedOpponent.playerId) : "";
  const advantageName = analysis.headToHead?.advantagePlayerId ? playerName(players, analysis.headToHead.advantagePlayerId) : "";
  const evidenceMatches = result?.evidence?.matches ?? [];

  const recentRows = Array.isArray(baseline.recentFive)
    ? baseline.recentFive.map((match) => `
      <tr>
        <td>${escapeHtml(formatDate(match.dateISO))}</td>
        <td>${escapeHtml(match.opponentName)}</td>
        <td>${escapeHtml(`${match.myScore} : ${match.opponentScore}`)}</td>
        <td>${escapeHtml(match.result === "win" ? "赢" : match.result === "loss" ? "输" : "-")}</td>
      </tr>
    `).join("")
    : "";

  const scoreDeltaRows = Array.isArray(baseline.scoreDeltaTable)
    ? baseline.scoreDeltaTable.flatMap((group) => group.scorelines.map((row) => {
      const [playerScore, opponentScore] = String(row.score).split("-");
      return `
        <tr>
          <td>抢 ${escapeHtml(group.raceTo)}</td>
          <td>${row.playerDelta > 0 ? "+" : ""}${escapeHtml(row.playerDelta)}</td>
          <td>${escapeHtml(`${baseline.matchupModel?.playerName ?? ""} ${playerScore} - ${opponentScore} ${baseline.matchupModel?.opponentName ?? ""}`)}</td>
          <td>${row.opponentDelta > 0 ? "+" : ""}${escapeHtml(row.opponentDelta)}</td>
        </tr>
      `;
    })).join("")
    : "";

  const recommendationSections = Array.isArray(baseline.recommendationCategories)
    ? baseline.recommendationCategories.map((category) => `
      <h2>${escapeHtml(category.label)}</h2>
      <p>${escapeHtml(category.description)}</p>
      ${listItems((category.items ?? []).map((item) => `${item.opponentName}：你的胜率 ${formatPercent(item.playerWinProbability / 100)}，共同对手 ${item.commonOpponents?.length ?? 0} 个`))}
    `).join("")
    : "";

  const evidenceRows = evidenceMatches.map((match) => `
    <tr>
      <td>${escapeHtml(formatDate(match.dateISO))}</td>
      <td>${escapeHtml(match.matchName)}</td>
      <td>${escapeHtml(`${match.leftPlayerName} ${match.leftScore} : ${match.rightScore} ${match.rightPlayerName}`)}</td>
      <td>${escapeHtml(match.winnerName ?? "-")}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}-${escapeHtml(generatedAt)}</title>
  <style>
    body { font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color: #172033; margin: 28px; line-height: 1.65; }
    h1 { font-size: 26px; margin: 0 0 6px; }
    h2 { font-size: 18px; margin: 24px 0 8px; padding-bottom: 6px; border-bottom: 1px solid #dfe6f0; }
    .meta { color: #68758a; font-size: 13px; margin-bottom: 18px; }
    .summary { border-left: 4px solid #2158f5; background: #f2f6ff; padding: 12px 14px; border-radius: 10px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
    .metric { border: 1px solid #dfe6f0; border-radius: 10px; padding: 10px 12px; }
    .metric span { display: block; color: #68758a; font-size: 12px; }
    .metric strong { display: block; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border: 1px solid #dfe6f0; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f2f6ff; }
    ul { margin-top: 8px; }
    @media print { body { margin: 18mm; } .no-print { display: none; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:9px 14px;border:1px solid #dfe6f0;border-radius:8px;background:#2158f5;color:white;font-weight:700;">保存为 PDF</button>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">生成时间：${escapeHtml(generatedAt)} · 来源：${escapeHtml(sourceLabel(result?.source))}</div>
  <div class="summary">${escapeHtml(analysis.summary)}</div>
  <div class="grid">
    ${recommendedName ? `<div class="metric"><span>推荐对手</span><strong>${escapeHtml(recommendedName)}</strong></div>` : ""}
    ${advantageName ? `<div class="metric"><span>对阵优势</span><strong>${escapeHtml(advantageName)}</strong></div>` : ""}
    ${result?.contextSummary?.matchCount != null ? `<div class="metric"><span>全量比赛</span><strong>${escapeHtml(result.contextSummary.matchCount)}</strong></div>` : ""}
    ${result?.contextSummary?.evidenceMatchCount != null ? `<div class="metric"><span>证据比赛</span><strong>${escapeHtml(result.contextSummary.evidenceMatchCount)}</strong></div>` : ""}
  </div>
  ${analysis.recommendedOpponent?.reason ? `<h2>推荐理由</h2><p>${escapeHtml(analysis.recommendedOpponent.reason)}</p>` : ""}
  ${analysis.headToHead?.rationale ? `<h2>对阵判断</h2><p>${escapeHtml(analysis.headToHead.rationale)}</p>` : ""}
  ${analysis.rankingSuggestion ? `<h2>排名建议</h2><p>${escapeHtml(analysis.rankingSuggestion)}</p>` : ""}
  ${Array.isArray(analysis.cautions) && analysis.cautions.length ? `<h2>注意事项</h2>${listItems(analysis.cautions)}` : ""}
  ${recentRows ? `<h2>最近 5 场</h2><table><thead><tr><th>日期</th><th>对手</th><th>比分</th><th>结果</th></tr></thead><tbody>${recentRows}</tbody></table>` : ""}
  ${scoreDeltaRows ? `<h2>街灯榜积分变化估算</h2><table><thead><tr><th>赛制</th><th>我方</th><th>比分</th><th>对手</th></tr></thead><tbody>${scoreDeltaRows}</tbody></table>` : ""}
  ${recommendationSections}
  ${evidenceRows ? `<h2>证据比赛</h2><table><thead><tr><th>时间</th><th>比赛</th><th>比分</th><th>胜者</th></tr></thead><tbody>${evidenceRows}</tbody></table>` : ""}
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 250));</script>
</body>
</html>`;
}

function downloadReportPdf(result, players) {
  if (!result) return;
  const html = buildPrintableReportHtml(result, players);
  const popup = window.open("", "_blank");
  if (!popup) return;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

function ConfidenceBadge({ value }) {
  const normalized = value === "high" || value === "medium" ? value : "low";
  return (
    <span className={`badge aiConfidence aiConfidence-${normalized}`}>
      可信度：{CONFIDENCE_LABELS[normalized]}
    </span>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button className={active ? "btn btnBrand aiTabButton" : "btn aiTabButton"} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="aiField">
      <span>{label}</span>
      {children}
    </label>
  );
}

function PlayerSelect({ value, onChange, players, excludeId = "", placeholder = "选择球员" }) {
  return (
    <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {players
        .filter((player) => player.id !== excludeId)
        .map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
    </select>
  );
}

function ReadonlyField({ label, value, hint }) {
  return (
    <div className="aiField">
      <span>{label}</span>
      <div className="aiReadonlyField">
        <strong>{value || "未绑定球员"}</strong>
        {hint && <em>{hint}</em>}
      </div>
    </div>
  );
}

function QuotaPanel({ quota, cycle, activeTab }) {
  const reportType = TAB_REPORT_TYPES[activeTab];
  const item = quota?.[reportType];
  if (!item) return null;

  const cycleText = cycle?.latestMatch
    ? `本周期从 ${cycle.latestMatch.matchName} 通过后开始`
    : "当前球员暂无已通过比赛，本周期从账号绑定球员开始";

  return (
    <div className="aiQuotaPanel">
      <div>
        <strong>{item.label}</strong>
        <span>本周期已用 {item.used}/{item.limit}，剩余 {item.remaining}</span>
      </div>
      <em>{cycleText}</em>
    </div>
  );
}

function ReportHistorySelector({ reports, selectedIndex, onSelect }) {
  if (!Array.isArray(reports) || reports.length <= 1) return null;

  return (
    <div className="aiReportHistory">
      <span>本周期报告记录</span>
      <div>
        {reports.map((report, index) => (
          <button
            key={report.reportMeta?.id ?? `${report.generatedAt}-${index}`}
            className={index === selectedIndex ? "pill pillActive" : "pill"}
            type="button"
            onClick={() => onSelect(index)}
          >
            第 {reports.length - index} 份 · {formatDate(report.reportMeta?.generatedAt ?? report.generatedAt)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScoreBar({ label, value }) {
  const number = Math.max(0, Math.min(100, Number(value ?? 0)));
  return (
    <div className="aiScoreBar">
      <div className="rowBetween">
        <span>{label}</span>
        <strong>{Math.round(number)}</strong>
      </div>
      <div className="aiScoreTrack">
        <div className="aiScoreFill" style={{ width: `${number}%` }} />
      </div>
    </div>
  );
}

function BaselinePanel({ baseline, players }) {
  if (!baseline) return null;

  const recommendedName = baseline.recommendedOpponentId ? playerName(players, baseline.recommendedOpponentId) : "";
  const advantageName = baseline.headToHead?.advantagePlayerId ? playerName(players, baseline.headToHead.advantagePlayerId) : "";
  const candidateScores = Array.isArray(baseline.candidateScores) ? baseline.candidateScores : [];

  return (
    <div className="aiBaselinePanel">
      <div className="aiSectionTitle">Baseline</div>
      <div className="aiMetricGrid">
        {recommendedName && (
          <div className="aiMetric">
            <span>推荐对手</span>
            <strong>{recommendedName}</strong>
          </div>
        )}
        {advantageName && (
          <div className="aiMetric">
            <span>对阵优势</span>
            <strong>{advantageName}</strong>
          </div>
        )}
        {baseline.confidence && (
          <div className="aiMetric">
            <span>规则可信度</span>
            <strong>{CONFIDENCE_LABELS[baseline.confidence] ?? baseline.confidence}</strong>
          </div>
        )}
        {baseline.totalScore != null && (
          <div className="aiMetric">
            <span>总分</span>
            <strong>{formatNumber(baseline.totalScore)}</strong>
          </div>
        )}
      </div>

      <div className="aiScoreGrid">
        {baseline.strengthScore != null && <ScoreBar label="强度" value={baseline.strengthScore} />}
        {baseline.recentFormScore != null && <ScoreBar label="近期状态" value={baseline.recentFormScore} />}
        {baseline.headToHeadScore != null && <ScoreBar label="历史交手" value={baseline.headToHeadScore} />}
        {baseline.matchupBalanceScore != null && <ScoreBar label="均衡程度" value={baseline.matchupBalanceScore} />}
      </div>

      {Array.isArray(baseline.reasons) && baseline.reasons.length > 0 && (
        <ul className="aiReasonList">
          {baseline.reasons.map((reason, index) => (
            <li key={`${reason}-${index}`}>{reason}</li>
          ))}
        </ul>
      )}

      {Array.isArray(baseline.summaryPoints) && baseline.summaryPoints.length > 0 && (
        <ul className="aiReasonList">
          {baseline.summaryPoints.map((reason, index) => (
            <li key={`${reason}-${index}`}>{reason}</li>
          ))}
        </ul>
      )}

      {candidateScores.length > 0 && (
        <div className="aiCandidateList">
          {candidateScores.map((candidate) => (
            <div key={candidate.playerId} className="aiCandidateRow">
              <span>{candidate.playerName}</span>
              <strong>{Math.round(candidate.totalScore)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentMatchTable({ matches }) {
  if (!Array.isArray(matches) || matches.length === 0) return <div className="sub">暂无近期比赛。</div>;

  return (
    <>
      <div className="tableWrap aiDesktopTableWrap">
        <table className="aiRecentTable">
          <thead>
            <tr>
              <th>日期</th>
              <th>对手</th>
              <th>比分</th>
              <th>结果</th>
              <th>分差</th>
              <th>标签</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.matchId}>
                <td>{formatDate(match.dateISO)}</td>
                <td>{match.opponentName}</td>
                <td style={{ fontWeight: 950 }}>{match.myScore} : {match.opponentScore}</td>
                <td>{match.result === "win" ? "赢" : match.result === "loss" ? "输" : "-"}</td>
                <td>{match.margin > 0 ? "+" : ""}{match.margin}</td>
                <td>{MODE_LABELS[match.tag] ?? match.tag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="aiMobileList">
        {matches.map((match) => (
          <article key={match.matchId} className="aiMobileCard">
            <div className="aiMobileCardHead">
              <strong>{match.opponentName}</strong>
              <span className={`badge aiOutcomeBadge aiOutcome-${match.result}`}>
                {match.result === "win" ? "赢" : match.result === "loss" ? "输" : "-"}
              </span>
            </div>
            <div className="aiMobileScore">{match.myScore} : {match.opponentScore}</div>
            <div className="aiMobileMetaGrid">
              <span><em>日期</em>{formatDate(match.dateISO)}</span>
              <span><em>分差</em>{match.margin > 0 ? "+" : ""}{match.margin}</span>
              <span><em>类型</em>{MODE_LABELS[match.tag] ?? match.tag}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function PlayerReportPanel({ baseline }) {
  const activity = baseline.activity ?? {};
  const trend = baseline.ratingTrend ?? {};
  const outlook = baseline.nextVisitOutlook ?? {};

  return (
    <div className="aiDetailedPanel">
      <div className="aiSectionTitle">球员状态报告</div>
      <div className="aiMetricGrid">
        <div className="aiMetric"><span>最近打球日间隔</span><strong>{activity.recentAverageGapDays || 0} 天</strong><em>{activity.activityLabel}</em></div>
        <div className="aiMetric"><span>距离上次比赛</span><strong>{activity.lastPlayedDaysAgo ?? "-"} 天</strong></div>
        <div className="aiMetric"><span>最近积分变化</span><strong>{trend.recentDelta > 0 ? "+" : ""}{trend.recentDelta ?? 0}</strong></div>
        <div className="aiMetric"><span>下次状态预测</span><strong>{outlook.outlook ?? "-"}</strong><em>胜面 {formatPercent((outlook.predictedWinProbability ?? 0) / 100)}</em></div>
      </div>
      <p className="aiTextBlock">
        这里按“打球日”计算间隔，同一天多场比赛只算一天。共记录 {activity.totalPlayDays ?? 0} 个打球日。建议休息窗口：{outlook.recommendedRestWindow ?? "样本不足"}。近期 5 场中练习赛 {activity.recentPracticeCount ?? 0} 场，直播 {activity.recentLiveCount ?? 0} 场。
      </p>
      <div className="aiSectionTitle">最近 5 场</div>
      <RecentMatchTable matches={baseline.recentFive} />
    </div>
  );
}

function CommonOpponentTable({ rows, playerNameText, opponentNameText }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <div className="sub">暂无共同对手样本。</div>;
  }

  return (
    <>
      <div className="tableWrap aiDesktopTableWrap">
        <table className="aiCommonTable">
          <thead>
            <tr>
              <th>共同对手</th>
              <th>{playerNameText}</th>
              <th>{opponentNameText}</th>
              <th>交叉优势</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((row) => (
              <tr key={row.opponentId}>
                <td>{row.opponentName}</td>
                <td>{row.player.wins}胜 {row.player.losses}负 · 局占比 {formatPercent(row.player.rackShare)}</td>
                <td>{row.comparedPlayer.wins}胜 {row.comparedPlayer.losses}负 · 局占比 {formatPercent(row.comparedPlayer.rackShare)}</td>
                <td>{row.edge >= 0 ? playerNameText : opponentNameText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="aiMobileList">
        {rows.slice(0, 8).map((row) => (
          <article key={row.opponentId} className="aiMobileCard">
            <div className="aiMobileCardHead">
              <strong>{row.opponentName}</strong>
              <span className="badge">优势：{row.edge >= 0 ? playerNameText : opponentNameText}</span>
            </div>
            <div className="aiMobileMetaGrid">
              <span><em>{playerNameText}</em>{row.player.wins}胜 {row.player.losses}负 · {formatPercent(row.player.rackShare)}</span>
              <span><em>{opponentNameText}</em>{row.comparedPlayer.wins}胜 {row.comparedPlayer.losses}负 · {formatPercent(row.comparedPlayer.rackShare)}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function ScoreDeltaTable({ groups, playerNameText, opponentNameText }) {
  if (!Array.isArray(groups) || groups.length === 0) return null;
  const rows = groups.flatMap((group) => group.scorelines.map((row) => ({ ...row, groupRaceTo: group.raceTo })));

  return (
    <>
      <div className="tableWrap aiDesktopTableWrap">
        <table className="aiDeltaTable">
          <thead>
            <tr>
              <th>赛制</th>
              <th>{playerNameText}</th>
              <th>比分预测</th>
              <th>{opponentNameText}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const [playerScore, opponentScore] = String(row.score).split("-").map((value) => Number(value));
              const showRace = index === 0 || rows[index - 1].groupRaceTo !== row.groupRaceTo;
              return (
              <tr key={`${row.raceTo}-${row.score}`}>
                <td>{showRace ? `抢 ${row.raceTo}` : ""}</td>
                <td className={row.playerDelta >= 0 ? "aiDeltaPositive" : "aiDeltaNegative"}>
                  {row.playerDelta > 0 ? "+" : ""}{row.playerDelta}
                </td>
                <td className="aiScorelineText">
                  {playerNameText} {playerScore} - {opponentScore} {opponentNameText}
                </td>
                <td className={row.opponentDelta >= 0 ? "aiDeltaPositive" : "aiDeltaNegative"}>
                  {row.opponentDelta > 0 ? "+" : ""}{row.opponentDelta}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="aiMobileList aiDeltaMobileList">
        {groups.map((group) => (
          <section key={group.raceTo} className="aiDeltaMobileGroup">
            <div className="aiDeltaMobileTitle">抢 {group.raceTo}</div>
            {group.scorelines.map((row) => {
              const [playerScore, opponentScore] = String(row.score).split("-").map((value) => Number(value));
              return (
                <div key={`${group.raceTo}-${row.score}`} className="aiDeltaMobileRow">
                  <span className={row.playerDelta >= 0 ? "aiDeltaPositive" : "aiDeltaNegative"}>
                    {row.playerDelta > 0 ? "+" : ""}{row.playerDelta}
                  </span>
                  <strong>{playerNameText} {playerScore} - {opponentScore} {opponentNameText}</strong>
                  <span className={row.opponentDelta >= 0 ? "aiDeltaPositive" : "aiDeltaNegative"}>
                    {row.opponentDelta > 0 ? "+" : ""}{row.opponentDelta}
                  </span>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}

function MatchupReportPanel({ baseline }) {
  const model = baseline.matchupModel;
  if (!model) return null;

  return (
    <div className="aiDetailedPanel">
      <div className="aiSectionTitle">胜率预测</div>
      <div className="aiMetricGrid">
        <div className="aiMetric"><span>{model.playerName}</span><strong>{formatPercent(model.playerWinProbability / 100)}</strong></div>
        <div className="aiMetric"><span>{model.opponentName}</span><strong>{formatPercent(model.opponentWinProbability / 100)}</strong></div>
        <div className="aiMetric"><span>直接交手</span><strong>{model.direct.playerWins} - {model.direct.opponentWins}</strong></div>
        <div className="aiMetric"><span>共同对手</span><strong>{model.commonOpponents.length}</strong></div>
      </div>

      <div className="aiSectionTitle">共同对手交叉比较</div>
      <CommonOpponentTable rows={model.commonOpponents} playerNameText={model.playerName} opponentNameText={model.opponentName} />

      <div className="aiSectionTitle">街灯榜积分变化估算</div>
      <p className="aiTextBlock">下表按当前街灯榜公式、非放门练习赛权重估算，只用于说明不同比分会怎样影响积分。</p>
      <ScoreDeltaTable groups={baseline.scoreDeltaTable} playerNameText={model.playerName} opponentNameText={model.opponentName} />
    </div>
  );
}

function RecommendationReportPanel({ baseline }) {
  const categories = baseline.recommendationCategories ?? [];
  const hasItems = categories.some((category) => Array.isArray(category.items) && category.items.length > 0);
  if (!hasItems) return <div className="aiDetailedPanel"><div className="sub">暂无足够交叉战绩推荐对手。</div></div>;

  return (
    <div className="aiDetailedPanel">
      {categories.map((category) => (
        <div key={category.category} className="aiRecommendationSection">
          <div className="rowBetween aiRecommendationSectionHead">
            <div>
              <div className="aiSectionTitle">{category.label}</div>
              <p className="sub aiCategorySub">{category.description}</p>
            </div>
          </div>
          {category.items.length === 0 ? (
            <div className="sub">暂无足够样本。</div>
          ) : (
            <div className="aiRecommendationGrid">
              {category.items.map((item, index) => (
                <div key={`${category.category}-${item.opponentId}`} className="aiRecommendationCard">
                  <div className="rowBetween">
                    <strong>{index + 1}. {item.opponentName}</strong>
                    <span className="badge">你的胜率 {formatPercent(item.playerWinProbability / 100)}</span>
                  </div>
                  <div className="smallMuted">
                    直接交手 {item.direct.playerWins}胜 {item.direct.opponentWins}负 · 共同对手 {item.commonOpponents.length} 个 · 样本 {item.components.sampleCount}
                  </div>
                  {item.commonOpponents[0] && (
                    <p className="aiTextBlock">
                      主要依据：你和 {item.opponentName} 都打过 {item.commonOpponents[0].opponentName}，交叉优势偏向 {item.commonOpponents[0].edge >= 0 ? item.playerName : item.opponentName}。
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DetailedBaselineReport({ baseline }) {
  if (!baseline) return null;
  if (baseline.recentFive) return <PlayerReportPanel baseline={baseline} />;
  if (baseline.matchupModel) return <MatchupReportPanel baseline={baseline} />;
  if (baseline.recommendations) return <RecommendationReportPanel baseline={baseline} />;
  return <BaselinePanel baseline={baseline} players={[]} />;
}

function CautionList({ cautions }) {
  if (!Array.isArray(cautions) || cautions.length === 0) return null;
  return (
    <div className="aiCautions">
      {cautions.map((caution, index) => (
        <div key={`${caution}-${index}`}>{caution}</div>
      ))}
    </div>
  );
}

function EvidenceTable({ result }) {
  const matches = result?.evidence?.matches ?? [];
  const reasons = new Map((result?.analysis?.evidence ?? []).map((item) => [item.matchId, item.reason]));

  if (matches.length === 0) {
    return <div className="sub" style={{ margin: 0 }}>暂无可展示的证据比赛。</div>;
  }

  return (
    <>
      <div className="tableWrap aiDesktopTableWrap">
        <table className="aiEvidenceTable">
          <thead>
            <tr>
              <th>时间</th>
              <th>比赛</th>
              <th>标签</th>
              <th>左侧</th>
              <th>比分</th>
              <th>右侧</th>
              <th>胜者</th>
              <th>放门</th>
              <th>引用原因</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.id}>
                <td>{formatDate(match.dateISO)}</td>
                <td style={{ fontWeight: 900 }}>{match.matchName}</td>
                <td>{MODE_LABELS[match.tag] ?? match.tag}</td>
                <td>{match.leftPlayerName}</td>
                <td style={{ fontWeight: 950 }}>{match.leftScore} : {match.rightScore}</td>
                <td>{match.rightPlayerName}</td>
                <td>{match.winnerName ?? "-"}</td>
                <td>
                  {match.isHandicap
                    ? `${match.handicapGiverName ?? "-"} 给 ${match.handicapReceiverName ?? "-"}`
                    : "否"}
                </td>
                <td>{reasons.get(match.id) ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="aiMobileList">
        {matches.map((match) => (
          <article key={match.id} className="aiMobileCard aiEvidenceMobileCard">
            <div className="aiMobileCardHead">
              <strong>{match.matchName}</strong>
              <span className="badge">{MODE_LABELS[match.tag] ?? match.tag}</span>
            </div>
            <div className="aiMobileScore">
              {match.leftPlayerName} {match.leftScore} : {match.rightScore} {match.rightPlayerName}
            </div>
            <div className="aiMobileMetaGrid">
              <span><em>时间</em>{formatDate(match.dateISO)}</span>
              <span><em>胜者</em>{match.winnerName ?? "-"}</span>
              <span>
                <em>放门</em>
                {match.isHandicap ? `${match.handicapGiverName ?? "-"} 给 ${match.handicapReceiverName ?? "-"}` : "否"}
              </span>
            </div>
            <p className="aiMobileReason">{reasons.get(match.id) ?? "无引用原因"}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function ResultPanel({ result, players, onDownloadPdf }) {
  if (!result) {
    return (
      <div className="card aiEmptyState">
        点击生成分析后，报告会保存到服务器。本周期额度用完后，需要等下一场比赛通过审核再生成。
      </div>
    );
  }

  const analysis = result.analysis ?? {};
  const recommendedName = analysis.recommendedOpponent?.playerId ? playerName(players, analysis.recommendedOpponent.playerId) : "";
  const advantageName = analysis.headToHead?.advantagePlayerId ? playerName(players, analysis.headToHead.advantagePlayerId) : "";

  return (
    <div className="space">
      <div className="card aiResultCard">
        <div className="rowBetween aiResultHead">
          <div className="row">
            <span className="badge">来源：{sourceLabel(result.source)}</span>
            <ConfidenceBadge value={analysis.confidence} />
            {analysis.baselineAgreement && <span className="badge">Baseline：{analysis.baselineAgreement}</span>}
          </div>
          <div className="aiResultActions">
            <span className="smallMuted">生成时间：{formatDate(result.reportMeta?.generatedAt ?? result.generatedAt)}</span>
            <button className="btn aiPdfButton" type="button" onClick={onDownloadPdf}>
              下载 PDF
            </button>
          </div>
        </div>

        {result.source === "baseline_fallback" && (
          <div className="aiFallbackNotice">
            Gemini 暂不可用，当前显示规则 baseline 结果。
          </div>
        )}

        <div className="aiSummary">{analysis.summary}</div>

        <div className="aiMetricGrid">
          {recommendedName && (
            <div className="aiMetric">
              <span>推荐对手</span>
              <strong>{recommendedName}</strong>
            </div>
          )}
          {advantageName && (
            <div className="aiMetric">
              <span>对阵优势</span>
              <strong>{advantageName}</strong>
            </div>
          )}
          {result.contextSummary?.matchCount != null && (
            <div className="aiMetric">
              <span>全量比赛</span>
              <strong>{result.contextSummary.matchCount}</strong>
            </div>
          )}
          {result.contextSummary?.evidenceMatchCount != null && (
            <div className="aiMetric">
              <span>证据比赛</span>
              <strong>{result.contextSummary.evidenceMatchCount}</strong>
            </div>
          )}
        </div>

        {analysis.recommendedOpponent?.reason && (
          <p className="aiTextBlock">{analysis.recommendedOpponent.reason}</p>
        )}
        {analysis.headToHead?.rationale && (
          <p className="aiTextBlock">{analysis.headToHead.rationale}</p>
        )}
        {analysis.rankingSuggestion && (
          <p className="aiTextBlock">{analysis.rankingSuggestion}</p>
        )}

        <CautionList cautions={analysis.cautions} />
        <DetailedBaselineReport baseline={result.baseline} />
      </div>

      <div className="card aiEvidenceCard">
        <div className="aiSectionTitle">证据比赛</div>
        <EvidenceTable result={result} />
      </div>
    </div>
  );
}

export default function AiAnalysisPage() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState("player");
  const [opponentId, setOpponentId] = useState("");
  const [reportState, setReportState] = useState(EMPTY_REPORT_STATE);
  const [selectedReportIndex, setSelectedReportIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const currentPlayerId = user?.player?.id ?? "";
  const currentPlayerName = user?.player?.name || (currentPlayerId ? playerName(players, currentPlayerId) : "");
  const activeReportType = TAB_REPORT_TYPES[activeTab];
  const activeReportHistory = reportState.reportHistory?.[activeReportType] ?? [];
  const activeReport = activeReportHistory[selectedReportIndex] ?? reportState.reports?.[activeReportType] ?? null;
  const activeQuota = reportState.quota?.[activeReportType] ?? null;
  const hasActiveReport = Boolean(activeReport);
  const quotaBlocked = Boolean(activeQuota && activeQuota.remaining <= 0);
  const savedMatchupOpponentId = activeReportType === TAB_REPORT_TYPES.matchup
    ? activeReport?.reportMeta?.opponentId ?? ""
    : reportState.reports?.[TAB_REPORT_TYPES.matchup]?.reportMeta?.opponentId ?? "";
  const savedMatchupPlayerId = reportState.reports?.[TAB_REPORT_TYPES.matchup]?.reportMeta?.playerId ?? "";

  const loadBaseData = useCallback(async () => {
    setPageLoading(true);
    setError("");
    try {
      const [playerResult, reportResult] = await Promise.all([
        cachedApiRequest("/players"),
        apiRequest("/ai/reports"),
      ]);
      setPlayers(playerResult.players);
      setReportState(reportResult);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (!currentPlayerId) {
      setOpponentId("");
      return;
    }

    if (opponentId === currentPlayerId) {
      setOpponentId("");
    }
  }, [currentPlayerId, opponentId]);

  useEffect(() => {
    if (activeTab !== "matchup" || opponentId || !currentPlayerId) return;
    if (savedMatchupOpponentId && savedMatchupOpponentId !== currentPlayerId && savedMatchupPlayerId === currentPlayerId) {
      setOpponentId(savedMatchupOpponentId);
    }
  }, [activeTab, currentPlayerId, opponentId, savedMatchupOpponentId, savedMatchupPlayerId]);

  useEffect(() => {
    setSelectedReportIndex(0);
  }, [activeTab]);

  useEffect(() => {
    if (selectedReportIndex > 0 && selectedReportIndex >= activeReportHistory.length) {
      setSelectedReportIndex(0);
    }
  }, [activeReportHistory.length, selectedReportIndex]);

  const canSubmit = useMemo(() => {
    if (!currentPlayerId) return false;
    if (quotaBlocked) return false;
    if (activeTab === "matchup") return Boolean(opponentId && opponentId !== currentPlayerId);
    return true;
  }, [activeTab, currentPlayerId, opponentId, quotaBlocked]);

  async function generateAnalysis() {
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      let path = "/ai/player-analysis";
      let body = { playerId: currentPlayerId };

      if (activeTab === "matchup") {
        path = "/ai/matchup-analysis";
        body = { playerId: currentPlayerId, opponentId };
      } else if (activeTab === "recommendation") {
        path = "/ai/opponent-recommendation";
        body = { playerId: currentPlayerId };
      }

      const nextResult = await apiRequest(path, {
        method: "POST",
        body: jsonBody(body),
      });

      if (nextResult.quotaState) {
        setReportState(nextResult.quotaState);
        setSelectedReportIndex(0);
      }
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space aiPage">
      <div className="pageTitle">
        <div>
          <h1 className="h1">AI 分析</h1>
          <p className="sub">默认使用当前登录账号绑定的球员，报告保存到服务器，并按下一场已通过比赛自动重置额度。</p>
        </div>
      </div>

      <div className="card aiControlCard">
        <div className="aiTabs">
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setError("");
              }}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>

        <div className="aiFormGrid">
          <ReadonlyField
            label={activeTab === "matchup" ? "我的球员" : "分析球员"}
            value={currentPlayerName}
            hint={currentPlayerId ? "当前登录账号绑定球员" : "当前账号未绑定球员"}
          />

          {activeTab === "matchup" && (
            <Field label="对手">
              <PlayerSelect value={opponentId} onChange={setOpponentId} players={players} excludeId={currentPlayerId} placeholder="选择对手" />
            </Field>
          )}

          <div className="aiSubmitWrap">
            <button className="btn btnBrand aiSubmitButton" type="button" onClick={generateAnalysis} disabled={!canSubmit || loading || pageLoading}>
              {loading ? "生成中..." : quotaBlocked ? "本周期已用完" : hasActiveReport ? "再生成一份" : "生成分析"}
            </button>
          </div>
        </div>

        <QuotaPanel quota={reportState.quota} cycle={reportState.cycle} activeTab={activeTab} />
        <ReportHistorySelector reports={activeReportHistory} selectedIndex={selectedReportIndex} onSelect={setSelectedReportIndex} />
      </div>

      {!currentPlayerId && !pageLoading && (
        <div className="errorBox">当前账号还没有绑定球员，无法生成 AI 报告。</div>
      )}
      {error && <div className="errorBox">{error}</div>}
      {pageLoading ? (
        <div className="card">加载中...</div>
      ) : (
        <ResultPanel result={activeReport} players={players} onDownloadPdf={() => downloadReportPdf(activeReport, players)} />
      )}
    </div>
  );
}
