import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.js";

export default function AccountSettingsForm({ compact = false }) {
  const { user, updateMe } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUsername(user?.username ?? "");
  }, [user?.username]);

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

  if (compact) {
    return (
      <form onSubmit={onSubmit} className="accountInlineForm">
        <label className="accountInlineField">
          <span className="accountInlineLabel">用户名：</span>
          <input
            className="input accountInlineInput"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="用户名"
            autoComplete="username"
          />
        </label>
        <label className="accountInlineField">
          <span className="accountInlineLabel">当前密码：</span>
          <input
            className="input accountInlineInput"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="当前密码"
            autoComplete="current-password"
          />
        </label>
        <label className="accountInlineField">
          <span className="accountInlineLabel">新密码：</span>
          <input
            className="input accountInlineInput"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="新密码"
            autoComplete="new-password"
          />
        </label>
        <button className="btn btnBrand accountInlineSave" type="submit" disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </button>
        <div className="accountInlineNote">用户名只用作登录，不等于球员名称。</div>
        {(message || error) && (
          <div className={error ? "accountInlineMessage isError" : "accountInlineMessage"}>
            {error || message}
          </div>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="formStack">
      <div className="row">
        <div className="badge">角色：{user?.role === "ADMIN" ? "管理员" : "球员"}</div>
        {user?.player && <div className="badge">绑定球员：{user.player.name}</div>}
      </div>

      <div>
        <div className="smallMuted">用户名：</div>
        <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        <div className="accountFieldNote">用户名只用作登录，不等于球员名称。</div>
      </div>

      <div>
        <div className="smallMuted">当前密码：</div>
        <input className="input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
      </div>

      <div>
        <div className="smallMuted">新密码：</div>
        <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
      </div>

      {message && <div className="successBox">{message}</div>}
      {error && <div className="errorBox">{error}</div>}

      <button className="btn btnBrand" type="submit" disabled={saving}>
        {saving ? "保存中..." : "保存修改"}
      </button>
    </form>
  );
}
