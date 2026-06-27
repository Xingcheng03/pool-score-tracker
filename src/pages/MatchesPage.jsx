import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import ConfirmButton from "../components/ConfirmButton.jsx";
import { apiRequest, downloadJson, jsonBody } from "../lib/api.js";
import { cachedApiRequest, invalidatePoolDataCache } from "../lib/apiCache.js";
import { useT } from "../lib/i18n.jsx";

const MATCH_PAGE_SIZE = 50;

function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function playerName(playerMap, id) {
  return playerMap.get(id) ?? "Unknown";
}

function isDoublesMatch(match) {
  return match.matchType === "doubles";
}

function teamName(playerMap, match, side) {
  if (!isDoublesMatch(match)) {
    return playerName(playerMap, side === "left" ? match.leftPlayerId : match.rightPlayerId);
  }
  const p1 = side === "left" ? match.leftPlayerId : match.rightPlayerId;
  const p2 = side === "left" ? match.leftPlayer2Id : match.rightPlayer2Id;
  return `${playerName(playerMap, p1)} / ${playerName(playerMap, p2)}`;
}

function winnerName(playerMap, match) {
  if (!isDoublesMatch(match)) return playerName(playerMap, match.winnerId);
  return teamName(playerMap, match, match.leftScore > match.rightScore ? "left" : "right");
}

