import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { calcPlayerStats, getPlayerById, getPlayerById as getP } from "../data/store.js";

function pct(x) {
  return `${Math.round(x * 1000) / 10}%`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function Section({ title, stats, playerId }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="rowBetween" style={{ marginBottom: 10 }}>
        <div className="badge">{title}</div>
        <Link className="btn btnBrand" to="/new">
          立即新建比赛
        </Link>
      </div>

      <div className="kpiGrid" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <div className="kpiLabel">总场次</div>
          <div className="kpiValue">{stats.total}</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">胜场</div>
          <div className="kpiValue">{stats.wins}</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">负场</div>
          <div className="kpiValue">{stats.losses}</div>
        </div>
        <div className="kpi">
          <div className="kpiLabel">胜率</div>
          <div className="kpiValue">{pct(stats.winRate)}</div>
        </div>
      </div>

      <div className="row" style={{ alignItems: "stretch" }}>
        <div className="card" style={{ flex: 1, minWidth: 300 }}>
          <div className="rowBetween" style={{ marginBottom: 10 }}>
            <div className="badge">战胜的对手（次数）</div>
          </div>
          {stats.beatenList.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>暂无</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {stats.beatenList.map((x) => (
                <li key={x.opponentId} style={{ marginBottom: 6 }}>
                  <Link to={`/players/${x.opponentId}`}>{getP(x.opponentId)?.name ?? "Unknown"}</Link> × {x.count}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card" style={{ flex: 1, minWidth: 300 }}>
          <div className="rowBetween" style={{ marginBottom: 10 }}>
            <div className="badge">战败的对手（次数）</div>
          </div>
          {stats.lostToList.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>暂无</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {stats.lostToList.map((x) => (
                <li key={x.opponentId} style={{ marginBottom: 6 }}>
                  <Link to={`/players/${x.opponentId}`}>{getP(x.opponentId)?.name ?? "Unknown"}</Link> × {x.count}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="rowBetween" style={{ marginBottom: 10 }}>
          <div className="badge">比赛记录</div>
          <div className="badge">共 {stats.matches.length} 场</div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>比赛名称</th>
                <th>时间</th>
                <th>赛制</th>
                <th>对手</th>
                <th>比分</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {stats.matches.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ color: "var(--muted)" }}>
                    暂无记录
                  </td>
                </tr>
              ) : (
                stats.matches.map((m) => {
                  const isLeft = m.leftPlayerId === playerId;
                  const meScore = isLeft ? m.leftScore : m.rightScore;
                  const opScore = isLeft ? m.rightScore : m.leftScore;
                  const opponentId = isLeft ? m.rightPlayerId : m.leftPlayerId;
                  const opponent = getP(opponentId);

                  // 老平局数据 winnerId 可能为 null：显示 —
                  const result = !m.winnerId ? "—" : m.winnerId === playerId ? "Win" : "Loss";

                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 900 }}>{m.matchName ?? "未命名比赛"}</td>
                      <td>{fmtDate(m.dateISO)}</td>
                      <td>抢 {m.raceTo}</td>
                      <td>
                        <Link to={`/players/${opponentId}`}>{opponent?.name ?? "Unknown"}</Link>
                      </td>
                      <td>
                        {meScore} : {opScore}
                      </td>
                      <td style={{ fontWeight: 950 }}>{result}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PlayerDetailPage() {
  const { playerId } = useParams();
  const [tick, setTick] = useState(0);

  const player = useMemo(() => getPlayerById(playerId), [playerId, tick]);

  const statsPractice = useMemo(() => calcPlayerStats(playerId, { tag: "practice" }), [playerId, tick]);
  const statsLive = useMemo(() => calcPlayerStats(playerId, { tag: "live" }), [playerId, tick]);

  if (!player) {
    return (
      <div className="card">
        <div className="rowBetween">
          <div>
            <h1 className="h1">球员不存在</h1>
            <p className="sub">可能已被删除。</p>
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
          <button className="btn" onClick={() => setTick((t) => t + 1)} type="button">
            刷新
          </button>
          <Link className="btn" to="/players">
            返回
          </Link>
        </div>
      </div>

      <Section title="练习赛统计与记录" stats={statsPractice} playerId={playerId} />
      <Section title="直播统计与记录" stats={statsLive} playerId={playerId} />
    </div>
  );
}
