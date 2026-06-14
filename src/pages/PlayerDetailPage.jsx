import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import AccountSettingsForm from "../components/AccountSettingsForm.jsx";
import { apiRequest, buildQuery, jsonBody } from "../lib/api.js";
import { cachedApiRequest, invalidateApiCache, invalidatePoolDataCache } from "../lib/apiCache.js";
import { useT } from "../lib/i18n.jsx";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isoToDayInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayInput();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dayInputToISO(dayValue) {
  return new Date(`${dayValue}T12:00:00`).toISOString();
}

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
  const t = useT();
  return (
    <div className="card playerDetailOpponentCard">
      <div className="rowBetween playerDetailCardHead">
        <div className="badge">{title}</div>
      </div>
      {list.length === 0 ? (
        <div className="playerDetailEmpty">{t("暂无", "None")}</div>
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
  const t = useT();
  return (
    <div className="card playerDetailTableCard">
      <div className="rowBetween playerDetailCardHead">
        <div className="badge">{t("比赛记录", "Match Records")}</div>
        <div className="badge">{t(`共 ${stats.matches.length} 场`, `${stats.matches.length} matches total`)}</div>
      </div>

      <div className="tableWrap playerDetailTableWrap">
        <table className="playerDetailTable">
          <thead>
            <tr>
              <th>{t("比赛名称", "Match Name")}</th>
              <th>{t("时间", "Time")}</th>
              <th>{t("赛制", "Format")}</th>
              <th>{t("对手", "Opponent")}</th>
              <th>{t("比分", "Score")}</th>
              <th>{t("放门", "Handicap")}</th>
              <th>{t("放门方", "Giver")}</th>
              <th>{t("结果", "Result")}</th>
            </tr>
          </thead>
          <tbody>
            {stats.matches.length === 0 ? (
              <tr>
                <td colSpan="8" className="playerDetailEmpty">{t("暂无记录", "No records")}</td>
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
                    <td className="playerDetailMatchName">{match.matchName ?? t("未命名比赛", "Untitled Match")}</td>
                    <td>{formatDate(match.dateISO)}</td>
                    <td>{t(`抢 ${match.raceTo}`, `Race to ${match.raceTo}`)}</td>
                    <td><Link to={`/players/${opponentId}${seasonQuery}`}>{playerName(players, opponentId)}</Link></td>
                    <td>{meScore} : {opponentScore}</td>
                    <td>{match.isHandicap ? t("是", "Yes") : t("否", "No")}</td>
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
  const t = useT();
  return (
    <section className="card playerDetailSection">
      <div className="rowBetween playerDetailSectionHead">
        <div className="badge">{title}</div>
        <Link className="btn btnBrand" to="/new">{t("上报比赛", "Submit Match")}</Link>
      </div>

      <div className="playerDetailSplit">
        <div className="playerDetailStatsColumn">
          <div className="playerDetailKpiGrid">
            <SummaryCard label={t("总场次", "Total")} value={formatCount(stats.total)} />
            <SummaryCard label={t("胜场", "Wins")} value={formatCount(stats.wins)} />
            <SummaryCard label={t("负场", "Losses")} value={formatCount(stats.losses)} />
            <SummaryCard label={t("胜率", "Win Rate")} value={formatPercent(stats.winRate)} />
          </div>

          <div className="playerDetailOpponentGrid">
            <OpponentCard title={t("战胜的对手（次数）", "Beaten Opponents (count)")} list={stats.beatenList} players={players} seasonQuery={seasonQuery} />
            <OpponentCard title={t("战败的对手（次数）", "Lost-To Opponents (count)")} list={stats.lostToList} players={players} seasonQuery={seasonQuery} />
          </div>
        </div>

        <MatchTable stats={stats} playerId={playerId} players={players} seasonQuery={seasonQuery} />
      </div>
    </section>
  );
}

function RatingHistory({ history, players }) {
  const t = useT();
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
          <div className="badge">{t(
            "全部比赛街灯榜历史走势",
            "All-Match Street Light Leaderboard History",
          )}</div>
        </div>
        <div className="playerFargoMeta">
          <div className="playerFargoStat"><span className="playerFargoStatLabel">{t("起始", "Start")}</span><span className="playerFargoStatValue">{formatRating(history.startRating)}</span></div>
          <div className="playerFargoStat"><span className="playerFargoStatLabel">{t("当前", "Current")}</span><span className="playerFargoStatValue">{formatRating(history.currentRating)}</span></div>
          <div className="playerFargoStat">
            <span className="playerFargoStatLabel">{t("净变化", "Net Change")}</span>
            <span className={`playerFargoStatValue ${history.netChange > 0 ? "isUp" : history.netChange < 0 ? "isDown" : ""}`}>
              {formatSignedRating(history.netChange)}
            </span>
          </div>
        </div>
      </div>

      {rawHistoryPoints.length === 0 ? (
        <div className="playerFargoEmpty">{t("暂无积分历史。", "No rating history yet.")}</div>
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
              <div className="playerFargoTooltipDate">{hoveredPoint.isStart ? t("起始 Rating", "Start Rating") : formatDate(hoveredPoint.dateISO)}</div>
              <div className="playerFargoTooltipMetrics">
                <div className="playerFargoTooltipMetric">
                  <span>Rating</span>
                  <strong>{formatRating(hoveredPoint.rating)}</strong>
                </div>
                <div className="playerFargoTooltipMetric">
                  <span>{t("变化", "Change")}</span>
                  <strong className={hoveredPoint.delta > 0 ? "isUp" : hoveredPoint.delta < 0 ? "isDown" : ""}>
                    {formatSignedRating(hoveredPoint.delta)}
                  </strong>
                </div>
              </div>
              {!hoveredPoint.isStart && (
                <>
                  <div className="playerFargoTooltipInfo">
                    {hoveredPoint.tag === "live" ? t("直播", "Live") : t("练习赛", "Practice")} · {t("对手", "Opponent")} {playerName(players, hoveredPoint.opponentId)} · {hoveredPoint.myScore} : {hoveredPoint.opponentScore}
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
  const { user, isAdmin } = useAuth();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [data, setData] = useState(null);
  const [playerDetail, setPlayerDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [retireOpen, setRetireOpen] = useState(false);
  const [retireNote, setRetireNote] = useState("");
  const [retireDate, setRetireDate] = useState(todayInput);
  const [highlightIds, setHighlightIds] = useState([]);
  const [retireSaving, setRetireSaving] = useState(false);
  const [retireError, setRetireError] = useState("");

  const selectedSeasonId = searchParams.get("season") ?? "all";
  const seasonQuery = selectedSeasonId === "all" ? "" : `?season=${selectedSeasonId}`;
  const isOwnPlayerPage = user?.player?.id === playerId;

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const [playerResult, statsResult, seasonResult, detailResult] = await Promise.all([
        cachedApiRequest("/players", { force }),
        cachedApiRequest(`/leaderboard/players/${playerId}/stats${buildQuery({ season: selectedSeasonId })}`, { force }),
        cachedApiRequest("/leaderboard/seasons", { force }),
        cachedApiRequest(`/players/${playerId}`, { force }),
      ]);
      setPlayers(playerResult.players);
      setData(statsResult);
      setSeasons(seasonResult.seasons);
      setPlayerDetail(detailResult.player);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [playerId, selectedSeasonId]);

  useEffect(() => {
    load();
  }, [load]);

  // 球员全部比赛（练习+直播去重），按时间倒序，供高光挑选
  const allMatches = useMemo(() => {
    const map = new Map();
    for (const m of [...(data?.practice?.matches ?? []), ...(data?.live?.matches ?? [])]) {
      map.set(m.id, m);
    }
    return [...map.values()].sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
  }, [data]);

  const isRetired = Boolean(playerDetail?.retired);

  function openRetirePanel() {
    setRetireNote(playerDetail?.retirementNote ?? "");
    setRetireDate(playerDetail?.retiredAt ? isoToDayInput(playerDetail.retiredAt) : todayInput());
    setHighlightIds(playerDetail?.highlightMatchIds ?? []);
    setRetireError("");
    setRetireOpen(true);
  }

  function toggleHighlight(id) {
    setHighlightIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 3) return cur;
      return [...cur, id];
    });
  }

  async function confirmRetire() {
    setRetireSaving(true);
    setRetireError("");
    try {
      await apiRequest(`/players/${playerId}/retirement`, {
        method: "PATCH",
        body: jsonBody({
          retired: true,
          retirementNote: retireNote.trim(),
          retiredAt: dayInputToISO(retireDate),
          highlightMatchIds: highlightIds,
        }),
      });
      invalidatePoolDataCache();
      invalidateApiCache(["/retired", `/players/${playerId}`]);
      setRetireOpen(false);
      await load(true);
    } catch (err) {
      setRetireError(err?.message ?? String(err));
    } finally {
      setRetireSaving(false);
    }
  }

  async function returnPlayer() {
    if (!window.confirm(t("确定让该球员回归吗？回归后将重新出现在街灯榜与胜负榜。", "Bring this player back? They will reappear on the leaderboards."))) return;
    try {
      await apiRequest(`/players/${playerId}/retirement`, { method: "PATCH", body: jsonBody({ retired: false }) });
      invalidatePoolDataCache();
      invalidateApiCache(["/retired", `/players/${playerId}`]);
      await load(true);
    } catch (err) {
      setError(err?.message ?? String(err));
    }
  }

  function handleSeasonChange(nextSeasonId) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextSeasonId === "all") nextParams.delete("season");
    else nextParams.set("season", nextSeasonId);
    setSearchParams(nextParams, { replace: true });
  }

  if (loading) return <div className="card">{t("加载中...", "Loading...")}</div>;
  if (error) return <div className="errorBox">{error}</div>;
  if (!data?.player) return <div className="card">{t("球员不存在。", "Player not found.")}</div>;

  return (
    <div>
      <div className="playerDetailHero">
        <div className="playerDetailTitleBlock">
          <h1 className="h1">
            {data.player.name}
            {isRetired && (
              <span className="badge" style={{ marginLeft: 10, verticalAlign: "middle", borderColor: "rgba(100,116,139,.5)", color: "var(--muted)" }}>
                {t("已退役", "Retired")}
              </span>
            )}
          </h1>
          {isRetired && playerDetail?.retirementNote && (
            <div style={{ marginTop: 2, fontWeight: 800, color: "var(--primary)" }}>“{playerDetail.retirementNote}”</div>
          )}
          <p className="sub">{t(
            "分标签战绩：练习赛 + 直播。数据来自正式比赛记录。",
            "Per-tag records: Practice + Live. Data sourced from official match records.",
          )}</p>
        </div>

        {isOwnPlayerPage && <AccountSettingsForm compact />}

        <div className="row playerDetailControls">
          {isAdmin && (
            <div className="playerDetailRetireControls">
              {isRetired ? (
                <>
                  <button className="btn" type="button" onClick={openRetirePanel}>{t("编辑退役信息", "Edit Retirement")}</button>
                  <button className="btn btnBrand" type="button" onClick={returnPlayer}>{t("回归", "Return")}</button>
                </>
              ) : (
                <button className="btn" type="button" onClick={openRetirePanel}>{t("退役", "Retire")}</button>
              )}
            </div>
          )}
          <select className="input playerDetailSeasonSelect" value={selectedSeasonId} onChange={(event) => handleSeasonChange(event.target.value)}>
            <option value="all">{t("全部赛季", "All seasons")}</option>
            {seasons.map((season) => <option key={season.id} value={season.id}>{season.label}</option>)}
          </select>
          <button className="btn playerDetailRefreshButton" onClick={() => load(true)} type="button">{t("刷新", "Refresh")}</button>
          <Link className="btn playerDetailBackButton" to="/players">{t("返回", "Back")}</Link>
        </div>
      </div>

      {isAdmin && retireOpen && (
        <div className="card" style={{ marginBottom: 14, borderColor: "rgba(100,116,139,.4)" }}>
          <div className="rowBetween" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>
              {isRetired ? t("编辑退役信息", "Edit Retirement") : t("设置退役", "Retire Player")}
            </div>
            <button className="btn" type="button" onClick={() => setRetireOpen(false)}>{t("取消", "Cancel")}</button>
          </div>

          <div className="row" style={{ alignItems: "flex-end", gap: 12 }}>
            <div style={{ width: 200, minWidth: 200 }}>
              <div className="smallMuted">{t("退役日期", "Retirement Date")}</div>
              <input className="input" type="date" value={retireDate} onChange={(e) => setRetireDate(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="smallMuted">{t("备注 / 绰号（显示在名字旁）", "Note / nickname (shown by the name)")}</div>
              <input className="input" value={retireNote} onChange={(e) => setRetireNote(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="rowBetween" style={{ marginBottom: 8 }}>
              <div className="smallMuted">{t("高光时刻（从该球员的比赛中最多选 3 场）", "Highlights (pick up to 3 of this player's matches)")}</div>
              <span className="badge">{t(`已选 ${highlightIds.length} / 3`, `${highlightIds.length} / 3 selected`)}</span>
            </div>

            {allMatches.length === 0 ? (
              <div className="playerDetailEmpty">{t("该球员暂无比赛记录可选。", "No matches available to pick.")}</div>
            ) : (
              <div className="retireHighlightPicker">
                {allMatches.map((match) => {
                  const isLeft = match.leftPlayerId === playerId;
                  const meScore = isLeft ? match.leftScore : match.rightScore;
                  const oppScore = isLeft ? match.rightScore : match.leftScore;
                  const opponentId = isLeft ? match.rightPlayerId : match.leftPlayerId;
                  const result = !match.winnerId ? "-" : match.winnerId === playerId ? t("胜", "W") : t("负", "L");
                  const selected = highlightIds.includes(match.id);
                  const disabled = !selected && highlightIds.length >= 3;
                  return (
                    <button
                      key={match.id}
                      type="button"
                      className={`retireHighlightRow${selected ? " isSelected" : ""}`}
                      onClick={() => toggleHighlight(match.id)}
                      disabled={disabled}
                    >
                      <span className="retireHighlightCheck">{selected ? "✓" : ""}</span>
                      <span className="retireHighlightMain">
                        <span className="retireHighlightName">{match.matchName ?? t("未命名比赛", "Untitled Match")}</span>
                        <span className="retireHighlightMeta">
                          {formatDate(match.dateISO)} · {playerName(players, opponentId)} · {meScore}:{oppScore} · {result}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {retireError && <div className="errorBox" style={{ marginTop: 12 }}>{retireError}</div>}

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn btnBrand" type="button" disabled={retireSaving || !retireDate} onClick={confirmRetire}>
              {retireSaving ? t("保存中...", "Saving...") : isRetired ? t("保存修改", "Save Changes") : t("确认退役", "Confirm Retirement")}
            </button>
            <button className="btn" type="button" onClick={() => setRetireOpen(false)}>{t("取消", "Cancel")}</button>
          </div>
        </div>
      )}

      <RatingHistory history={data.fargoHistory} players={players} />
      <Section title={t("练习赛统计与记录", "Practice Stats & Records")} stats={data.practice} playerId={playerId} players={players} seasonQuery={seasonQuery} />
      <Section title={t("直播统计与记录", "Live Stats & Records")} stats={data.live} playerId={playerId} players={players} seasonQuery={seasonQuery} />
    </div>
  );
}
