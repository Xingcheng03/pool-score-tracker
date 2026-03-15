import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { calcPlayerStats, getPlayerById, getPlayers } from "../data/store.js";

function formatCount(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}

function formatPercent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleString();
}

function SummaryCard({ label, value }) {
  return (
    <div className="kpi playerDetailKpi">
      <div className="kpiLabel">{label}</div>
      <div className="kpiValue">{value}</div>
    </div>
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

  const player = useMemo(() => getPlayerById(playerId), [playerId, tick]);
  const playerMap = useMemo(() => new Map(getPlayers().map((item) => [item.id, item])), [tick]);
  const statsPractice = useMemo(() => calcPlayerStats(playerId, { tag: "practice" }), [playerId, tick]);
  const statsLive = useMemo(() => calcPlayerStats(playerId, { tag: "live" }), [playerId, tick]);

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

      <Section title="练习赛统计与记录" stats={statsPractice} playerId={playerId} playerMap={playerMap} />
      <Section title="直播统计与记录" stats={statsLive} playerId={playerId} playerMap={playerMap} />
    </div>
  );
}
