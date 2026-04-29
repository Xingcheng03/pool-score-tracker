import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import ConfirmButton from "../components/ConfirmButton.jsx";
import { apiRequest, jsonBody } from "../lib/api.js";

export default function PlayersPage() {
  const { isAdmin } = useAuth();
  const [players, setPlayers] = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/players");
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
    setNewName("");
    await load();
  }

  async function deletePlayer(id) {
    await apiRequest(`/players/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <h1 className="h1">球员</h1>

      {isAdmin && (
        <div className="card playerAddCard" style={{ marginBottom: 14 }}>
          <div className="row playerAddRow">
            <div className="playerAddInputWrap" style={{ flex: 1, minWidth: 240 }}>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="输入新球员名称" />
            </div>
            <button className="btn btnBrand playerAddButton" type="button" onClick={addPlayer}>
              添加球员
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="rowBetween" style={{ marginBottom: 12 }}>
          <div className="badge">球员数：{players.length}</div>
          <button className="btn" onClick={load} type="button">刷新</button>
        </div>

        {error && <div className="errorBox" style={{ marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <div className="sub">加载中...</div>
        ) : (
          <div className="tableWrap">
            <table className="playersTable">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>查看</th>
                  {isAdmin && <th>账号</th>}
                  {isAdmin && <th>改名</th>}
                  {isAdmin && <th>删除</th>}
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? "5" : "2"} style={{ color: "var(--muted)" }}>暂无球员。</td>
                  </tr>
                ) : (
                  players.map((player) => (
                    <PlayerRow key={player.id} player={player} isAdmin={isAdmin} onReload={load} onDelete={deletePlayer} />
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

function PlayerRow({ player, isAdmin, onReload, onDelete }) {
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
    setEditing(false);
    await onReload();
  }

  async function saveAccount() {
    setError("");
    try {
      await apiRequest(`/players/${player.id}/account`, {
        method: "PUT",
        body: jsonBody({ username: username.trim(), password }),
      });
      setPassword("");
      setAccountOpen(false);
      await onReload();
    } catch (err) {
      setError(err?.message ?? String(err));
    }
  }

  return (
    <tr>
      <td className="playerNameCell" style={{ fontWeight: 900 }}>
        <Link to={`/players/${player.id}`}>{player.name}</Link>
      </td>
      <td className="playerViewCell">
        <Link className="btn" to={`/players/${player.id}`}>进入详情</Link>
      </td>
      {isAdmin && (
        <td className="playerAccountCell">
          {!accountOpen ? (
            <div className="row">
              <span className="badge">{player.account ? player.account.username : "未绑定账号"}</span>
              <button className="btn" type="button" onClick={() => setAccountOpen(true)}>
                {player.account ? "重置账号" : "设置账号"}
              </button>
            </div>
          ) : (
            <div className="formStack compactForm">
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={player.account ? "新密码（可留空仅改用户名）" : "新账号必填；绑定已有账号可留空"} />
              {error && <div className="errorBox">{error}</div>}
              <div className="row">
                <button className="btn btnBrand" type="button" onClick={saveAccount}>保存账号</button>
                <button className="btn" type="button" onClick={() => setAccountOpen(false)}>取消</button>
              </div>
            </div>
          )}
        </td>
      )}
      {isAdmin && (
        <td className="playerRenameCell">
          {!editing ? (
            <button className="btn" type="button" onClick={() => setEditing(true)}>改名</button>
          ) : (
            <div className="row">
              <input className="input" style={{ minWidth: 160 }} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn btnBrand" type="button" onClick={saveName}>保存</button>
              <button className="btn" type="button" onClick={() => { setName(player.name); setEditing(false); }}>取消</button>
            </div>
          )}
        </td>
      )}
      {isAdmin && (
        <td className="playerDeleteCell">
          <ConfirmButton confirmText={`确定删除球员 ${player.name} 吗？`} onConfirm={() => onDelete(player.id)}>
            删除
          </ConfirmButton>
        </td>
      )}
    </tr>
  );
}
