import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.js";
import { useT } from "../lib/i18n.jsx";

export default function AccountSettingsForm({ compact = false }) {
  const { user, updateMe } = useAuth();
  const t = useT();
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
        setMessage(t("没有需要保存的修改。", "No changes to save."));
        return;
      }

      await updateMe(payload);
      setCurrentPassword("");
      setNewPassword("");
      setMessage(t("账号信息已更新。", "Account info updated."));
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
          <span className="accountInlineLabel">{t("用户名：", "Username:")}</span>
          <input
            className="input accountInlineInput"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t("用户名", "Username")}
            autoComplete="username"
          />
        </label>
        <label className="accountInlineField">
          <span className="accountInlineLabel">{t("当前密码：", "Current Password:")}</span>
          <input
            className="input accountInlineInput"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder={t("当前密码", "Current password")}
            autoComplete="current-password"
          />
        </label>
        <label className="accountInlineField">
          <span className="accountInlineLabel">{t("新密码：", "New Password:")}</span>
          <input
            className="input accountInlineInput"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={t("新密码", "New password")}
            autoComplete="new-password"
          />
        </label>
        <button className="btn btnBrand accountInlineSave" type="submit" disabled={saving}>
          {saving ? t("保存中...", "Saving...") : t("保存", "Save")}
        </button>
        <div className="accountInlineNote">{t(
          "用户名只用作登录，不等于球员名称。",
          "Username is for login only; it is not the same as your player name.",
        )}</div>
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
        <div className="badge">{t("角色", "Role")}: {user?.role === "ADMIN" ? t("管理员", "Admin") : t("球员", "Player")}</div>
        {user?.player && <div className="badge">{t("绑定球员", "Linked Player")}: {user.player.name}</div>}
      </div>

      <div>
        <div className="smallMuted">{t("用户名：", "Username:")}</div>
        <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        <div className="accountFieldNote">{t(
          "用户名只用作登录，不等于球员名称。",
          "Username is for login only; it is not the same as your player name.",
        )}</div>
      </div>

      <div>
        <div className="smallMuted">{t("当前密码：", "Current Password:")}</div>
        <input className="input" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
      </div>

      <div>
        <div className="smallMuted">{t("新密码：", "New Password:")}</div>
        <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
      </div>

      {message && <div className="successBox">{message}</div>}
      {error && <div className="errorBox">{error}</div>}

      <button className="btn btnBrand" type="submit" disabled={saving}>
        {saving ? t("保存中...", "Saving...") : t("保存修改", "Save Changes")}
      </button>
    </form>
  );
}
