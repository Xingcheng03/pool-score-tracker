import React, { useMemo, useState } from "react";
import { deleteMatch, getMatches, getPlayerById, exportToJSON, importFromJSONFile, exportToExcel, tagLabel } from "../data/store.js";
import ConfirmButton from "../components/ConfirmButton.jsx";

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function MatchesPage() {
  const [tick, setTick] = useState(0);
  const [tagFilter, setTagFilter] = useState("all");

  const matches = useMemo(() => getMatches(tagFilter), [tick, tagFilter]);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
  }, [matches]);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = window.confirm("导入会覆盖你当前所有数据（球员+比赛）。确定继续吗？");
    if (!ok) {
      e.target.value = "";
      return;
    }

    try {
      await importFromJSONFile(file);
      alert("导入成功！");
      setTick((t) => t + 1);
    } catch (err) {
      alert(`导入失败：${err?.message ?? String(err)}`);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="space">
      <h1 className="h1">比赛数据</h1>
      <p className="sub">所有比赛都会保存在本地（localStorage）。你也可以导出/导入 JSON 或 Excel。支持按标签筛选查看（无平局）。</p>

      <div className="card">
        <div className="rowBetween" style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <div className="badge">总比赛数：{sortedMatches.length}</div>

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

          <div className="row" style={{ gap: 10 }}>
            <button className="btn" type="button" onClick={exportToJSON}>
              导出 JSON
            </button>

            <button className="btn" type="button" onClick={() => exportToExcel()}>
              导出 Excel
            </button>

            <label className="btn" style={{ cursor: "pointer" }}>
              导入 JSON
              <input type="file" accept="application/json" hidden onChange={handleImport} />
            </label>

            <button className="btn" onClick={() => setTick((t) => t + 1)} type="button">
              刷新
            </button>
          </div>
        </div>

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
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedMatches.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ color: "var(--muted)" }}>
                    还没有比赛，去“新建比赛”记一场吧。
                  </td>
                </tr>
              ) : (
                sortedMatches.map((m) => {
                  const L = getPlayerById(m.leftPlayerId);
                  const R = getPlayerById(m.rightPlayerId);
                  const W = m.winnerId ? getPlayerById(m.winnerId) : null;

                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 900 }}>{tagLabel(m.tag)}</td>
                      <td style={{ fontWeight: 900 }}>{m.matchName ?? "未命名比赛"}</td>
                      <td>{fmtDate(m.dateISO)}</td>
                      <td>抢 {m.raceTo}</td>
                      <td>{L?.name ?? "Unknown"}</td>
                      <td>
                        {m.leftScore} : {m.rightScore}
                      </td>
                      <td>{R?.name ?? "Unknown"}</td>
                      <td>{W ? W.name : "—"}</td>
                      <td style={{ fontWeight: 900 }}>{m.isHandicap ? "是" : "否"}</td>
                      <td>
                        <ConfirmButton
                          confirmText="确定删除这场比赛吗？"
                          onConfirm={() => {
                            deleteMatch(m.id);
                            setTick((t) => t + 1);
                          }}
                        >
                          删除
                        </ConfirmButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
