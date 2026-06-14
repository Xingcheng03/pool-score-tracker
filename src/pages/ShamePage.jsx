import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import { apiRequest, jsonBody } from "../lib/api.js";
import { cachedApiRequest, invalidateApiCache } from "../lib/apiCache.js";
import { useT } from "../lib/i18n.jsx";

const MIN_PINS = 5;

function pad2(n) {
  return String(n).padStart(2, "0");
}

// ISO -> "YYYY-MM-DD"（按本地时区取日）
function fmtDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// "YYYY-MM-DD" -> ISO（固定本地正午，避免跨时区掉到前一天）
function dayInputToISO(dayValue) {
  return new Date(`${dayValue}T12:00:00`).toISOString();
}

function emptyForm() {
  return { id: null, dateLocal: todayInput(), loserId: "", participantIds: [], pins: MIN_PINS };
}

export default function ShamePage() {
  const t = useT();
  const { isAdmin } = useAuth();

  const [data, setData] = useState({ records: [] });
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const [shame, playerResult] = await Promise.all([
        cachedApiRequest("/shame", { force }),
        cachedApiRequest("/players", { force }),
      ]);
      setData({ records: shame.records ?? [] });
      setPlayers(playerResult.players ?? []);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const playerName = useCallback(
    (id) => players.find((p) => p.id === id)?.name ?? t("未知球员", "Unknown"),
    [players, t],
  );

  const isEditing = Boolean(form.id);

  // loser 候选：全部球员；同场候选：排除 loser 与已选
  const participantOptions = useMemo(
    () => players.filter((p) => p.id !== form.loserId && !form.participantIds.includes(p.id)),
    [players, form.loserId, form.participantIds],
  );

  function setLoser(id) {
    setForm((f) => ({
      ...f,
      loserId: id,
      participantIds: f.participantIds.filter((pid) => pid !== id),
    }));
  }

  function addParticipant(id) {
    if (!id) return;
    setForm((f) =>
      f.participantIds.includes(id) || id === f.loserId
        ? f
        : { ...f, participantIds: [...f.participantIds, id] },
    );
  }

  function removeParticipant(id) {
    setForm((f) => ({ ...f, participantIds: f.participantIds.filter((pid) => pid !== id) }));
  }

  function resetForm() {
    setForm(emptyForm());
    setFormError("");
  }

  function startEdit(record) {
    setForm({
      id: record.id,
      dateLocal: fmtDay(record.dateISO),
      loserId: record.loser?.id ?? "",
      participantIds: (record.participants ?? []).map((p) => p.id),
      pins: record.pins,
    });
    setFormError("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const formInvalid = !form.loserId || !form.dateLocal || Number(form.pins) < MIN_PINS;

  async function onSubmit() {
    if (formInvalid) {
      setFormError(t(`请选择 Loser、日期，且局数 ≥ ${MIN_PINS}。`, `Pick a loser, a date, and pins ≥ ${MIN_PINS}.`));
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const body = jsonBody({
        dateISO: dayInputToISO(form.dateLocal),
        loserId: form.loserId,
        participantIds: form.participantIds,
        pins: Number(form.pins),
      });
      if (form.id) {
        await apiRequest(`/shame/${form.id}`, { method: "PATCH", body });
      } else {
        await apiRequest("/shame", { method: "POST", body });
      }
      invalidateApiCache(["/shame"]);
      resetForm();
      await load(true);
    } catch (err) {
      setFormError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(record) {
    const ok = window.confirm(
      t(
        `确定删除这条耻辱记录吗？（${fmtDay(record.dateISO)} · ${record.loser?.name ?? ""} 被定 ${record.pins} 局）`,
        `Delete this shame record? (${fmtDay(record.dateISO)} · ${record.loser?.name ?? ""} pinned ${record.pins})`,
      ),
    );
    if (!ok) return;
    try {
      await apiRequest(`/shame/${record.id}`, { method: "DELETE" });
      invalidateApiCache(["/shame"]);
      if (form.id === record.id) resetForm();
      await load(true);
    } catch (err) {
      setError(err?.message ?? String(err));
    }
  }

  return (
    <div>
      <div className="pageTitle">
        <div>
          <h2 style={{ margin: 0 }}>{t("耻辱柱", "Hall of Shame")}</h2>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            {t(
              "Loser stay 玩法：输家留台，台下轮番上场挑战。被定在台上 5 局或以上者，名字永久留在耻辱柱。",
              "Loser-stay rules: the loser stays on the table while challengers line up. Anyone pinned for 5+ racks is recorded here forever.",
            )}
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 12,
          borderColor: "rgba(225,29,72,.45)",
          background: "rgba(225,29,72,.06)",
          fontWeight: 800,
        }}
      >
        😈 {t(
          `Loser 终极惩罚：输到 ${MIN_PINS} 局，留下历史，被所有人看见 —— 真正的「永远」。`,
          `Loser's ultimate punishment: lose ${MIN_PINS} racks and your name stays — seen by everyone, forever.`,
        )}
      </div>

      {error && <div className="errorBox" style={{ marginTop: 12 }}>{error}</div>}

      {isAdmin && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="rowBetween" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>
              {isEditing ? t("编辑耻辱记录", "Edit Shame Record") : t("新增耻辱记录", "New Shame Record")}
            </div>
            {isEditing && (
              <button className="btn" type="button" onClick={resetForm}>{t("取消编辑", "Cancel Edit")}</button>
            )}
          </div>

          <div className="row" style={{ alignItems: "flex-end", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="smallMuted">{t("Loser（被定的人）", "Loser (who got pinned)")}</div>
              <select className="input" value={form.loserId} onChange={(e) => setLoser(e.target.value)}>
                <option value="">{t("请选择", "Please select")}</option>
                {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ width: 140, minWidth: 140 }}>
              <div className="smallMuted">{t("被定局数", "Pins (racks)")}</div>
              <div className="stepper">
                <button className="btn stepperBtn" type="button" onClick={() => setForm((f) => ({ ...f, pins: Math.max(MIN_PINS, Number(f.pins) - 1) }))} aria-label={t("减少", "Decrease")}>−</button>
                <div className="stepperValue">{form.pins}</div>
                <button className="btn stepperBtn" type="button" onClick={() => setForm((f) => ({ ...f, pins: Number(f.pins) + 1 }))} aria-label={t("增加", "Increase")}>＋</button>
              </div>
            </div>

            <div style={{ width: 200, minWidth: 200 }}>
              <div className="smallMuted">{t("日期", "Date")}</div>
              <input
                className="input"
                type="date"
                value={form.dateLocal}
                onChange={(e) => setForm((f) => ({ ...f, dateLocal: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="smallMuted">{t("同场球员（轮番上场的人，可多选，不限人数）", "Players on the table (challengers, multi-select, no limit)")}</div>
            <select
              className="input"
              value=""
              onChange={(e) => { addParticipant(e.target.value); e.target.value = ""; }}
              disabled={participantOptions.length === 0}
              style={{ marginTop: 4 }}
            >
              <option value="">
                {participantOptions.length === 0 ? t("没有更多球员可选", "No more players") : t("＋ 添加同场球员", "+ Add a player")}
              </option>
              {participantOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            {form.participantIds.length > 0 && (
              <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {form.participantIds.map((id) => (
                  <span
                    key={id}
                    className="badge"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {playerName(id)}
                    <button
                      type="button"
                      onClick={() => removeParticipant(id)}
                      aria-label={t("移除", "Remove")}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        fontWeight: 900,
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {formError && <div className="errorBox" style={{ marginTop: 12 }}>{formError}</div>}

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn btnBrand" type="button" disabled={formInvalid || saving} onClick={onSubmit}>
              {saving ? t("保存中...", "Saving...") : isEditing ? t("保存修改", "Save Changes") : t("钉上耻辱柱", "Pin to Wall")}
            </button>
            <button className="btn" type="button" onClick={() => load(true)}>{t("刷新", "Refresh")}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ marginTop: 12 }}>{t("加载中...", "Loading...")}</div>
      ) : (
        <>
          <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 950, fontSize: 16 }}>
            {t("耻辱明细", "Wall of Shame")}
          </div>

          {data.records.length === 0 ? (
            <div className="card" style={{ color: "var(--muted)" }}>{t("还没有任何记录。", "No records yet.")}</div>
          ) : (
            data.records.map((record) => (
              <div key={record.id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="smallMuted">{fmtDay(record.dateISO)}</div>
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 1000, fontSize: 18, color: "var(--danger)" }}>
                        {record.loser?.name ?? t("未知球员", "Unknown")}
                      </span>
                      <span
                        className="badge"
                        style={{ borderColor: "rgba(225,29,72,.45)", color: "var(--danger)", fontWeight: 900 }}
                      >
                        {t(`被定 ${record.pins} 局 👿`, `pinned ${record.pins} 👿`)}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn" type="button" onClick={() => startEdit(record)}>{t("编辑", "Edit")}</button>
                      <button className="btn btnDanger" type="button" onClick={() => onDelete(record)}>{t("删除", "Delete")}</button>
                    </div>
                  )}
                </div>

                {record.participants.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <span className="smallMuted">{t("同场球员：", "On the table: ")}</span>
                    <span className="row" style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, marginLeft: 4, verticalAlign: "middle" }}>
                      {record.participants.map((p) => (
                        <span key={p.id} className="badge">{p.name}</span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
