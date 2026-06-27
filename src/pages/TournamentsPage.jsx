import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import ConfirmButton from "../components/ConfirmButton.jsx";
import { apiRequest, jsonBody } from "../lib/api.js";
import { invalidatePoolDataCache } from "../lib/apiCache.js";
import { useT } from "../lib/i18n.jsx";

function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

export default function TournamentsPage() {
  const { isAdmin } = useAuth();
  const t = useT();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [format, setFormat] = useState("singles");
  const [raceTo, setRaceTo] = useState(7);
  const [tag, setTag] = useState("practice");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/tournaments");
      setTournaments(result.tournaments);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function statusLabel(s) {
    if (s === "DRAFT") return t("筹备中", "Draft");
    if (s === "ONGOING") return t("进行中", "Ongoing");
    if (s === "FINISHED") return t("已结束", "Finished");
    return s;
  }

  function statusClass(s) {
    if (s === "ONGOING") return "tStatus tStatusOngoing";
    if (s === "FINISHED") return "tStatus tStatusFinished";
    return "tStatus tStatusDraft";
  }

  async function onCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await apiRequest("/tournaments", {
        method: "POST",
        body: jsonBody({ name: name.trim(), format, raceTo: Number(raceTo), tag }),
      });
      setName("");
      await load();
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id) {
    setError("");
    try {
      await apiRequest(`/tournaments/${id}`, { method: "DELETE" });
      invalidatePoolDataCache();
      await load();
    } catch (err) {
      setError(err?.message ?? String(err));
    }
  }

  return (
    <div className="space">
      <h1 className="h1">{t("比赛赛程", "Tournaments")}</h1>
      <p className="sub">{t(
        "单淘汰赛制对阵图。管理员创建赛事、抽签分组、录入比分；比分确认后自动计入街灯榜。",
        "Single-elimination brackets. Admins create events, draw groups, and enter scores; confirmed scores count toward the leaderboard.",
      )}</p>

      {error && <div className="errorBox" style={{ marginBottom: 12 }}>{error}</div>}

      {isAdmin && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="smallMuted" style={{ marginBottom: 8, fontWeight: 900 }}>{t("创建赛事", "Create Tournament")}</div>
          <form className="row" style={{ gap: 10, alignItems: "flex-end", flexWrap: "wrap" }} onSubmit={onCreate}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="smallMuted">{t("赛事名称", "Name")}</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div style={{ width: 160 }}>
              <div className="smallMuted">{t("赛制", "Format")}</div>
              <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="singles">{t("单打 1V1", "Singles 1V1")}</option>
                <option value="doubles">{t("双打 2V2", "Doubles 2V2")}</option>
              </select>
            </div>
            <div style={{ width: 120 }}>
              <div className="smallMuted">{t("抢几", "Race To")}</div>
              <input className="input" type="number" min="1" value={raceTo} onChange={(e) => setRaceTo(e.target.value)} />
            </div>
            <div style={{ width: 150 }}>
              <div className="smallMuted">{t("标签", "Tag")}</div>
              <select className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="practice">{t("练习赛", "Practice")}</option>
                <option value="live">{t("直播", "Live")}</option>
              </select>
            </div>
            <button className="btn btnBrand" type="submit" disabled={creating || !name.trim()}>
              {creating ? t("创建中...", "Creating...") : t("创建", "Create")}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card">{t("加载中...", "Loading...")}</div>
      ) : tournaments.length === 0 ? (
        <div className="card" style={{ color: "var(--muted)" }}>{t("暂无赛事。", "No tournaments yet.")}</div>
      ) : (
        <div className="tournamentGrid">
          {tournaments.map((tn) => (
            <div className="card tournamentCard" key={tn.id}>
              <div className="rowBetween" style={{ alignItems: "flex-start" }}>
                <Link to={`/tournaments/${tn.id}`} style={{ fontWeight: 1000, fontSize: 17 }}>{tn.name}</Link>
                <span className={statusClass(tn.status)}>{statusLabel(tn.status)}</span>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <span className="badge">{tn.format === "doubles" ? t("双打 2V2", "Doubles 2V2") : t("单打 1V1", "Singles 1V1")}</span>
                <span className="badge">{t(`抢 ${tn.raceTo}`, `Race to ${tn.raceTo}`)}</span>
                <span className="badge">{tn.tag === "live" ? t("直播", "Live") : t("练习赛", "Practice")}</span>
                <span className="badge">{t(`${tn.participantCount} 人`, `${tn.participantCount} players`)}</span>
              </div>
              <div className="rowBetween" style={{ marginTop: 12 }}>
                <span className="smallMuted">{fmtDate(tn.createdAt)}</span>
                <div className="row" style={{ gap: 8 }}>
                  <Link className="btn" to={`/tournaments/${tn.id}`}>{t("查看对阵", "View Bracket")}</Link>
                  {isAdmin && (
                    <ConfirmButton confirmText={t("确定删除该赛事吗？", "Delete this tournament?")} onConfirm={() => onDelete(tn.id)}>
                      {t("删除", "Delete")}
                    </ConfirmButton>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
