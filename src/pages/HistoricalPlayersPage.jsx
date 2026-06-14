import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cachedApiRequest } from "../lib/apiCache.js";
import { useT, useTranslateTier } from "../lib/i18n.jsx";

function formatCount(value) {
  if (!Number.isFinite(Number(value))) return "0";
  const rounded = Math.round(Number(value) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}

function formatPercent(value) {
  return `${Math.round(Number(value ?? 0) * 1000) / 10}%`;
}

function formatDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

function StatRow({ label, value, strong = false }) {
  return (
    <div className="historyStatRow">
      <span className="historyStatLabel">{label}</span>
      <span className={`historyStatValue${strong ? " isStrong" : ""}`}>{value}</span>
    </div>
  );
}

function HistoryCard({ player }) {
  const t = useT();
  const translateTier = useTranslateTier();
  const [expanded, setExpanded] = useState(false);
  const s = player.stats;

  return (
    <div className="historyCard">
      <button
        type="button"
        className="historyCardHeader"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div style={{ minWidth: 0 }}>
          <div className="historyCardName">
            {player.name}
            {player.retirementNote && <span className="historyCardNote">“{player.retirementNote}”</span>}
          </div>
          <div className="historyCardSub">
            {t(`退役于 ${formatDay(player.retiredAt)}`, `Retired ${formatDay(player.retiredAt)}`)}
          </div>
        </div>
        <span className="historyCardChevron" aria-hidden="true">{expanded ? "▲" : "▼"}</span>
      </button>

      <div className={`historyCardBody${expanded ? "" : " isCollapsed"}`}>
        <div className="historyStatList">
          <StatRow label={t("历史最高 Rating", "Peak Rating")} value={s.peakRatingRounded} strong />
          <StatRow label={t("历史最高段位", "Peak Tier")} value={translateTier(s.peakTier)} strong />
          <StatRow label={t("场数", "Matches")} value={formatCount(s.matchCount)} />
          <StatRow label={t("胜", "Wins")} value={formatCount(s.wins)} />
          <StatRow label={t("负", "Losses")} value={formatCount(s.losses)} />
          <StatRow label={t("场胜率", "Match Win Rate")} value={formatPercent(s.winRate)} />
          <StatRow label={t("局数", "Racks")} value={formatCount(s.racks)} />
          <StatRow label={t("局胜率", "Rack Win Rate")} value={formatPercent(s.rackWinRate)} />
          <StatRow label={t("直播局胜率", "Live Rack Win Rate")} value={formatPercent(s.liveRackWinRate)} />
          <StatRow label={t("练习局胜率", "Practice Rack Win Rate")} value={formatPercent(s.pracRackWinRate)} />
          <StatRow
            label={t("耻辱柱", "Hall of Shame")}
            value={player.shameCount > 0 ? t(`上过 ${player.shameCount} 次`, `${player.shameCount}×`) : t("未上榜", "Never")}
          />
        </div>

        <div className="historyCardHighlights">
          <div className="historyHighlightsHead">{t("退役前高光时刻", "Career Highlights")}</div>
          {player.highlights.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>{t("未设置高光。", "No highlights set.")}</div>
          ) : (
            player.highlights.map((h) => {
              const resultLabel = h.result === "win" ? t("胜", "Win") : h.result === "loss" ? t("负", "Loss") : "-";
              return (
                <div key={h.id} className="historyHighlightItem">
                  <div className="historyHighlightName">{h.matchName ?? t("未命名比赛", "Untitled Match")}</div>
                  <div className="historyHighlightMeta">
                    {formatDay(h.dateISO)} · {h.tag === "live" ? t("直播", "Live") : t("练习赛", "Practice")} · {t("对手", "vs")} {h.opponentName} · {h.myScore}:{h.opponentScore} · {resultLabel}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Link className="btn" to={`/players/${player.id}`}>{t("查看完整数据", "View Full Stats")}</Link>
      </div>
    </div>
  );
}

export default function HistoricalPlayersPage() {
  const t = useT();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const result = await cachedApiRequest("/retired", { force });
      setPlayers(result.players ?? []);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="pageTitle">
        <div>
          <h2 style={{ margin: 0 }}>{t("历史球员", "Historical Players")}</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            {t(
              "离开了俱乐部，但战绩与高光永远留在这里。",
              "They left the club, but their records and highlights stay here forever.",
            )}
          </div>
        </div>
        <button className="btn" type="button" onClick={() => load(true)}>{t("刷新", "Refresh")}</button>
      </div>

      {error && <div className="errorBox" style={{ marginTop: 12 }}>{error}</div>}

      {loading ? (
        <div className="card" style={{ marginTop: 12 }}>{t("加载中...", "Loading...")}</div>
      ) : players.length === 0 ? (
        <div className="card" style={{ marginTop: 12, color: "var(--muted)" }}>
          {t("还没有退役球员。可在球员详情页将球员设为退役。", "No retired players yet. Retire a player from their detail page.")}
        </div>
      ) : (
        <div className="historyGrid">
          {players.map((player) => (
            <HistoryCard key={player.id} player={player} />
          ))}
        </div>
      )}
    </div>
  );
}