function todayName() {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `pool-data-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

export default function MatchesPage() {
  const { isAdmin } = useAuth();
  const t = useT();
  const importInputRef = useRef(null);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [tagFilter, setTagFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [dataBusy, setDataBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MATCH_PAGE_SIZE);

  const tagLabel = useCallback((tag) => (tag === "live" ? t("直播", "Live") : t("练习赛", "Practice")), [t]);
  const handicapDetail = useCallback((match, playerMap) => {
    if (!match.isHandicap) return "";
    return t(
      `${playerName(playerMap, match.handicapGiverId)} 给 ${playerName(playerMap, match.handicapReceiverId)} 放门`,
      `${playerName(playerMap, match.handicapGiverId)} gives handicap to ${playerName(playerMap, match.handicapReceiverId)}`,
    );
  }, [t]);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const tagQuery = tagFilter === "all" ? "" : `?tag=${tagFilter}`;
      const [matchResult, playerResult] = await Promise.all([
        cachedApiRequest(`/matches${tagQuery}`, { force }),
        cachedApiRequest("/players", { force }),
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

  useEffect(() => {
    setVisibleCount(MATCH_PAGE_SIZE);
  }, [tagFilter]);

  const playerMap = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players],
  );
  const visibleMatches = useMemo(
    () => matches.slice(0, visibleCount),
    [matches, visibleCount],
  );

  async function onDelete(matchId) {
    await apiRequest(`/matches/${matchId}`, { method: "DELETE" });
    invalidatePoolDataCache();
    await load(true);
  }

  async function exportJson() {
    setError("");
    setDataMessage("");
    setDataBusy(true);
    try {
      const payload = await apiRequest("/data/export");
      downloadJson(todayName(), payload);
      setDataMessage(t(
        `已导出 ${payload.players.length} 名球员、${payload.matches.length} 场正式比赛。`,
        `Exported ${payload.players.length} players and ${payload.matches.length} official matches.`,
      ));
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setDataBusy(false);
    }
  }

  async function importJson(file) {
    if (!file) return;
    setError("");
    setDataMessage("");
    setDataBusy(true);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await apiRequest("/data/import", {
        method: "POST",
        body: jsonBody(parsed),
      });
      setDataMessage(t(
        `导入完成：球员 ${result.importedPlayers}，比赛 ${result.importedMatches}，跳过 ${result.skippedMatches.length}。`,
        `Import done: ${result.importedPlayers} players, ${result.importedMatches} matches, ${result.skippedMatches.length} skipped.`,
      ));
      invalidatePoolDataCache();
      await load(true);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setDataBusy(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  return (
    <div className="space">
      <h1 className="h1">{t("比赛数据", "Matches")}</h1>

      <div className="card">
        <div className="rowBetween matchesToolbar" style={{ marginBottom: 12 }}>
          <div className="row matchesFilterRow" style={{ gap: 10, alignItems: "center" }}>
            <div className="badge">{t(`正式比赛数：${matches.length}`, `Official matches: ${matches.length}`)}</div>
            <button className={tagFilter === "all" ? "btn btnBrand" : "btn"} type="button" onClick={() => setTagFilter("all")}>
              {t("全部", "All")}
            </button>
            <button className={tagFilter === "practice" ? "btn btnBrand" : "btn"} type="button" onClick={() => setTagFilter("practice")}>
              {t("练习赛", "Practice")}
            </button>
            <button className={tagFilter === "live" ? "btn btnBrand" : "btn"} type="button" onClick={() => setTagFilter("live")}>
              {t("直播", "Live")}
            </button>
          </div>

          <div className="row matchesActionsRow">
            {isAdmin && (
              <>
                <button className="btn matchesDataButton" type="button" onClick={exportJson} disabled={dataBusy}>
                  {t("导出 JSON", "Export JSON")}
                </button>
                <button className="btn matchesDataButton" type="button" disabled={dataBusy} onClick={() => importInputRef.current?.click()}>
                  {t("导入 JSON", "Import JSON")}
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={(event) => importJson(event.target.files?.[0])}
                />
              </>
            )}
            <Link className="btn btnBrand matchesSubmitButton" to="/new">{t("上报比赛", "Submit Match")}</Link>
            <button className="btn matchesRefreshButton" onClick={() => load(true)} type="button">{t("刷新", "Refresh")}</button>
          </div>
        </div>

        {dataMessage && <div className="successBox" style={{ marginBottom: 12 }}>{dataMessage}</div>}
        {error && <div className="errorBox" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className="sub">{t("加载中...", "Loading...")}</div>
        ) : (
          <div className="tableWrap">
            <table className="matchesTable">
              <thead>
                <tr>
                  <th>{t("标签", "Tag")}</th>
                  <th>{t("比赛名称", "Match Name")}</th>
                  <th>{t("时间", "Time")}</th>
                  <th>{t("赛制", "Format")}</th>
                  <th>{t("左侧", "Left")}</th>
                  <th>{t("比分", "Score")}</th>
                  <th>{t("右侧", "Right")}</th>
                  <th>{t("胜者", "Winner")}</th>
                  <th>{t("放门", "Handicap")}</th>
                  {isAdmin && <th>{t("操作", "Action")}</th>}
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? "10" : "9"} style={{ color: "var(--muted)" }}>
                      {t("暂无正式比赛。", "No official matches yet.")}
                    </td>
                  </tr>
                ) : (
                  visibleMatches.map((match) => (
                    <tr key={match.id}>
                      <td style={{ fontWeight: 900 }}>{tagLabel(match.tag)}</td>
                      <td style={{ fontWeight: 900 }}>{match.matchName}</td>
                      <td>{fmtDate(match.dateISO)}</td>
                      <td>
                        {t(`抢 ${match.raceTo}`, `Race to ${match.raceTo}`)}
                        {isDoublesMatch(match) && <span className="badge" style={{ marginLeft: 6 }}>{t("双打", "Doubles")}</span>}
                      </td>
                      <td>{teamName(playerMap, match, "left")}</td>
                      <td>{match.leftScore} : {match.rightScore}</td>
                      <td>{teamName(playerMap, match, "right")}</td>
                      <td>{winnerName(playerMap, match)}</td>
                      <td className="matchHandicapCell">
                        <span className="matchHandicapValue">
                          <span className="matchHandicapStatus">{match.isHandicap ? t("是", "Yes") : t("否", "No")}</span>
                          {match.isHandicap && <span className="matchHandicapDetail">{handicapDetail(match, playerMap)}</span>}
                        </span>
                      </td>
                      {isAdmin && (
                        <td>
                          <ConfirmButton confirmText={t("确定删除这场正式比赛吗？", "Delete this official match?")} onConfirm={() => onDelete(match.id)}>
                            {t("删除", "Delete")}
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
        {!loading && matches.length > visibleMatches.length && (
          <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
            <button className="btn" type="button" onClick={() => setVisibleCount((count) => count + MATCH_PAGE_SIZE)}>
              {t(`加载更多 (${visibleMatches.length} / ${matches.length})`, `Load more (${visibleMatches.length} / ${matches.length})`)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
