import React, { useRef, useState } from "react";
import { apiRequest, downloadJson, jsonBody } from "../lib/api.js";

function todayName() {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `pool-data-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

export default function AdminDataPage() {
  const inputRef = useRef(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportJson() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const payload = await apiRequest("/data/export");
      downloadJson(todayName(), payload);
      setMessage(`已导出 ${payload.players.length} 名球员、${payload.matches.length} 场正式比赛。`);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  async function importJson(file) {
    if (!file) return;
    setError("");
    setMessage("");
    setBusy(true);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await apiRequest("/data/import", {
        method: "POST",
        body: jsonBody(parsed),
      });
      setMessage(`导入完成：球员 ${result.importedPlayers}，比赛 ${result.importedMatches}，跳过 ${result.skippedMatches.length}。`);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <h1 className="h1">数据导入导出</h1>
      <p className="sub">
        这里是管理员专属功能。导入兼容当前 `store.js` 导出的 JSON 格式，只读取 `players` 和 `matches`，忽略 `computed` 并由后端重新计算。
      </p>

      <div className="card">
        <div className="row">
          <button className="btn btnBrand" type="button" onClick={exportJson} disabled={busy}>
            导出现有记录 JSON
          </button>

          <button className="btn" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
            导入历史 JSON
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(event) => importJson(event.target.files?.[0])}
          />
        </div>

        {message && <div className="successBox" style={{ marginTop: 14 }}>{message}</div>}
        {error && <div className="errorBox" style={{ marginTop: 14 }}>{error}</div>}
      </div>
    </div>
  );
}
