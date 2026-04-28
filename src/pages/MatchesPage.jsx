import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import ConfirmButton from "../components/ConfirmButton.jsx";
import { apiRequest } from "../lib/api.js";

function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function playerName(players, id) {
  return players.find((player) => player.id === id)?.name ?? "Unknown";
}

function tagLabel(tag) {
  return tag === "live" ? "直播" : "练习赛";
}

export default function MatchesPage() {
  const { isAdmin } = useAuth();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [tagFilter, setTagFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tagQuery = tagFilter === "all" ? "" : `?tag=${tagFilter}`;
      const [matchResult, playerResult] = await Promise.all([
        apiRequest(`/matches${tagQuery}`),
        apiRequest("/players"),
      ]);
      setMatches(matchResult.matches);
      setPlayers(playerResult.players);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [tagFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(matchId) {
    await apiRequest(`/matches/${matchId}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space">
      <h1 className="h1">比赛数据</h1>
      <p className="sub">
        这里展示后端正式比赛记录。球员上报的比分必须先由管理员审核，通过后才会出现在这里并进入排行榜。
      </p>

      <div className="card">
        <div className="rowBetween" style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <div className="badge">正式比赛数：{matches.length}</div>
            <button className={tagFilter === "all" ? "btn btnBrand" : "btn"} type="button" onClick={() => setTagFilter("all")}>
              全部
            </button>
            <button className={tagFilter === "practice" ? "btn btnBrand" : "btn"} type="button" onClick={() => setTagFilter("practice")}>
              练习赛
            </button>
            <button className={tagFilter === "live" ? "btn btnBrand" : "btn"} type="button" onClick={() => setTagFilter("live")}>
              直播
            </button>
          </div>

          <div className="row">
            <Link className="btn btnBrand" to="/new">上报比赛</Link>
            <button className="btn" onClick={load} type="button">刷新</button>
          </div>
        </div>

        {error && <div className="errorBox" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className="sub">加载中...</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>标签</th>
                  <th>比赛名称</th>
                  <th>时间</th>
                  <th>赛制</th>
                  <th>左侧</th>
                  <th>比分</th>
                  <th>右侧</th>
                  <th>胜者</th>
                  <th>放门</th>
                  {isAdmin && <th>操作</th>}
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? "10" : "9"} style={{ color: "var(--muted)" }}>
                      暂无正式比赛。
                    </td>
                  </tr>
                ) : (
                  matches.map((match) => (
                    <tr key={match.id}>
                      <td style={{ fontWeight: 900 }}>{tagLabel(match.tag)}</td>
                      <td style={{ fontWeight: 900 }}>{match.matchName}</td>
                      <td>{fmtDate(match.dateISO)}</td>
                      <td>抢 {match.raceTo}</td>
                      <td>{playerName(players, match.leftPlayerId)}</td>
                      <td>{match.leftScore} : {match.rightScore}</td>
                      <td>{playerName(players, match.rightPlayerId)}</td>
                      <td>{playerName(players, match.winnerId)}</td>
                      <td style={{ fontWeight: 900 }}>{match.isHandicap ? "是" : "否"}</td>
                      {isAdmin && (
                        <td>
                          <ConfirmButton confirmText="确定删除这场正式比赛吗？" onConfirm={() => onDelete(match.id)}>
                            删除
                          </ConfirmButton>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
