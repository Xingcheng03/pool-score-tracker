import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { apiRequest, jsonBody } from "../lib/api.js";
import { cachedApiRequest, invalidateApiCache, invalidatePoolDataCache } from "../lib/apiCache.js";
import { useT } from "../lib/i18n.jsx";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLocalDateTimeInput(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function defaultSinglesName(tag, leftName, rightName) {
  const prefix = tag === "live" ? "直播" : "练习赛";
  const left = (leftName ?? "").trim() || "左侧球员";
  const right = (rightName ?? "").trim() || "右侧球员";
  return `${prefix} ${left} VS ${right}`;
}

function defaultDoublesName(tag, a1, a2, b1, b2) {
  const prefix = tag === "live" ? "直播双打" : "双打练习赛";
  const teamA = `${(a1 ?? "").trim() || "A1"}/${(a2 ?? "").trim() || "A2"}`;
  const teamB = `${(b1 ?? "").trim() || "B1"}/${(b2 ?? "").trim() || "B2"}`;
  return `${prefix} ${teamA} VS ${teamB}`;
}

export default function NewMatchPage() {
  const nav = useNavigate();
  const { user, isAdmin } = useAuth();
  const t = useT();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [matchType, setMatchType] = useState("singles"); // singles | doubles
  const [tag, setTag] = useState("practice");
  const [matchName, setMatchName] = useState(() => defaultSinglesName("practice"));
  const [isMatchNameAuto, setIsMatchNameAuto] = useState(true);
  const [raceTo, setRaceTo] = useState(7);
  const [leftPlayerId, setLeftPlayerId] = useState("");
  const [rightPlayerId, setRightPlayerId] = useState("");
  const [leftPlayer2Id, setLeftPlayer2Id] = useState("");
  const [rightPlayer2Id, setRightPlayer2Id] = useState("");
  const [leftScore, setLeftScore] = useState(0);
  const [rightScore, setRightScore] = useState(0);
  const [matchDateTimeLocal, setMatchDateTimeLocal] = useState(() => formatLocalDateTimeInput(new Date()));
  const [isHandicap, setIsHandicap] = useState(false);
  const [handicapGiverSide, setHandicapGiverSide] = useState("left");
  const [saving, setSaving] = useState(false);

  const isDoubles = matchType === "doubles";

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

  const nameOf = (id) => players.find((p) => p.id === id)?.name;
  const leftPlayer = players.find((p) => p.id === leftPlayerId);
  const rightPlayer = players.find((p) => p.id === rightPlayerId);
  const ownPlayerId = !isAdmin ? user?.player?.id : "";
  const isPlayerLockedToLeft = Boolean(ownPlayerId);

  // 非管理员锁定为左侧(A队)队长。
  useEffect(() => {
    if (!ownPlayerId || leftPlayerId) return;
    if (!players.some((p) => p.id === ownPlayerId)) return;
    setLeftPlayerId(ownPlayerId);
  }, [leftPlayerId, ownPlayerId, players]);

  // 自动命名集中处理：单打 / 双打 / 切换标签或球员时统一刷新。
  useEffect(() => {
    if (!isMatchNameAuto) return;
    if (isDoubles) {
      setMatchName(defaultDoublesName(tag, nameOf(leftPlayerId), nameOf(leftPlayer2Id), nameOf(rightPlayerId), nameOf(rightPlayer2Id)));
    } else {
      setMatchName(defaultSinglesName(tag, nameOf(leftPlayerId), nameOf(rightPlayerId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMatchNameAuto, isDoubles, tag, leftPlayerId, rightPlayerId, leftPlayer2Id, rightPlayer2Id, players]);

  const minPlayers = isDoubles ? 4 : 2;
  const hasEnoughPlayers = players.length >= minPlayers;

  const singlesIds = [leftPlayerId, rightPlayerId];
  const doublesIds = [leftPlayerId, leftPlayer2Id, rightPlayerId, rightPlayer2Id];
  const activeIds = isDoubles ? doublesIds : singlesIds;
  const allSelected = activeIds.every(Boolean);
  const selectedFilled = activeIds.filter(Boolean);
  const hasDuplicate = new Set(selectedFilled).size !== selectedFilled.length;

  const scoreTie = leftScore === rightScore;
  const hasWinner = leftScore >= raceTo || rightScore >= raceTo;
  const winnerSide = hasWinner && leftScore >= raceTo ? "left" : hasWinner && rightScore >= raceTo ? "right" : null;
  const disableScoreButtons = !hasEnoughPlayers || !allSelected || hasDuplicate;
  const invalid =
    !hasEnoughPlayers ||
    !matchName.trim() ||
    !allSelected ||
    hasDuplicate ||
    !matchDateTimeLocal ||
    !tag ||
    raceTo <= 0 ||
    Number.isNaN(Number(raceTo)) ||
    scoreTie;

  function bumpScore(side, delta) {
    if (side === "left") setLeftScore((score) => Math.max(0, score + delta));
    else setRightScore((score) => Math.max(0, score + delta));
  }

  // 球员下拉：排除已在其它槽位选中的人（保证 4 人互不相同）。
  function optionsExcluding(...excludeIds) {
    const exclude = new Set(excludeIds.filter(Boolean));
    return players.filter((p) => !exclude.has(p.id));
  }

  const teamAName = isDoubles
    ? `${nameOf(leftPlayerId) ?? "A1"} / ${nameOf(leftPlayer2Id) ?? "A2"}`
    : (leftPlayer?.name ?? "-");
  const teamBName = isDoubles
    ? `${nameOf(rightPlayerId) ?? "B1"} / ${nameOf(rightPlayer2Id) ?? "B2"}`
    : (rightPlayer?.name ?? "-");

  async function onSave() {
    setSaving(true);
    setError("");

    try {
      const payload = {
        matchName: matchName.trim(),
        dateISO: new Date(matchDateTimeLocal).toISOString(),
        raceTo,
        tag,
        matchType,
        leftPlayerId,
        rightPlayerId,
        leftScore,
        rightScore,
      };

      if (isDoubles) {
        payload.leftPlayer2Id = leftPlayer2Id;
        payload.rightPlayer2Id = rightPlayer2Id;
      } else {
        payload.isHandicap = isHandicap;
        payload.handicapGiverId = isHandicap ? (handicapGiverSide === "left" ? leftPlayerId : rightPlayerId) : null;
        payload.handicapReceiverId = isHandicap ? (handicapGiverSide === "left" ? rightPlayerId : leftPlayerId) : null;
      }

      await apiRequest("/match-reports", { method: "POST", body: jsonBody(payload) });

      invalidateApiCache(["/match-reports"]);
      if (isAdmin) invalidatePoolDataCache();
      alert(isAdmin
        ? t("比赛已记录并计入街灯榜。", "Match recorded and counted toward the leaderboard.")
        : t("比赛分数已上报，等待管理员审核。", "Match score submitted, awaiting admin review."));
      nav("/matches");
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card">{t("加载球员中...", "Loading players...")}</div>;

  return (
    <div>
      <h1 className="h1">{t("上报比赛", "Submit Match")}</h1>
      <p className="sub">{isAdmin
        ? t("管理员上报无需审核，提交后立即计入正式记录与街灯榜。", "Admin submissions skip review and count immediately.")
        : t(
            "球员提交的比分会进入待审核队列，管理员通过后才会写入正式比赛记录并影响排行榜。",
            "Player-submitted scores enter a review queue; only after admin approval do they become official matches and affect the leaderboard.",
          )}</p>

      {error && <div className="errorBox" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <button
            className={!isDoubles ? "btn btnBrand" : "btn"}
            type="button"
            onClick={() => { setMatchType("singles"); setLeftScore(0); setRightScore(0); }}
          >{t("单打", "Singles")}</button>
          <button
            className={isDoubles ? "btn btnBrand" : "btn"}
            type="button"
            onClick={() => { setMatchType("doubles"); setIsHandicap(false); setLeftScore(0); setRightScore(0); }}
          >{t("双打 2V2", "Doubles 2V2")}</button>
        </div>

        <div className="row" style={{ marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="smallMuted">{t("比赛名称", "Match Name")}</div>
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

        {!isDoubles && (
          <>
            <div className="row" style={{ gap: 12, alignItems: "center", marginBottom: 12 }}>
              <label className="row" style={{ gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={isHandicap} onChange={(e) => setIsHandicap(e.target.checked)} />
                <span style={{ fontWeight: 900 }}>{t("放门", "Handicap")}</span>
              </label>
              <div className="badge" style={{ marginLeft: "auto" }}>
                {isHandicap ? t("开启：按现有放门折算逻辑计算", "On: uses handicap weighting") : t("未开启", "Off")}
              </div>
            </div>

            {isHandicap && (
              <div className="row" style={{ gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 320 }}>
                  <div className="smallMuted">{t("谁给谁放门", "Who gives the handicap")}</div>
                  <select className="input" value={handicapGiverSide} onChange={(e) => setHandicapGiverSide(e.target.value)} disabled={!allSelected || hasDuplicate}>
                    <option value="left">{t(
                      `${leftPlayer?.name ?? "左侧"} 给 ${rightPlayer?.name ?? "右侧"} 放门`,
                      `${leftPlayer?.name ?? "Left"} gives handicap to ${rightPlayer?.name ?? "Right"}`,
                    )}</option>
                    <option value="right">{t(
                      `${rightPlayer?.name ?? "右侧"} 给 ${leftPlayer?.name ?? "左侧"} 放门`,
                      `${rightPlayer?.name ?? "Right"} gives handicap to ${leftPlayer?.name ?? "Left"}`,
                    )}</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}

        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="matchField matchLeftField" style={{ flex: 1, minWidth: 220 }}>
            <div className="smallMuted">{isDoubles ? t("A 队队员 1", "Team A Player 1") : t("左侧球员", "Left Player")}</div>
            <select className="input" value={leftPlayerId} onChange={(e) => setLeftPlayerId(e.target.value)} disabled={isPlayerLockedToLeft}>
              <option value="">{t("请选择", "Please select")}</option>
              {optionsExcluding(leftPlayer2Id, rightPlayerId, rightPlayer2Id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {isDoubles && (
              <>
                <div className="smallMuted" style={{ marginTop: 8 }}>{t("A 队队员 2", "Team A Player 2")}</div>
                <select className="input" value={leftPlayer2Id} onChange={(e) => setLeftPlayer2Id(e.target.value)}>
                  <option value="">{t("请选择", "Please select")}</option>
                  {optionsExcluding(leftPlayerId, rightPlayerId, rightPlayer2Id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </>
            )}
          </div>

          <div className="matchField matchRaceField" style={{ width: 140, minWidth: 140 }}>
            <div className="smallMuted">{t("抢几", "Race To")}</div>
            <div className="stepper">
              <button className="btn stepperBtn" type="button" onClick={() => setRaceTo((v) => Math.max(1, Number(v) - 1))} aria-label={t("减少", "Decrease")}>−</button>
              <div className="stepperValue">{raceTo}</div>
              <button className="btn stepperBtn" type="button" onClick={() => setRaceTo((v) => Number(v) + 1)} aria-label={t("增加", "Increase")}>＋</button>
            </div>
          </div>

          <div className="matchField matchTagField" style={{ width: 200, minWidth: 200 }}>
            <div className="smallMuted">{t("标签", "Tag")}</div>
            <select className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="practice">{t("练习赛", "Practice")}</option>
              <option value="live">{t("直播", "Live")}</option>
            </select>
          </div>

          <div className="matchField matchTimeField" style={{ width: 240, minWidth: 240 }}>
            <div className="smallMuted">{t("比赛时间", "Match Time")}</div>
            <input className="input" type="datetime-local" value={matchDateTimeLocal} onChange={(e) => setMatchDateTimeLocal(e.target.value)} />
          </div>

          <div className="matchField matchRightField" style={{ flex: 1, minWidth: 220 }}>
            <div className="smallMuted">{isDoubles ? t("B 队队员 1", "Team B Player 1") : t("右侧球员", "Right Player")}</div>
            <select className="input" value={rightPlayerId} onChange={(e) => setRightPlayerId(e.target.value)}>
              <option value="">{t("请选择", "Please select")}</option>
              {optionsExcluding(leftPlayerId, leftPlayer2Id, rightPlayer2Id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {isDoubles && (
              <>
                <div className="smallMuted" style={{ marginTop: 8 }}>{t("B 队队员 2", "Team B Player 2")}</div>
                <select className="input" value={rightPlayer2Id} onChange={(e) => setRightPlayer2Id(e.target.value)}>
                  <option value="">{t("请选择", "Please select")}</option>
                  {optionsExcluding(leftPlayerId, leftPlayer2Id, rightPlayerId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        {hasDuplicate && <div style={{ marginTop: 10, color: "var(--danger)", fontWeight: 900 }}>{t("同一个球员不能重复选择。", "A player cannot be selected more than once.")}</div>}
        {!hasEnoughPlayers && <div style={{ marginTop: 10, color: "var(--muted)" }}>{t(`需要至少 ${minPlayers} 个球员才能上报${isDoubles ? "双打" : ""}比赛。`, `Need at least ${minPlayers} players to submit this match.`)}</div>}
      </div>

      <div className="card">
        <div className="scoreboard">
          <div className="card">
            <div className="smallMuted">{isDoubles ? t("A 队", "Team A") : "Left"}</div>
            <div style={{ fontWeight: 1000, fontSize: 18, marginTop: 6 }}>{teamAName}</div>
            <p className="bigScore">{leftScore}</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => bumpScore("left", -1)} disabled={disableScoreButtons}>-1</button>
              <button className="btn btnBrand" type="button" onClick={() => bumpScore("left", +1)} disabled={disableScoreButtons}>+1</button>
            </div>
          </div>

          <div className="card centerBox">
            <div className="badge">{matchName.trim() || t("未命名比赛", "Untitled Match")}</div>
            <div className="badge">{isDoubles ? t("双打 2V2", "Doubles 2V2") : t("单打", "Singles")}</div>
            <div className="badge">{t("标签", "Tag")}: {tag === "live" ? t("直播", "Live") : t("练习赛", "Practice")}</div>
            <div className="badge">{t(`抢 ${raceTo}`, `Race to ${raceTo}`)}</div>
            {!isDoubles && <div className="badge">{t("放门", "Handicap")}: {isHandicap ? t("是", "Yes") : t("否", "No")}</div>}
            <button className="btn" type="button" onClick={() => { setLeftScore(0); setRightScore(0); }} disabled={!hasEnoughPlayers}>{t("重置比分", "Reset Score")}</button>
            {winnerSide && <div style={{ marginTop: 4, fontWeight: 1000 }}>{t("当前胜者", "Current Winner")}: {winnerSide === "left" ? teamAName : teamBName}</div>}
          </div>

          <div className="card">
            <div className="smallMuted">{isDoubles ? t("B 队", "Team B") : "Right"}</div>
            <div style={{ fontWeight: 1000, fontSize: 18, marginTop: 6 }}>{teamBName}</div>
            <p className="bigScore">{rightScore}</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" type="button" onClick={() => bumpScore("right", -1)} disabled={disableScoreButtons}>-1</button>
              <button className="btn btnBrand" type="button" onClick={() => bumpScore("right", +1)} disabled={disableScoreButtons}>+1</button>
            </div>
          </div>
        </div>

        <div className="rowBetween" style={{ marginTop: 14 }}>
          <div className="badge">{t("当前比分", "Current Score")}: {leftScore} : {rightScore}</div>
          <div className="row">
            <button className="btn" type="button" onClick={() => nav("/matches")}>{t("取消", "Cancel")}</button>
            <button className="btn btnBrand" type="button" disabled={invalid || saving} onClick={onSave}>
              {saving
                ? t("上报中...", "Submitting...")
                : isAdmin ? t("提交并入账", "Submit & Record") : t("提交审核", "Submit for Review")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
