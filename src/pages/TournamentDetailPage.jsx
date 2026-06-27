import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { apiRequest, jsonBody } from "../lib/api.js";
import { cachedApiRequest, invalidatePoolDataCache } from "../lib/apiCache.js";
import { useT } from "../lib/i18n.jsx";

function teamNames(team) {
  const names = (team ?? []).map((p) => p?.name).filter(Boolean);
  return names;
}

function isPowerOfTwo(n) {
  return Number.isInteger(n) && n >= 1 && (n & (n - 1)) === 0;
}

export default function TournamentDetailPage() {
  const { tournamentId } = useParams();
  const { isAdmin } = useAuth();
  const t = useT();

  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState(null); // 点开的对阵节点弹窗
  const [scoreInput, setScoreInput] = useState({ left: 0, right: 0 });
  const [teamInput, setTeamInput] = useState({ a1: "", a2: "", b1: "", b2: "" });
  const [connectors, setConnectors] = useState([]); // 对阵连接线的 SVG path 列表

  const bracketRef = useRef(null);
  const nodeRefs = useRef(new Map());

  const load = useCallback(async () => {
    setError("");
    try {
      const [tResult, pResult] = await Promise.all([
        apiRequest(`/tournaments/${tournamentId}`),
        cachedApiRequest("/players"),
      ]);
      setTournament(tResult.tournament);
      setPlayers(pResult.players);
      setSelectedIds(new Set(tResult.tournament.participants.map((p) => p.player?.id).filter(Boolean)));
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  // 测量每个对阵节点的实际位置，画出连到下一轮比赛的折线（横→竖→横）。
  useLayoutEffect(() => {
    function compute() {
      const cont = bracketRef.current;
      if (!cont) { setConnectors([]); return; }
      const cRect = cont.getBoundingClientRect();
      const paths = [];
      for (const m of tournament?.matches ?? []) {
        if (!m.nextMatchId) continue;
        const childEl = nodeRefs.current.get(m.id);
        const parentEl = nodeRefs.current.get(m.nextMatchId);
        if (!childEl || !parentEl) continue;
        const r1 = childEl.getBoundingClientRect();
        const r2 = parentEl.getBoundingClientRect();
        const startX = r1.right - cRect.left;
        const startY = r1.top - cRect.top + r1.height / 2;
        const endX = r2.left - cRect.left;
        const endY = r2.top - cRect.top + r2.height / 2;
        const midX = startX + (endX - startX) / 2;
        paths.push(`M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`);
      }
      setConnectors(paths);
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [tournament]);

  const isDoubles = tournament?.format === "doubles";

  const participantPlayers = useMemo(() => {
    if (!tournament) return [];
    return tournament.participants.map((p) => p.player).filter(Boolean);
  }, [tournament]);

  const rounds = useMemo(() => {
    if (!tournament) return [];
    const byRound = new Map();
    for (const m of tournament.matches) {
      if (!byRound.has(m.round)) byRound.set(m.round, []);
      byRound.get(m.round).push(m);
    }
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, matches]) => ({ round, matches: matches.sort((x, y) => x.slotIndex - y.slotIndex) }));
  }, [tournament]);

  const maxRound = rounds.length ? rounds[rounds.length - 1].round : 0;

  function roundLabel(round) {
    const fromEnd = maxRound - round;
    if (fromEnd === 0) return t("决赛", "Final");
    if (fromEnd === 1) return t("半决赛", "Semifinal");
    if (fromEnd === 2) return t("四分之一决赛", "Quarterfinal");
    return t(`第 ${round} 轮`, `Round ${round}`);
  }

  const champion = useMemo(() => {
    if (!tournament || tournament.status !== "FINISHED" || !maxRound) return null;
    const finalMatch = tournament.matches.find((m) => m.round === maxRound);
    if (!finalMatch || !finalMatch.winnerSide) return null;
    return finalMatch.winnerSide === "A" ? finalMatch.teamA : finalMatch.teamB;
  }, [tournament, maxRound]);

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function draw(useSelection) {
    if (tournament.status !== "DRAFT" && !window.confirm(t("重新抽签会清空当前对阵图，确定吗？", "Re-drawing clears the current bracket. Continue?"))) return;
    setBusy(true); setError("");
    try {
      // 抽签时直接带上勾选的球员，无需单独"保存"。重新抽签(已有名单)则不带，沿用原名单洗牌。
      const body = useSelection ? { playerIds: [...selectedIds] } : {};
      await apiRequest(`/tournaments/${tournamentId}/draw`, { method: "POST", body: jsonBody(body) });
      setPickerOpen(false);
      await load();
    } catch (err) { setError(err?.message ?? String(err)); }
    finally { setBusy(false); }
  }

  function openMatch(m) {
    setActiveMatchId(m.id);
    setScoreInput({ left: m.leftScore ?? 0, right: m.rightScore ?? 0 });
    setTeamInput({
      a1: m.teamA?.[0]?.id ?? "", a2: m.teamA?.[1]?.id ?? "",
      b1: m.teamB?.[0]?.id ?? "", b2: m.teamB?.[1]?.id ?? "",
    });
  }

  function closeMatch() {
    setActiveMatchId(null);
  }

  function bumpScore(side, delta) {
    setScoreInput((s) => ({ ...s, [side]: Math.max(0, Number(s[side] || 0) + delta) }));
  }

  async function submitScore() {
    setBusy(true); setError("");
    try {
      await apiRequest(`/tournaments/matches/${activeMatchId}/score`, {
        method: "POST",
        body: jsonBody({ leftScore: Number(scoreInput.left), rightScore: Number(scoreInput.right) }),
      });
      // 赛程比分已入账影响街灯榜，刷掉本地比赛/榜单缓存，切到街灯榜立即可见。
      invalidatePoolDataCache();
      closeMatch();
      await load();
    } catch (err) { setError(err?.message ?? String(err)); }
    finally { setBusy(false); }
  }

  async function submitTeams() {
    setBusy(true); setError("");
    try {
      const body = { a1Id: teamInput.a1 || null, b1Id: teamInput.b1 || null };
      if (isDoubles) { body.a2Id = teamInput.a2 || null; body.b2Id = teamInput.b2 || null; }
      await apiRequest(`/tournaments/matches/${activeMatchId}/teams`, {
        method: "PATCH",
        body: jsonBody(body),
      });
      await load();
    } catch (err) { setError(err?.message ?? String(err)); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="card">{t("加载中...", "Loading...")}</div>;
  if (!tournament) return <div className="card">{error || t("赛事不存在。", "Tournament not found.")}</div>;

  const drawn = tournament.matches.length > 0;
  const activeMatch = activeMatchId ? tournament.matches.find((x) => x.id === activeMatchId) : null;

  // state: "win"(晋级=蓝) | "lose"(淘汰=灰) | "pending"(未决=默认)
  function renderTeam(team, state) {
    const names = teamNames(team);
    const label = names.length ? names.join(" / ") : t("待定", "TBD");
    const cls = state === "win" ? "tTeam tTeamWin" : state === "lose" ? "tTeam tTeamLose" : "tTeam";
    return <span className={cls}>{label}</span>;
  }

  function teamState(m, side) {
    if (m.status !== "DONE" || !m.winnerSide) return "pending";
    return m.winnerSide === side ? "win" : "lose";
  }

  function playerOptions(excludeIds = []) {
    const exclude = new Set(excludeIds.filter(Boolean));
    return participantPlayers.filter((p) => !exclude.has(p.id));
  }

  return (
    <div className="space">
      <div>
        <h1 className="h1" style={{ marginBottom: 8 }}>{tournament.name}</h1>
        <div className="rowBetween tHeadRow" style={{ alignItems: "center", gap: 8 }}>
          <div className="row tHeadBadges" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="badge">{isDoubles ? t("双打 2V2", "Doubles 2V2") : t("单打 1V1", "Singles 1V1")}</span>
            <span className="badge">{t(`抢 ${tournament.raceTo}`, `Race to ${tournament.raceTo}`)}</span>
            <span className="badge">{tournament.tag === "live" ? t("直播", "Live") : t("练习赛", "Practice")}</span>
          </div>
          <div className="row tHeadActions" style={{ gap: 8 }}>
            {isAdmin && tournament.status !== "DRAFT" && (
              <button className="btn btnBrand" type="button" disabled={busy} onClick={() => draw(false)}>{t("重新抽签", "Re-draw")}</button>
            )}
            <Link className="btn" to="/tournaments">{t("返回列表", "Back")}</Link>
          </div>
        </div>
      </div>

      {error && <div className="errorBox" style={{ marginTop: 12 }}>{error}</div>}

      {champion && (
        <div className="card tChampionCard" style={{ marginTop: 14 }}>
          <span className="badge">{t("🏆 冠军", "🏆 Champion")}</span>
          <span style={{ fontWeight: 1000, fontSize: 18 }}>{teamNames(champion).join(" / ")}</span>
        </div>
      )}

      {isAdmin && tournament.status === "DRAFT" && (() => {
        const selCount = selectedIds.size;
        const drawValid = isDoubles
          ? (selCount >= 4 && selCount % 2 === 0 && isPowerOfTwo(selCount / 2))
          : (selCount >= 2 && isPowerOfTwo(selCount));
        return (
          <div className="card" style={{ marginTop: 14 }}>
            <button type="button" className="tPickerHeader" onClick={() => setPickerOpen((o) => !o)}>
              <span style={{ fontWeight: 900 }}>
                {t("选择参赛球员", "Select participants")}
                <span className="badge" style={{ marginLeft: 8 }}>{t(`已选 ${selCount}`, `${selCount} selected`)}</span>
              </span>
              <span className="tPickerChevron">{pickerOpen ? "▲" : "▼"}</span>
            </button>

            {pickerOpen && (
              <div className="tParticipantGrid" style={{ marginTop: 12 }}>
                {players.filter((p) => !p.retired && !p.hidden).map((p) => (
                  <label key={p.id} className={selectedIds.has(p.id) ? "tParticipantChip tParticipantChipOn" : "tParticipantChip"}>
                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} style={{ marginRight: 6 }} />
                    {p.name}
                  </label>
                ))}
              </div>
            )}

            <div className="rowBetween" style={{ gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span className="smallMuted" style={{ color: "var(--warning)", flex: 1, minWidth: 0 }}>
                {!drawValid && (isDoubles
                  ? t("双打人数需为 4 / 8 / 16 / 32（队伍数为 2 的幂）", "Doubles needs 4 / 8 / 16 / 32 players (team count a power of 2)")
                  : t("单打人数需为 2 / 4 / 8 / 16 / 32（2 的幂）", "Singles needs 2 / 4 / 8 / 16 / 32 players (a power of 2)"))}
              </span>
              <button className="btn btnBrand" type="button" disabled={busy || !drawValid} onClick={() => draw(true)}>
                {t("随机抽签生成对阵", "Draw bracket")}
              </button>
            </div>
          </div>
        );
      })()}

      {!drawn ? (
        <div className="card" style={{ marginTop: 14, color: "var(--muted)" }}>
          {t("尚未抽签。", "Bracket not drawn yet.")}
        </div>
      ) : (
        <div className="bracketScroll" style={{ marginTop: 14 }}>
          <div className="bracket" ref={bracketRef}>
            <svg className="bracketLines" aria-hidden="true">
              {connectors.map((d, i) => <path key={i} d={d} />)}
            </svg>
            {rounds.map(({ round, matches }) => (
              <div className="bracketRound" key={round}>
                <div className="bracketRoundTitle">{roundLabel(round)}</div>
                <div className="bracketRoundBody">
                  {matches.map((m) => (
                    <div
                      className={`bracketNode bracketNodeClickable${m.status === "DONE" ? " bracketNodeDone" : ""}`}
                      key={m.id}
                      ref={(el) => { if (el) nodeRefs.current.set(m.id, el); else nodeRefs.current.delete(m.id); }}
                      role="button"
                      tabIndex={0}
                      onClick={() => openMatch(m)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openMatch(m); }}
                    >
                      <div className="bracketRow">
                        {renderTeam(m.teamA, teamState(m, "A"))}
                        <span className="bracketScore">{m.status === "DONE" ? m.leftScore : ""}</span>
                      </div>
                      <div className="bracketRow">
                        {renderTeam(m.teamB, teamState(m, "B"))}
                        <span className="bracketScore">{m.status === "DONE" ? m.rightScore : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeMatch && (() => {
        const m = activeMatch;
        const done = m.status === "DONE";
        const bothReady = teamNames(m.teamA).length && teamNames(m.teamB).length;
        const canScore = isAdmin && !done && bothReady;
        return (
          <div className="tModalOverlay" onClick={closeMatch}>
            <div className="tModal card" onClick={(e) => e.stopPropagation()}>
              <div className="rowBetween" style={{ marginBottom: 12 }}>
                <span className="badge">{roundLabel(m.round)}</span>
                <button className="btn" type="button" onClick={closeMatch}>{t("关闭", "Close")}</button>
              </div>

              <div className="tModalMatch">
                <div className="bracketRow">
                  {renderTeam(m.teamA, teamState(m, "A"))}
                  <span className="bracketScore">{done ? m.leftScore : ""}</span>
                </div>
                <div className="bracketRow">
                  {renderTeam(m.teamB, teamState(m, "B"))}
                  <span className="bracketScore">{done ? m.rightScore : ""}</span>
                </div>
              </div>

              {done && <div className="smallMuted" style={{ marginTop: 10 }}>{t("本场已结束。", "This match is finished.")}</div>}

              {isAdmin && !done && (
                <>
                  {canScore ? (
                    <div className="tModalSection">
                      <div className="smallMuted" style={{ fontWeight: 900, marginBottom: 8 }}>{t("录入比分", "Enter score")}</div>
                      <div className="bracketRow">
                        {renderTeam(m.teamA, "pending")}
                        <div className="stepper">
                          <button className="btn stepperBtn" type="button" aria-label={t("减少", "Decrease")} onClick={() => bumpScore("left", -1)}>−</button>
                          <div className="stepperValue">{scoreInput.left}</div>
                          <button className="btn stepperBtn" type="button" aria-label={t("增加", "Increase")} onClick={() => bumpScore("left", +1)}>＋</button>
                        </div>
                      </div>
                      <div className="bracketRow">
                        {renderTeam(m.teamB, "pending")}
                        <div className="stepper">
                          <button className="btn stepperBtn" type="button" aria-label={t("减少", "Decrease")} onClick={() => bumpScore("right", -1)}>−</button>
                          <div className="stepperValue">{scoreInput.right}</div>
                          <button className="btn stepperBtn" type="button" aria-label={t("增加", "Increase")} onClick={() => bumpScore("right", +1)}>＋</button>
                        </div>
                      </div>
                      <button className="btn btnBrand" type="button" style={{ marginTop: 12 }} disabled={busy} onClick={submitScore}>
                        {t("确认比分并入账", "Confirm score")}
                      </button>
                    </div>
                  ) : (
                    <div className="smallMuted" style={{ marginTop: 10 }}>{t("两队就位后才能录入比分。", "Both teams must be set before scoring.")}</div>
                  )}

                  <div className="tModalSection">
                    <div className="smallMuted" style={{ fontWeight: 900, marginBottom: 8 }}>{t("调整球员", "Edit players")}</div>
                    <div className="bracketTeamEdit">
                      <select className="input" value={teamInput.a1} onChange={(e) => setTeamInput((s) => ({ ...s, a1: e.target.value }))}>
                        <option value="">{t("A 队队员1", "A1")}</option>
                        {playerOptions([teamInput.a2, teamInput.b1, teamInput.b2]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {isDoubles && (
                        <select className="input" value={teamInput.a2} onChange={(e) => setTeamInput((s) => ({ ...s, a2: e.target.value }))}>
                          <option value="">{t("A 队队员2", "A2")}</option>
                          {playerOptions([teamInput.a1, teamInput.b1, teamInput.b2]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                      <select className="input" value={teamInput.b1} onChange={(e) => setTeamInput((s) => ({ ...s, b1: e.target.value }))}>
                        <option value="">{t("B 队队员1", "B1")}</option>
                        {playerOptions([teamInput.a1, teamInput.a2, teamInput.b2]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {isDoubles && (
                        <select className="input" value={teamInput.b2} onChange={(e) => setTeamInput((s) => ({ ...s, b2: e.target.value }))}>
                          <option value="">{t("B 队队员2", "B2")}</option>
                          {playerOptions([teamInput.a1, teamInput.a2, teamInput.b1]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                      <button className="btn" type="button" disabled={busy} onClick={submitTeams}>{t("保存球员", "Save players")}</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
