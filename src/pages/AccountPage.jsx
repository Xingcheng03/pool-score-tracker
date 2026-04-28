import React, { useState } from "react";
import { useAuth } from "../auth/useAuth.js";

export default function AccountPage() {
  const { user, updateMe } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const payload = {};
      if (username.trim() && username.trim() !== user.username) payload.username = username.trim();
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      if (Object.keys(payload).length === 0) {
        setMessage("没有需要保存的修改。");
        return;
      }

      await updateMe(payload);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("账号信息已更新。");
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="h1">账号设置</h1>
      <p className="sub">所有用户都可以修改自己的用户名和密码。修改密码需要输入当前密码。</p>

      <div className="card settingsCard">
        <form onSubmit={onSubmit} className="formStack">
          <div className="row">
            <div className="badge">角色：{user?.role === "ADMIN" ? "管理员" : "球员"}</div>
            {user?.player && <div className="badge">绑定球员：{user.player.name}</div>}
          </div>

          <div>
            <div className="smallMuted">用户名</div>
            <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} />
          </div>

          <div>
            <div className="smallMuted">当前密码</div>
            <input className="input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
          </div>

          <div>
            <div className="smallMuted">新密码</div>
            <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
          </div>

          {message && <div className="successBox">{message}</div>}
          {error && <div className="errorBox">{error}</div>}

          <button className="btn btnBrand" type="submit" disabled={saving}>
            {saving ? "保存中..." : "保存修改"}
          </button>
        </form>
      </div>
    </div>
  );
}
