import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { apiRequest, jsonBody } from "../lib/api.js";
import { cachedApiRequest, invalidateApiCache } from "../lib/apiCache.js";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLocalDateTimeInput(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function defaultMatchName(tag, leftName, rightName) {
  const prefix = tag === "live" ? "直播" : "练习赛";
  const left = (leftName ?? "").trim() || "左侧球员";
  const right = (rightName ?? "").trim() || "右侧球员";
  return `${prefix} ${left} VS ${right}`;
}

export default function NewMatchPage() {
  const nav = useNavigate();
  const { user, isAdmin } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [tag, setTag] = useState("practice");
  const [matchName, setMatchName] = useState(() => defaultMatchName("practice"));
  const [isMatchNameAuto, setIsMatchNameAuto] = useState(true);
  const [raceTo, setRaceTo] = useState(7);
  const [leftPlayerId, setLeftPlayerId] = useState("");
  const [rightPlayerId, setRightPlayerId] = useState("");
  const [leftScore, setLeftScore] = useState(0);
  const [rightScore, setRightScore] = useState(0);
  const [matchDateTimeLocal, setMatchDateTimeLocal] = useState(() => formatLocalDateTimeInput(new Date()));
  const [isHandicap, setIsHandicap] = useState(false);
  const [handicapGiverSide, setHandicapGiverSide] = useState("left");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const result = await cachedApiRequest("/players");
        setPlayers(result.players);
      } catch (err) {
        setError(err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const leftPlayer = players.find((p) => p.id === leftPlayerId);
  const rightPlayer = players.find((p) => p.id === rightPlayerId);
  const ownPlayerId = !isAdmin ? user?.player?.id : "";
  const ownPlayerName = !isAdmin ? user?.player?.name : "";
  const isPlayerLockedToLeft = Boolean(ownPlayerId);

  useEffect(() => {
    if (!ownPlayerId || leftPlayerId) return;

    const ownPlayer = players.find((p) => p.id === ownPlayerId);
    const leftName = ownPlayer?.name ?? ownPlayerName;
    if (!leftName) return;

    setLeftPlayerId(ownPlayerId);
    if (isMatchNameAuto) {
      setMatchName(defaultMatchName(tag, leftName, rightPlayer?.name));
    }
  }, [isMatchNameAuto, leftPlayerId, ownPlayerId, ownPlayerName, players, rightPlayer?.name, tag]);

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

  function bumpScore(side, delta) {
    if (side === "left") setLeftScore((score) => Math.max(0, score + delta));
    else setRightScore((score) => Math.max(0, score + delta));
  }

  function onChangeTag(value) {
    setTag(value);
    if (isMatchNameAuto) setMatchName(defaultMatchName(value, leftPlayer?.name, rightPlayer?.name));
  }

  function onChangeLeftPlayer(playerId) {
    setLeftPlayerId(playerId);
    if (isMatchNameAuto) {
      const leftName = players.find((p) => p.id === playerId)?.name;
      setMatchName(defaultMatchName(tag, leftName, rightPlayer?.name));
    }
  }

  function onChangeRightPlayer(playerId) {
    setRightPlayerId(playerId);
    if (isMatchNameAuto) {
      const rightName = players.find((p) => p.id === playerId)?.name;
      setMatchName(defaultMatchName(tag, leftPlayer?.name, rightName));
    }
  }

  async function onSave() {
    setSaving(true);
    setError("");

    try {
      const handicapGiverId = isHandicap ? (handicapGiverSide === "left" ? leftPlayerId : rightPlayerId) : null;
      const handicapReceiverId = isHandicap ? (handicapGiverSide === "left" ? rightPlayerId : leftPlayerId) : null;

      await apiRequest("/match-reports", {
        method: "POST",
        body: jsonBody({
          matchName: matchName.trim(),
          dateISO: new Date(matchDateTimeLocal).toISOString(),
          raceTo,
          tag,
          leftPlayerId,
          rightPlayerId,
          leftScore,
          rightScore,
          isHandicap,
          handicapGiverId,
          handicapReceiverId,
        }),
      });

      invalidateApiCache(["/match-reports"]);
      alert("比赛分数已上报，等待管理员审核。");
      nav("/matches");
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card">加载球员中...</div>;

  return (
    <div>
      <h1 className="h1">上报比赛</h1>
      <p className="sub">球员提交的比分会进入待审核队列，管理员通过后才会写入正式比赛记录并影响排行榜。</p>

      {error && <div className="errorBox" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="smallMuted">比赛名称</div>
            <input
              className="input"
              value={matchName}
              onChange={(e) => {
                setIsMatchNameAuto(false);
                setMatchName(e.target.value);
              }}
            />
          </div>
        </div>

        <div className="row" style={{ gap: 12, alignItems: "center", marginBottom: 12 }}>
          <label className="row" style={{ gap: 8, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={isHandicap} onChange={(e) => setIsHandicap(e.target.checked)} />
            <span style={{ fontWeight: 900 }}>放门</span>
          </label>
          <div className="badge" style={{ marginLeft: "auto" }}>
            {isHandicap ? "开启：按现有放门折算逻辑计算" : "未开启"}
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
          </div>
        )}

        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="matchField matchLeftField" style={{ flex: 1, minWidth: 220 }}>
            <div className="smallMuted">左侧球员</div>
            <select className="input" value={leftPlayerId} onChange={(e) => onChangeLeftPlayer(e.target.value)} disabled={isPlayerLockedToLeft}>
              <option value="">请选择</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="matchField matchRaceField" style={{ width: 140, minWidth: 140 }}>
            <div className="smallMuted">抢几</div>
            <input className="input" type="number" min="1" value={raceTo} onChange={(e) => setRaceTo(Number(e.target.value))} />
          </div>

          <div className="matchField matchTagField" style={{ width: 200, minWidth: 200 }}>
            <div className="smallMuted">标签</div>
            <select className="input" value={tag} onChange={(e) => onChangeTag(e.target.value)}>
              <option value="practice">练习赛</option>
              <option value="live">直播</option>
            </select>
          </div>

          <div className="matchField matchTimeField" style={{ width: 240, minWidth: 240 }}>
            <div className="smallMuted">比赛时间</div>
            <input className="input" type="datetime-local" value={matchDateTimeLocal} onChange={(e) => setMatchDateTimeLocal(e.target.value)} />
          </div>

          <div className="matchField matchRightField" style={{ flex: 1, minWidth: 220 }}>
            <div className="smallMuted">右侧球员</div>
            <select className="input" value={rightPlayerId} onChange={(e) => onChangeRightPlayer(e.target.value)}>
              <option value="">请选择</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {samePlayer && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 900 }}>左右不能选择同一个球员。</div>}
        {!hasTwoPlayers && <div style={{ marginTop: 10, color: "var(--muted)" }}>需要至少 2 个球员才能上报比赛。</div>}
      </div>

      <div className="card">
        <div className="scoreboard">
          <div className="card">
            <div className="smallMuted">Left</div>
            <div style={{ fontWeight: 1000, fontSize: 18, marginTop: 6 }}>{leftPlayer?.name ?? "-"}</div>
            <p className="bigScore">{leftScore}</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => bumpScore("left", -1)} disabled={disableScoreButtons}>-1</button>
              <button className="btn btnBrand" type="button" onClick={() => bumpScore("left", +1)} disabled={disableScoreButtons}>+1</button>
            </div>
          </div>

          <div className="card centerBox">
            <div className="badge">{matchName.trim() || "未命名比赛"}</div>
            <div className="badge">标签：{tag === "live" ? "直播" : "练习赛"}</div>
            <div className="badge">抢 {raceTo}</div>
            <div className="badge">放门：{isHandicap ? "是" : "否"}</div>
            <button className="btn" type="button" onClick={() => { setLeftScore(0); setRightScore(0); }} disabled={!hasTwoPlayers}>重置比分</button>
            {winner && <div style={{ marginTop: 4, fontWeight: 1000 }}>当前胜者：{winner === "left" ? leftPlayer?.name : rightPlayer?.name}</div>}
          </div>

          <div className="card">
            <div className="smallMuted">Right</div>
            <div style={{ fontWeight: 1000, fontSize: 18, marginTop: 6 }}>{rightPlayer?.name ?? "-"}</div>
            <p className="bigScore">{rightScore}</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => bumpScore("right", -1)} disabled={disableScoreButtons}>-1</button>
              <button className="btn btnBrand" type="button" onClick={() => bumpScore("right", +1)} disabled={disableScoreButtons}>+1</button>
            </div>
          </div>
        </div>

        <div className="rowBetween" style={{ marginTop: 14 }}>
          <div className="badge">当前比分：{leftScore} : {rightScore}</div>
          <div className="row">
            <button className="btn" type="button" onClick={() => nav("/matches")}>取消</button>
            <button className="btn btnBrand" type="button" disabled={invalid || saving} onClick={onSave}>
              {saving ? "上报中..." : "提交审核"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
