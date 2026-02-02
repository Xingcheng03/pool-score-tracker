import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addPlayer, deletePlayer, getPlayers, updatePlayer, calcPlayerStats } from "../data/store.js";
import ConfirmButton from "../components/ConfirmButton.jsx";

function pct(x) {
  return `${Math.round(x * 1000) / 10}%`;
}

function compareStr(a, b) {
  return String(a).localeCompare(String(b), "zh-Hans-CN", { sensitivity: "base" });
}

export default function PlayersPage() {
  const [tick, setTick] = useState(0);
  const [newName, setNewName] = useState("");

  const [rankTag, setRankTag] = useState("practice"); // "practice" | "live"
  const [rankTab, setRankTab] = useState("wins"); // "wins" | "winrate"

  const players = useMemo(() => getPlayers(), [tick]);

  const rankingRows = useMemo(() => {
    const computed = players.map((p) => {
      const s = calcPlayerStats(p.id, { tag: rankTag });
      return {
        playerId: p.id,
        name: p.name,
        total: s.total,
        wins: s.wins,
        losses: s.losses,
        winRate: s.winRate,
      };
    });

    if (rankTab === "wins") {
      computed.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.total !== a.total) return b.total - a.total;
        return compareStr(a.name, b.name);
      });
    } else {
      computed.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.total !== a.total) return b.total - a.total;
        return compareStr(a.name, b.name);
      });
    }

    return computed;
  }, [players, rankTab, rankTag]);

  const CARD_HEIGHT = 620;

  return (
    <div>
      <h1 className="h1">球员</h1>
      <p className="sub">支持添加 / 改名 / 删除（有比赛记录的球员不允许删除，避免数据断裂）。点击球员可查看练习赛/直播的分标签战绩。右侧为分标签排名榜单（无平局）。</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <div style={{ flex: 1, minWidth: 240 }}>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="输入新球员名称，例如：Johnny" />
          </div>
          <button
            className="btn btnBrand"
            type="button"
            onClick={() => {
              const name = newName.trim();
              if (!name) return;
              addPlayer(name);
              setNewName("");
              setTick((t) => t + 1);
            }}
          >
            添加球员
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <div className="card" style={{ height: CARD_HEIGHT, display: "flex", flexDirection: "column" }}>
          <div className="rowBetween" style={{ marginBottom: 12 }}>
            <div className="badge">球员数：{players.length}</div>
            <button className="btn" onClick={() => setTick((t) => t + 1)} type="button">
              刷新
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", minWidth: 560 }}>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>查看</th>
                  <th>改名</th>
                  <th>删除</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ color: "var(--muted)" }}>
                      暂无球员，先添加一个吧。
                    </td>
                  </tr>
                ) : (
                  players.map((p) => <PlayerRow key={p.id} player={p} onUpdated={() => setTick((t) => t + 1)} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ height: CARD_HEIGHT, display: "flex", flexDirection: "column" }}>
          <div className="rowBetween" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 18 }}>球员排名</div>
              <div className="sub" style={{ marginTop: 2 }}>
                先选标签（练习赛/直播），再选榜单（胜利场次/胜率）。
              </div>
            </div>

            <button className="btn" onClick={() => setTick((t) => t + 1)} type="button">
              刷新
            </button>
          </div>

          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <button className={rankTag === "practice" ? "btn btnBrand" : "btn"} type="button" onClick={() => setRankTag("practice")}>
              练习赛
            </button>
            <button className={rankTag === "live" ? "btn btnBrand" : "btn"} type="button" onClick={() => setRankTag("live")}>
              直播
            </button>

            <div className="badge" style={{ marginLeft: "auto" }}>
              当前：{rankTag === "live" ? "直播" : "练习赛"}
            </div>
          </div>

          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <button className={rankTab === "wins" ? "btn btnBrand" : "btn"} type="button" onClick={() => setRankTab("wins")}>
              胜利场次排名
            </button>
            <button className={rankTab === "winrate" ? "btn btnBrand" : "btn"} type="button" onClick={() => setRankTab("winrate")}>
              胜率排名
            </button>

            <div className="badge" style={{ marginLeft: "auto" }}>
              球员数：{rankingRows.length}
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", minWidth: 620 }}>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>排名</th>
                  <th>球员</th>
                  <th style={{ width: 90 }}>总场</th>
                  <th style={{ width: 90 }}>胜</th>
                  <th style={{ width: 90 }}>负</th>
                  <th style={{ width: 110 }}>胜率</th>
                </tr>
              </thead>
              <tbody>
                {rankingRows.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ color: "var(--muted)" }}>
                      暂无球员。请先在左侧添加球员。
                    </td>
                  </tr>
                ) : (
                  rankingRows.map((r, idx) => (
                    <tr key={r.playerId}>
                      <td style={{ fontWeight: 950 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 900 }}>
                        <Link to={`/players/${r.playerId}`}>{r.name}</Link>
                      </td>
                      <td>{r.total}</td>
                      <td>{r.wins}</td>
                      <td>{r.losses}</td>
                      <td style={{ fontWeight: 950 }}>{pct(r.winRate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerRow({ player, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);

  return (
    <tr>
      <td style={{ fontWeight: 900 }}>
        <Link to={`/players/${player.id}`}>{player.name}</Link>
      </td>

      <td>
        <Link className="btn" to={`/players/${player.id}`}>
          进入详情
        </Link>
      </td>

      <td>
        {!editing ? (
          <button className="btn" type="button" onClick={() => setEditing(true)}>
            改名
          </button>
        ) : (
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <input className="input" style={{ minWidth: 160 }} value={name} onChange={(e) => setName(e.target.value)} />
            <button
              className="btn btnBrand"
              type="button"
              onClick={() => {
                const v = name.trim();
                if (!v) return;
                updatePlayer(player.id, v);
                setEditing(false);
                onUpdated();
              }}
            >
              保存
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setName(player.name);
                setEditing(false);
              }}
            >
              取消
            </button>
          </div>
        )}
      </td>

      <td>
        <ConfirmButton
          confirmText={`确定删除球员 “${player.name}” 吗？`}
          onConfirm={() => {
            const res = deletePlayer(player.id);
            if (!res.ok) alert(res.reason);
            onUpdated();
          }}
        >
          删除
        </ConfirmButton>
      </td>
    </tr>
  );
}
