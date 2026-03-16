import React, { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  calcPlayerStats,
  getMatches,
  getPlayerFargoRatingHistory,
  getPlayers,
} from "../data/store.js";
import { INTERNAL_POINTS_NAME } from "../constants/labels.js";

function formatCount(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}

function formatPercent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatRating(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatSignedRating(value) {
  const number = Number(value ?? 0);
  return `${number > 0 ? "+" : ""}${formatRating(number)}`;
}

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleString();
}

function formatShortDate(iso) {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function SummaryCard({ label, value }) {
  return (
    <div className="kpi playerDetailKpi">
      <div className="kpiLabel">{label}</div>
      <div className="kpiValue">{value}</div>
    </div>
  );
}

function FargoHistoryChart({ history, playerMap }) {
  const points = history.points;
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const chart = useMemo(() => {
    if (points.length === 0) return null;

    const width = 960;
    const height = 320;
    const left = 70;
    const right = 24;
    const top = 24;
    const bottom = 42;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const values = [history.startRating, ...points.map((point) => point.rating)];
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max(4, (rawMax - rawMin) * 0.16 || 10);
    const minValue = rawMin - padding;
    const maxValue = rawMax + padding;
    const valueSpan = maxValue - minValue || 1;
    const axisValues = [maxValue, (maxValue + minValue) / 2, minValue];
    const toY = (value) => top + ((maxValue - value) / valueSpan) * plotHeight;
    const plottedPoints = points.map((point, index) => ({
      ...point,
      x:
        points.length === 1
          ? left + plotWidth / 2
          : left + (index * plotWidth) / (points.length - 1),
      y: toY(point.rating),
    }));

    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      axisRows: axisValues.map((value) => ({ value, y: toY(value) })),
      baselineY: toY(history.startRating),
      polyline: plottedPoints.map((point) => `${point.x},${point.y}`).join(" "),
      firstDate: formatShortDate(points[0].dateISO),
      lastDate: formatShortDate(points[points.length - 1].dateISO),
      plottedPoints,
    };
  }, [history.startRating, points]);

  function showTooltip(event, point) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const tooltipWidth = 248;
    const tooltipHeight = 116;
    const left = Math.min(Math.max(localX + 16, 12), rect.width - tooltipWidth - 12);
    const top =
      localY < tooltipHeight + 28
        ? Math.min(localY + 16, rect.height - tooltipHeight - 12)
        : Math.max(localY - tooltipHeight - 16, 12);

    setTooltip({ point, left, top });
  }

  return (
    <section className="card playerFargoCard">
      <div className="playerFargoHead">
        <div>
          <div className="badge">全部比赛{INTERNAL_POINTS_NAME}历史走势</div>
          <p className="playerFargoSub">
            按全部比赛时间顺序回放，练习赛和直播都会共同影响这条积分曲线，虚线表示起始 500 基线。
          </p>
        </div>

        <div className="playerFargoMeta">
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">起始</span>
            <span className="playerFargoStatValue">{formatRating(history.startRating)}</span>
          </div>
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">当前</span>
            <span className="playerFargoStatValue">{formatRating(history.currentRating)}</span>
          </div>
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">净变化</span>
            <span
              className={`playerFargoStatValue ${
                history.netChange > 0 ? "isUp" : history.netChange < 0 ? "isDown" : ""
              }`}
            >
              {formatSignedRating(history.netChange)}
            </span>
          </div>
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">最高</span>
            <span className="playerFargoStatValue">{formatRating(history.highestRating)}</span>
          </div>
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">最低</span>
            <span className="playerFargoStatValue">{formatRating(history.lowestRating)}</span>
          </div>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="playerFargoEmpty">
          暂无{INTERNAL_POINTS_NAME}历史数据。先录入这位球员的比赛后，这里会自动生成全部比赛的积分曲线。
        </div>
      ) : (
        <div className="playerFargoCanvas" ref={canvasRef} onMouseLeave={() => setTooltip(null)}>
          <svg
            className="playerFargoSvg"
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="img"
            aria-label={`全部比赛${INTERNAL_POINTS_NAME}历史走势`}
          >
            {chart.axisRows.map(({ value, y }) => {
              return (
                <g key={value}>
                  <line
                    x1={chart.left}
                    y1={y}
                    x2={chart.width - chart.right}
                    y2={y}
                    style={{ stroke: "rgba(148, 163, 184, 0.26)" }}
                  />
                  <text
                    x={chart.left - 12}
                    y={y + 4}
                    textAnchor="end"
                    style={{ fill: "var(--muted)", fontSize: 12, fontWeight: 700 }}
                  >
                    {formatRating(value)}
                  </text>
                </g>
              );
            })}

            <line
              x1={chart.left}
              y1={chart.baselineY}
              x2={chart.width - chart.right}
              y2={chart.baselineY}
              strokeDasharray="6 6"
              style={{ stroke: "rgba(37, 99, 235, 0.28)" }}
            />

            {chart.plottedPoints.length > 1 && (
              <polyline
                fill="none"
                stroke="var(--primary)"
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={chart.polyline}
              />
            )}

            {chart.plottedPoints.map((point) => (
              <g key={point.matchId}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="5.5"
                  fill={point.delta >= 0 ? "var(--primary)" : "var(--danger)"}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="16"
                  fill="rgba(0,0,0,0)"
                  onMouseEnter={(event) => showTooltip(event, point)}
                  onMouseMove={(event) => showTooltip(event, point)}
                />
              </g>
            ))}

            <text
              x={chart.left}
              y={chart.height - 8}
              textAnchor="start"
              style={{ fill: "var(--muted)", fontSize: 12, fontWeight: 700 }}
            >
              {chart.firstDate}
            </text>
            <text
              x={chart.width - chart.right}
              y={chart.height - 8}
              textAnchor="end"
              style={{ fill: "var(--muted)", fontSize: 12, fontWeight: 700 }}
            >
              {chart.lastDate}
            </text>
          </svg>

          {tooltip && (
            <div
              className="playerFargoTooltip"
              style={{ left: tooltip.left, top: tooltip.top }}
            >
              <div className="playerFargoTooltipDate">{formatDate(tooltip.point.dateISO)}</div>
              <div className="playerFargoTooltipMetrics">
                <div className="playerFargoTooltipMetric">
                  <span>{INTERNAL_POINTS_NAME}</span>
                  <strong>{formatRating(tooltip.point.rating)}</strong>
                </div>
                <div className="playerFargoTooltipMetric">
                  <span>变化</span>
                  <strong
                    className={
                      tooltip.point.delta > 0 ? "isUp" : tooltip.point.delta < 0 ? "isDown" : ""
                    }
                  >
                    {formatSignedRating(tooltip.point.delta)}
                  </strong>
                </div>
              </div>
              <div className="playerFargoTooltipInfo">
                {tooltip.point.tag === "live" ? "直播" : "练习赛"} · 对手{" "}
                {playerMap.get(tooltip.point.opponentId)?.name ?? "Unknown"}
              </div>
              <div className="playerFargoTooltipMatch">{tooltip.point.matchName}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function OpponentCard({ title, list, playerMap }) {
  return (
    <div className="card playerDetailOpponentCard">
      <div className="rowBetween playerDetailCardHead">
        <div className="badge">{title}</div>
      </div>

      {list.length === 0 ? (
        <div className="playerDetailEmpty">暂无</div>
      ) : (
        <ul className="playerDetailOpponentList">
          {list.map((item) => (
            <li key={item.opponentId}>
              <Link to={`/players/${item.opponentId}`}>{playerMap.get(item.opponentId)?.name ?? "Unknown"}</Link>
              <span> × {formatCount(item.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchTable({ stats, playerId, playerMap }) {
  return (
    <div className="card playerDetailTableCard">
      <div className="rowBetween playerDetailCardHead">
        <div className="badge">比赛记录</div>
        <div className="badge">共 {stats.matches.length} 场</div>
      </div>

      <div className="tableWrap playerDetailTableWrap">
        <table className="playerDetailTable">
          <thead>
            <tr>
              <th>比赛名称</th>
              <th>时间</th>
              <th>赛制</th>
              <th>对手</th>
              <th>比分</th>
              <th>是否放门</th>
              <th>放门方</th>
              <th>结果</th>
            </tr>
          </thead>
          <tbody>
            {stats.matches.length === 0 ? (
              <tr>
                <td colSpan="8" className="playerDetailEmpty">
                  暂无记录
                </td>
              </tr>
            ) : (
              stats.matches.map((match) => {
                const isLeft = match.leftPlayerId === playerId;
                const meScore = isLeft ? match.leftScore : match.rightScore;
                const opponentScore = isLeft ? match.rightScore : match.leftScore;
                const opponentId = isLeft ? match.rightPlayerId : match.leftPlayerId;
                const opponent = playerMap.get(opponentId);
                const handicapLabel = match.isHandicap ? "是" : "否";
                const handicapGiver = match.isHandicap
                  ? (playerMap.get(match.handicapGiverId)?.name ?? "Unknown")
                  : "-";
                const result = !match.winnerId ? "-" : match.winnerId === playerId ? "Win" : "Loss";

                return (
                  <tr key={match.id}>
                    <td className="playerDetailMatchName">{match.matchName ?? "未命名比赛"}</td>
                    <td>{formatDate(match.dateISO)}</td>
                    <td>抢 {match.raceTo}</td>
                    <td>
                      <Link to={`/players/${opponentId}`}>{opponent?.name ?? "Unknown"}</Link>
                    </td>
                    <td>
                      {meScore} : {opponentScore}
                    </td>
                    <td>{handicapLabel}</td>
                    <td>{handicapGiver}</td>
                    <td className="playerDetailResult">{result}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({ title, stats, playerId, playerMap }) {
  return (
    <section className="card playerDetailSection">
      <div className="rowBetween playerDetailSectionHead">
        <div className="badge">{title}</div>
        <Link className="btn btnBrand" to="/new">
          立即新建比赛
        </Link>
      </div>

      <div className="playerDetailSplit">
        <div className="playerDetailStatsColumn">
          <div className="playerDetailKpiGrid">
            <SummaryCard label="总场次" value={formatCount(stats.total)} />
            <SummaryCard label="胜场" value={formatCount(stats.wins)} />
            <SummaryCard label="负场" value={formatCount(stats.losses)} />
            <SummaryCard label="胜率" value={formatPercent(stats.winRate)} />
          </div>

          <div className="playerDetailOpponentGrid">
            <OpponentCard title="战胜的对手（次数）" list={stats.beatenList} playerMap={playerMap} />
            <OpponentCard title="战败的对手（次数）" list={stats.lostToList} playerMap={playerMap} />
          </div>
        </div>

        <MatchTable stats={stats} playerId={playerId} playerMap={playerMap} />
      </div>
    </section>
  );
}

export default function PlayerDetailPage() {
  const { playerId } = useParams();
  const [tick, setTick] = useState(0);

  const players = useMemo(() => getPlayers(), [tick]);
  const matches = useMemo(() => getMatches("all"), [tick]);
  const playerMap = useMemo(() => new Map(players.map((item) => [item.id, item])), [players]);
  const player = playerMap.get(playerId) ?? null;
  const statsPractice = useMemo(
    () => calcPlayerStats(playerId, { tag: "practice", _matches: matches }),
    [playerId, matches],
  );
  const statsLive = useMemo(
    () => calcPlayerStats(playerId, { tag: "live", _matches: matches }),
    [playerId, matches],
  );
  const fargoHistory = useMemo(
    () => getPlayerFargoRatingHistory(playerId, { _players: players, _matches: matches }),
    [playerId, players, matches],
  );

  if (!player) {
    return (
      <div className="card">
        <div className="rowBetween">
          <div>
            <h1 className="h1">球员不存在</h1>
            <p className="sub">该球员可能已经被删除。</p>
          </div>
          <Link className="btn" to="/players">
            返回球员列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="rowBetween" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="h1">{player.name}</h1>
          <p className="sub">分标签战绩：练习赛 + 直播（无平局）</p>
        </div>

        <div className="row">
          <button className="btn" onClick={() => setTick((value) => value + 1)} type="button">
            刷新
          </button>
          <Link className="btn" to="/players">
            返回
          </Link>
        </div>
      </div>

      <FargoHistoryChart history={fargoHistory} playerMap={playerMap} />
      <Section title="练习赛统计与记录" stats={statsPractice} playerId={playerId} playerMap={playerMap} />
      <Section title="直播统计与记录" stats={statsLive} playerId={playerId} playerMap={playerMap} />
    </div>
  );
}
