import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import ConfirmButton from "../components/ConfirmButton.jsx";
import { apiRequest, jsonBody } from "../lib/api.js";
import { cachedApiRequest, invalidateApiCache, invalidatePoolDataCache } from "../lib/apiCache.js";
import { useT } from "../lib/i18n.jsx";

export default function PlayersPage() {
  const { isAdmin } = useAuth();
  const t = useT();
  const [players, setPlayers] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(force = false) {
    setLoading(true);
    setError("");
    try {
      const result = await cachedApiRequest("/players", { force });
      setPlayers(result.players);
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addPlayer() {
    const name = newName.trim();
    if (!name) return;
    await apiRequest("/players", { method: "POST", body: jsonBody({ name }) });
    invalidatePoolDataCache();
    setNewName("");
    await load(true);
  }

  async function deletePlayer(id) {
    await apiRequest(`/players/${id}`, { method: "DELETE" });
    invalidatePoolDataCache();
    await load(true);
  }

  async function setVisibility(id, hidden) {
    await apiRequest(`/players/${id}/visibility`, { method: "PATCH", body: jsonBody({ hidden }) });
    invalidatePoolDataCache();
    await load(true);
  }

  return (
    <div>
      <h1 className="h1">{t("球员", "Players")}</h1>

      {isAdmin && (
        <div className="card playerAddCard" style={{ marginBottom: 14 }}>
          <div className="row playerAddRow">
            <div className="playerAddInputWrap" style={{ flex: 1, minWidth: 240 }}>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("输入新球员名称", "Enter new player name")} />
            </div>
            <button className="btn btnBrand playerAddButton" type="button" onClick={addPlayer}>
              {t("添加球员", "Add Player")}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="rowBetween" style={{ marginBottom: 12 }}>
          <div className="badge">{t(`球员数：${players.length}`, `Players: ${players.length}`)}</div>
          <button className="btn" onClick={() => load(true)} type="button">{t("刷新", "Refresh")}</button>
        </div>

        {error && <div className="errorBox" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className="sub">{t("加载中...", "Loading...")}</div>
        ) : (
          <div className="tableWrap">
            <table className="playersTable">
              <thead>
                <tr>
                  <th>{t("名称", "Name")}</th>
                  <th>{t("查看", "View")}</th>
                  {isAdmin && <th>{t("账号", "Account")}</th>}
                  {isAdmin && <th>{t("改名", "Rename")}</th>}
                  {isAdmin && <th>{t("榜单显示", "Leaderboard")}</th>}
                  {isAdmin && <th>{t("删除", "Delete")}</th>}
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? "6" : "2"} style={{ color: "var(--muted)" }}>{t("暂无球员。", "No players yet.")}</td>
                  </tr>
                ) : (
                  players.map((player) => (
                    <PlayerRow key={player.id} player={player} isAdmin={isAdmin} onReload={load} onDelete={deletePlayer} onSetVisibility={setVisibility} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ player, isAdmin, onReload, onDelete, onSetVisibility }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [accountOpen, setAccountOpen] = useState(false);
  const [username, setUsername] = useState(player.account?.username ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function saveName() {
    await apiRequest(`/players/${player.id}`, {
      method: "PATCH",
      body: jsonBody({ name: name.trim() }),
    });
    invalidatePoolDataCache();
    setEditing(false);
    await onReload(true);
  }

  async function saveAccount() {
    setError("");
    try {
      await apiRequest(`/players/${player.id}/account`, {
        method: "PUT",
        body: jsonBody({ username: username.trim(), password }),
      });
      invalidateApiCache(["/players"]);
      setPassword("");
      setAccountOpen(false);
      await onReload(true);
    } catch (err) {
      setError(err?.message ?? String(err));
    }
  }

  return (
    <tr>
      <td className="playerNameCell" style={{ fontWeight: 900 }}>
        <Link to={`/players/${player.id}`}>{player.name}</Link>
        {player.hidden && (
          <span className="badge" style={{ marginLeft: 8, color: "var(--muted)" }}>{t("已禁用", "Disabled")}</span>
        )}
      </td>
      <td className="playerViewCell">
        <Link className="btn" to={`/players/${player.id}`}>{t("进入详情", "View Details")}</Link>
      </td>
      {isAdmin && (
        <td className="playerAccountCell">
          {!accountOpen ? (
            <div className="row">
              <span className="badge">{player.account ? player.account.username : t("未绑定账号", "No account linked")}</span>
              <button className="btn" type="button" onClick={() => setAccountOpen(true)}>
                {player.account ? t("重置账号", "Reset Account") : t("设置账号", "Set Account")}
              </button>
            </div>
          ) : (
            <div className="formStack compactForm">
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("用户名", "Username")} />
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={player.account ? t("新密码（可留空仅改用户名）", "New password (leave blank to only change username)") : t("新账号必填；绑定已有账号可留空", "Required for new account; leave blank to bind existing")} />
              {error && <div className="errorBox">{error}</div>}
              <div className="row">
                <button className="btn btnBrand" type="button" onClick={saveAccount}>{t("保存账号", "Save Account")}</button>
                <button className="btn" type="button" onClick={() => setAccountOpen(false)}>{t("取消", "Cancel")}</button>
              </div>
            </div>
          )}
        </td>
      )}
      {isAdmin && (
        <td className="playerRenameCell">
          {!editing ? (
            <button className="btn" type="button" onClick={() => setEditing(true)}>{t("改名", "Rename")}</button>
          ) : (
            <div className="row">
              <input className="input" style={{ minWidth: 160 }} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn btnBrand" type="button" onClick={saveName}>{t("保存", "Save")}</button>
              <button className="btn" type="button" onClick={() => { setName(player.name); setEditing(false); }}>{t("取消", "Cancel")}</button>
            </div>
          )}
        </td>
      )}
      {isAdmin && (
        <td className="playerVisibilityCell">
          {player.hidden ? (
            <button className="btn btnBrand" type="button" onClick={() => onSetVisibility(player.id, false)}>
              {t("恢复", "Restore")}
            </button>
          ) : (
            <ConfirmButton
              className="btn"
              confirmText={t(`确定禁用球员 ${player.name} 吗？禁用后他不在街灯榜和胜负积分榜显示，但比赛记录保留。`, `Disable player ${player.name}? They will be hidden from both leaderboards, but match records are kept.`)}
              onConfirm={() => onSetVisibility(player.id, true)}
            >
              {t("禁用", "Disable")}
            </ConfirmButton>
          )}
        </td>
      )}
      {isAdmin && (
        <td className="playerDeleteCell">
          <ConfirmButton confirmText={t(`确定删除球员 ${player.name} 吗？`, `Delete player ${player.name}?`)} onConfirm={() => onDelete(player.id)}>
            {t("删除", "Delete")}
          </ConfirmButton>
        </td>
      )}
    </tr>
  );
}
