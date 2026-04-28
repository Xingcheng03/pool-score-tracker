import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import AccountSettingsForm from "../components/AccountSettingsForm.jsx";
import { INTERNAL_POINTS_NAME } from "../constants/labels.js";
import { apiRequest, buildQuery } from "../lib/api.js";

function formatCount(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}

function formatPercent(value) {
  return `${Math.round(Number(value ?? 0) * 1000) / 10}%`;
}

function formatRating(value) {
  if (!Number.isFinite(Number(value))) return "0";
  const rounded = Math.round(Number(value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatSignedRating(value) {
  const number = Number(value ?? 0);
  return `${number > 0 ? "+" : ""}${formatRating(number)}`;
}

function formatDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function SummaryCard({ label, value }) {
  return (
    <div className="kpi playerDetailKpi">
      <div className="kpiLabel">{label}</div>
      <div className="kpiValue">{value}</div>
    </div>
  );
}

function playerName(players, id) {
  return players.find((player) => player.id === id)?.name ?? "Unknown";
}

function buildLinePath(points) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function OpponentCard({ title, list, players, seasonQuery }) {
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
              <Link to={`/players/${item.opponentId}${seasonQuery}`}>{playerName(players, item.opponentId)}</Link>
              <span> x {formatCount(item.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchTable({ stats, playerId, players, seasonQuery }) {
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
              <th>放门</th>
              <th>放门方</th>
              <th>结果</th>
            </tr>
          </thead>
          <tbody>
            {stats.matches.length === 0 ? (
              <tr>
                <td colSpan="8" className="playerDetailEmpty">暂无记录</td>
              </tr>
            ) : (
              stats.matches.map((match) => {
                const isLeft = match.leftPlayerId === playerId;
                const meScore = isLeft ? match.leftScore : match.rightScore;
                const opponentScore = isLeft ? match.rightScore : match.leftScore;
                const opponentId = isLeft ? match.rightPlayerId : match.leftPlayerId;
                const result = !match.winnerId ? "-" : match.winnerId === playerId ? "Win" : "Loss";

                return (
                  <tr key={match.id}>
                    <td className="playerDetailMatchName">{match.matchName ?? "未命名比赛"}</td>
                    <td>{formatDate(match.dateISO)}</td>
                    <td>抢 {match.raceTo}</td>
                    <td><Link to={`/players/${opponentId}${seasonQuery}`}>{playerName(players, opponentId)}</Link></td>
                    <td>{meScore} : {opponentScore}</td>
                    <td>{match.isHandicap ? "是" : "否"}</td>
                    <td>{match.isHandicap ? playerName(players, match.handicapGiverId) : "-"}</td>
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

function Section({ title, stats, playerId, players, seasonQuery }) {
  return (
    <section className="card playerDetailSection">
      <div className="rowBetween playerDetailSectionHead">
        <div className="badge">{title}</div>
        <Link className="btn btnBrand" to="/new">上报比赛</Link>
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
            <OpponentCard title="战胜的对手（次数）" list={stats.beatenList} players={players} seasonQuery={seasonQuery} />
            <OpponentCard title="战败的对手（次数）" list={stats.lostToList} players={players} seasonQuery={seasonQuery} />
          </div>
        </div>

        <MatchTable stats={stats} playerId={playerId} players={players} seasonQuery={seasonQuery} />
      </div>
    </section>
  );
}

function RatingHistory({ history, players }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const rawHistoryPoints = useMemo(() => history.points ?? [], [history.points]);
  const chart = useMemo(() => {
    const width = 960;
    const height = 300;
    const pad = { top: 24, right: 36, bottom: 42, left: 54 };
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;
    const points = [
      {
        id: "start",
        isStart: true,
        rating: Number(history.startRating ?? 500),
        delta: 0,
      },
      ...rawHistoryPoints.map((point, index) => ({
        ...point,
        id: point.matchId ?? `point-${index}`,
        rating: Number(point.rating ?? 0),
        delta: Number(point.delta ?? 0),
      })),
    ];
    const ratings = points.map((point) => point.rating).filter(Number.isFinite);
    const minRating = Math.min(...ratings, Number(history.lowestRating ?? 500), Number(history.startRating ?? 500));
    const maxRating = Math.max(...ratings, Number(history.highestRating ?? 500), Number(history.startRating ?? 500));
    const spread = Math.max(8, maxRating - minRating);
    const minY = minRating - spread * 0.18;
    const maxY = maxRating + spread * 0.18;
    const yRange = Math.max(1, maxY - minY);
    const xStep = points.length <= 1 ? 0 : innerWidth / (points.length - 1);
    const scaled = points.map((point, index) => {
      const x = pad.left + xStep * index;
      const y = pad.top + ((maxY - point.rating) / yRange) * innerHeight;
      return {
        ...point,
        x,
        y,
        tooltipX: (x / width) * 100,
        tooltipY: (y / height) * 100,
      };
    });
    const linePath = buildLinePath(scaled);
    const areaPath = scaled.length > 0
      ? `${linePath} L ${scaled[scaled.length - 1].x} ${height - pad.bottom} L ${scaled[0].x} ${height - pad.bottom} Z`
      : "";
    const segments = scaled.slice(1).map((point, index) => {
      const previous = scaled[index];
      return {
        id: `${previous.id}-${point.id}`,
        path: `M ${previous.x} ${previous.y} L ${point.x} ${point.y}`,
        delta: point.delta,
      };
    });
    const grid = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      return {
        y: pad.top + innerHeight * ratio,
        value: maxY - yRange * ratio,
      };
    });

    return { width, height, pad, innerWidth, scaled, areaPath, segments, grid };
  }, [history, rawHistoryPoints]);

  return (
    <section className="card playerFargoCard">
      <div className="playerFargoHead">
        <div>
          <div className="badge">全部比赛{INTERNAL_POINTS_NAME}历史走势</div>
          <p className="playerFargoSub">后端按正式比赛时间顺序回放原 Rating 逻辑。</p>
        </div>
        <div className="playerFargoMeta">
          <div className="playerFargoStat"><span className="playerFargoStatLabel">起始</span><span className="playerFargoStatValue">{formatRating(history.startRating)}</span></div>
          <div className="playerFargoStat"><span className="playerFargoStatLabel">当前</span><span className="playerFargoStatValue">{formatRating(history.currentRating)}</span></div>
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">净变化</span>
            <span className={`playerFargoStatValue ${history.netChange > 0 ? "isUp" : history.netChange < 0 ? "isDown" : ""}`}>
              {formatSignedRating(history.netChange)}
            </span>
          </div>
        </div>
      </div>

      {rawHistoryPoints.length === 0 ? (
        <div className="playerFargoEmpty">暂无积分历史。</div>
      ) : (
        <div className="playerFargoCanvas" onMouseLeave={() => setHoveredPoint(null)}>
          <svg className="playerFargoSvg" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Rating history chart">
            <defs>
              <linearGradient id="playerFargoArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(100, 116, 139, 0.16)" />
                <stop offset="100%" stopColor="rgba(100, 116, 139, 0.02)" />
              </linearGradient>
            </defs>

            {chart.grid.map((line) => (
              <g key={line.y}>
                <line
                  x1={chart.pad.left}
                  x2={chart.pad.left + chart.innerWidth}
                  y1={line.y}
                  y2={line.y}
                  stroke="rgba(148, 163, 184, 0.24)"
                  strokeDasharray="6 8"
                />
                <text x={chart.pad.left - 12} y={line.y + 4} textAnchor="end" fill="rgba(100, 116, 139, 0.9)" fontSize="12" fontWeight="800">
                  {formatRating(line.value)}
                </text>
              </g>
            ))}

            <line
              x1={chart.pad.left}
              x2={chart.pad.left + chart.innerWidth}
              y1={chart.height - chart.pad.bottom}
              y2={chart.height - chart.pad.bottom}
              stroke="rgba(15, 23, 42, 0.12)"
            />
            <path d={chart.areaPath} fill="url(#playerFargoArea)" />
            {chart.segments.map((segment) => (
              <path
                key={segment.id}
                d={segment.path}
                fill="none"
                stroke={segment.delta >= 0 ? "var(--primary)" : "var(--danger)"}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {chart.scaled.map((point, index) => {
              const isHovered = hoveredPoint?.id === point.id;
              const pointColor = point.isStart ? "var(--muted)" : point.delta >= 0 ? "var(--primary)" : "var(--danger)";
              return (
                <g
                  key={`${point.id}-${index}`}
                  onMouseEnter={() => setHoveredPoint(point)}
                  onFocus={() => setHoveredPoint(point)}
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={point.x} cy={point.y} r={isHovered ? 7 : 4.5} fill="#ffffff" stroke={pointColor} strokeWidth={isHovered ? 3 : 2.4} />
                  <circle cx={point.x} cy={point.y} r="14" fill="transparent" />
                </g>
              );
            })}
          </svg>

          {hoveredPoint && (
            <div
              className="playerFargoTooltip"
              style={{
                left: `${Math.min(76, Math.max(4, hoveredPoint.tooltipX))}%`,
                top: `${Math.min(66, Math.max(8, hoveredPoint.tooltipY))}%`,
              }}
            >
              <div className="playerFargoTooltipDate">{hoveredPoint.isStart ? "起始 Rating" : formatDate(hoveredPoint.dateISO)}</div>
              <div className="playerFargoTooltipMetrics">
                <div className="playerFargoTooltipMetric">
                  <span>Rating</span>
                  <strong>{formatRating(hoveredPoint.rating)}</strong>
                </div>
                <div className="playerFargoTooltipMetric">
                  <span>变化</span>
                  <strong className={hoveredPoint.delta > 0 ? "isUp" : hoveredPoint.delta < 0 ? "isDown" : ""}>
                    {formatSignedRating(hoveredPoint.delta)}
                  </strong>
                </div>
              </div>
              {!hoveredPoint.isStart && (
                <>
                  <div className="playerFargoTooltipInfo">
                    {hoveredPoint.tag === "live" ? "直播" : "练习赛"} · 对手 {playerName(players, hoveredPoint.opponentId)} · {hoveredPoint.myScore} : {hoveredPoint.opponentScore}
                  </div>
                  <div className="playerFargoTooltipMatch">{hoveredPoint.matchName}</div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
export default function PlayerDetailPage() {
  const { playerId } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedSeasonId = searchParams.get("season") ?? "all";
  const seasonQuery = selectedSeasonId === "all" ? "" : `?season=${selectedSeasonId}`;
  const isOwnPlayerPage = user?.player?.id === playerId;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [playerResult, statsResult, seasonResult] = await Promise.all([
        apiRequest("/players"),
        apiRequest(`/leaderboard/players/${playerId}/stats${buildQuery({ season: selectedSeasonId })}`),
        apiRequest("/leaderboard/seasons"),
      ]);
      setPlayers(playerResult.players);
      setData(statsResult);
      setSeasons(seasonResult.seasons);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [playerId, selectedSeasonId]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSeasonChange(nextSeasonId) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextSeasonId === "all") nextParams.delete("season");
    else nextParams.set("season", nextSeasonId);
    setSearchParams(nextParams, { replace: true });
  }

  if (loading) return <div className="card">加载中...</div>;
  if (error) return <div className="errorBox">{error}</div>;
  if (!data?.player) return <div className="card">球员不存在。</div>;

  return (
    <div>
      <div className="playerDetailHero">
        <div>
          <h1 className="h1">{data.player.name}</h1>
          <p className="sub">分标签战绩：练习赛 + 直播。数据来自后端正式比赛记录。</p>
        </div>

        {isOwnPlayerPage && <AccountSettingsForm compact />}

        <div className="row">
          <select className="input playerDetailSeasonSelect" value={selectedSeasonId} onChange={(event) => handleSeasonChange(event.target.value)}>
            <option value="all">全部赛季</option>
            {seasons.map((season) => <option key={season.id} value={season.id}>{season.label}</option>)}
          </select>
          <button className="btn" onClick={load} type="button">刷新</button>
          <Link className="btn" to="/players">返回</Link>
        </div>
      </div>

      <RatingHistory history={data.fargoHistory} players={players} />
      <Section title="练习赛统计与记录" stats={data.practice} playerId={playerId} players={players} seasonQuery={seasonQuery} />
      <Section title="直播统计与记录" stats={data.live} playerId={playerId} players={players} seasonQuery={seasonQuery} />
    </div>
  );
}
