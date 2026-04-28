import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
  const latest = [...(history.points ?? [])].slice(-12).reverse();

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

      {latest.length === 0 ? (
        <div className="playerFargoEmpty">暂无积分历史。</div>
      ) : (
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>比赛</th>
                <th>标签</th>
                <th>对手</th>
                <th>比分</th>
                <th>Rating</th>
                <th>变化</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((point) => (
                <tr key={point.matchId}>
                  <td>{formatDate(point.dateISO)}</td>
                  <td>{point.matchName}</td>
                  <td>{point.tag === "live" ? "直播" : "练习赛"}</td>
                  <td>{playerName(players, point.opponentId)}</td>
                  <td>{point.myScore} : {point.opponentScore}</td>
                  <td>{formatRating(point.rating)}</td>
                  <td style={{ color: point.delta >= 0 ? "var(--primary)" : "var(--danger)", fontWeight: 900 }}>
                    {formatSignedRating(point.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function PlayerDetailPage() {
  const { playerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedSeasonId = searchParams.get("season") ?? "all";
  const seasonQuery = selectedSeasonId === "all" ? "" : `?season=${selectedSeasonId}`;

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
      <div className="rowBetween" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="h1">{data.player.name}</h1>
          <p className="sub">分标签战绩：练习赛 + 直播。数据来自后端正式比赛记录。</p>
        </div>

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
