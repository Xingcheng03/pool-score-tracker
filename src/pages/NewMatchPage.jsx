import React, { useMemo, useState } from "react";
import { addMatch, getPlayers, tagLabel } from "../data/store.js";
import { useNavigate } from "react-router-dom";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatYMD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatLocalDateTimeInput(d) {
  return `${formatYMD(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function defaultMatchName(tag) {
  const now = new Date();
  return `${tag === "live" ? "直播" : "练习赛"} ${formatYMD(now)}`;
}

export default function NewMatchPage() {
  const nav = useNavigate();
  const players = useMemo(() => getPlayers(), []);

  const [tag, setTag] = useState("practice");
  const [matchName, setMatchName] = useState(() => defaultMatchName("practice"));
  const [raceTo, setRaceTo] = useState(7);

  const [leftPlayerId, setLeftPlayerId] = useState("");
  const [rightPlayerId, setRightPlayerId] = useState("");

  const [leftScore, setLeftScore] = useState(0);
  const [rightScore, setRightScore] = useState(0);

  const [matchDateTimeLocal, setMatchDateTimeLocal] = useState(() => formatLocalDateTimeInput(new Date()));

  const [isHandicap, setIsHandicap] = useState(false);
  const [handicapGiverSide, setHandicapGiverSide] = useState("left");

  const leftPlayer = players.find((p) => p.id === leftPlayerId);
  const rightPlayer = players.find((p) => p.id === rightPlayerId);

  const hasTwoPlayers = players.length >= 2;
  const bothSelected = Boolean(leftPlayerId && rightPlayerId);
  const samePlayer = leftPlayerId && rightPlayerId && leftPlayerId === rightPlayerId;

  const scoreTie = leftScore === rightScore;
  const hasWinner = leftScore >= raceTo || rightScore >= raceTo;
  const winner = hasWinner && leftScore >= raceTo ? "left" : hasWinner && rightScore >= raceTo ? "right" : null;

  const disableScoreButtons = !hasTwoPlayers || !bothSelected || samePlayer;

  const invalid =
    !hasTwoPlayers ||
    !matchName.trim() ||
    !bothSelected ||
    samePlayer ||
    !matchDateTimeLocal ||
    !tag ||
    raceTo <= 0 ||
    Number.isNaN(Number(raceTo)) ||
    scoreTie;

  const bumpScore = (side, delta) => {
    if (side === "left") setLeftScore((s) => Math.max(0, s + delta));
    else setRightScore((s) => Math.max(0, s + delta));
  };

  const resetScore = () => {
    setLeftScore(0);
    setRightScore(0);
  };

  const onChangeTag = (v) => {
    setTag(v);
    const prefixMatch = matchName.startsWith("练习赛") || matchName.startsWith("直播");
    if (prefixMatch) setMatchName(defaultMatchName(v));
  };

  const onSave = () => {
    const dateISO = new Date(matchDateTimeLocal).toISOString();

    const handicapGiverId = isHandicap ? (handicapGiverSide === "left" ? leftPlayerId : rightPlayerId) : null;
    const handicapReceiverId = isHandicap ? (handicapGiverSide === "left" ? rightPlayerId : leftPlayerId) : null;

    addMatch({
      matchName: matchName.trim(),
      dateISO,
      raceTo,
      tag,
      leftPlayerId,
      rightPlayerId,
      leftScore,
      rightScore,
      isHandicap,
      handicapGiverId,
      handicapReceiverId,
    });

    nav("/matches");
  };

  return (
    <div>
      <h1 className="h1">新建比赛</h1>
      <p className="sub">设置比赛名称、左右球员、抢几、比赛时间、标签，用比分板记录局数，结束后保存到本地并自动更新战绩（不允许平局）。</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="smallMuted">比赛名称</div>
            <input className="input" value={matchName} onChange={(e) => setMatchName(e.target.value)} placeholder="例如：周末友谊赛 / 决赛 BO13 / 训练记录" />
          </div>
        </div>

        <div className="row" style={{ gap: 12, alignItems: "center", marginBottom: 12 }}>
          <label className="row" style={{ gap: 8, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={isHandicap} onChange={(e) => setIsHandicap(e.target.checked)} />
            <span style={{ fontWeight: 900 }}>放门</span>
          </label>

          <div className="badge" style={{ marginLeft: "auto" }}>
            {isHandicap ? "开启：若被放门方赢，胜率会折算" : "未开启"}
          </div>
        </div>

        {isHandicap && (
          <div className="row" style={{ gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 320 }}>
              <div className="smallMuted">谁给谁放门</div>
              <select className="input" value={handicapGiverSide} onChange={(e) => setHandicapGiverSide(e.target.value)} disabled={!bothSelected || samePlayer}>
                <option value="left">{`${leftPlayer?.name ?? "左侧"} 给 ${rightPlayer?.name ?? "右侧"} 放门`}</option>
                <option value="right">{`${rightPlayer?.name ?? "右侧"} 给 ${leftPlayer?.name ?? "左侧"} 放门`}</option>
              </select>
            </div>

            <div className="badge" style={{ minWidth: 220 }}>
              {bothSelected && !samePlayer ? (handicapGiverSide === "left" ? `放门方：${leftPlayer?.name ?? "—"}` : `放门方：${rightPlayer?.name ?? "—"}`) : "先选择左右球员"}
            </div>
          </div>
        )}

        <div className="row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="smallMuted">左侧球员</div>
            <select className="input" value={leftPlayerId} onChange={(e) => setLeftPlayerId(e.target.value)}>
              <option value="">请选择</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: 140, minWidth: 140 }}>
            <div className="smallMuted">抢几（Race To）</div>
            <input className="input" type="number" min="1" value={raceTo} onChange={(e) => setRaceTo(Number(e.target.value))} />
          </div>

          <div style={{ width: 200, minWidth: 200 }}>
            <div className="smallMuted">标签</div>
            <select className="input" value={tag} onChange={(e) => onChangeTag(e.target.value)}>
              <option value="practice">练习赛</option>
              <option value="live">直播</option>
            </select>
          </div>

          <div style={{ width: 240, minWidth: 240 }}>
            <div className="smallMuted">比赛时间</div>
            <input className="input" type="datetime-local" value={matchDateTimeLocal} onChange={(e) => setMatchDateTimeLocal(e.target.value)} />
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="smallMuted">右侧球员</div>
            <select className="input" value={rightPlayerId} onChange={(e) => setRightPlayerId(e.target.value)}>
              <option value="">请选择</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {samePlayer && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 900 }}>左右不能选同一个球员</div>}
        {!hasTwoPlayers && <div style={{ marginTop: 10, color: "var(--muted)" }}>需要至少 2 个球员才能记比赛。去“球员”页面添加。</div>}
      </div>

      <div className="card">
        <div className="scoreboard">
          <div className="card">
            <div className="smallMuted">Left</div>
            <div style={{ fontWeight: 1000, fontSize: 18, marginTop: 6 }}>{leftPlayer?.name ?? "—"}</div>
            <p className="bigScore">{leftScore}</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => bumpScore("left", -1)} disabled={disableScoreButtons}>
                -1
              </button>
              <button className="btn btnBrand" type="button" onClick={() => bumpScore("left", +1)} disabled={disableScoreButtons}>
                +1
              </button>
            </div>
          </div>

          <div className="card centerBox">
            <div className="badge">{matchName.trim() || "未命名比赛"}</div>
            <div className="badge">标签：{tagLabel(tag)}</div>
            <div className="badge">抢 {raceTo}</div>
            <div className="badge">放门：{isHandicap ? "是" : "否"}</div>

            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={resetScore} disabled={!hasTwoPlayers}>
                重置比分
              </button>
            </div>

            {winner && <div style={{ marginTop: 4, fontWeight: 1000 }}>当前胜者：{winner === "left" ? leftPlayer?.name : rightPlayer?.name}</div>}
          </div>

          <div className="card">
            <div className="smallMuted">Right</div>
            <div style={{ fontWeight: 1000, fontSize: 18, marginTop: 6 }}>{rightPlayer?.name ?? "—"}</div>
            <p className="bigScore">{rightScore}</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => bumpScore("right", -1)} disabled={disableScoreButtons}>
                -1
              </button>
              <button className="btn btnBrand" type="button" onClick={() => bumpScore("right", +1)} disabled={disableScoreButtons}>
                +1
              </button>
            </div>
          </div>
        </div>

        <div className="rowBetween" style={{ marginTop: 14 }}>
          <div className="badge">当前比分：{leftScore} : {rightScore}</div>

          <div className="row">
            <button className="btn" type="button" onClick={() => nav("/matches")}>
              取消
            </button>

            <button
              className="btn btnBrand"
              type="button"
              disabled={invalid}
              onClick={() => {
                try {
                  onSave();
                } catch (e) {
                  alert(e?.message ?? String(e));
                }
              }}
            >
              结束并保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
