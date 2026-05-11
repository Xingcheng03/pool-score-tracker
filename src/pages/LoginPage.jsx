import React, { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { useT } from "../lib/i18n.jsx";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const from = location.state?.from || "/matches";

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="authLayout">
      <div className="card authCard">
        <div className="authBrandMark">
          <span className="brandDot" />
          <span>{t("街灯", "Street Light")}</span>
        </div>

        <div className="badge authModeBadge">{t("账号登录", "Account Login")}</div>
        <h1 className="h1 authTitle">{t("欢迎回来", "Welcome back")}</h1>
        <p className="authSubtitle">{t(
          "登录后查看比赛、球员和街灯榜。",
          "Log in to view matches, players, and the Street Light Leaderboard.",
        )}</p>

        <form onSubmit={onSubmit} className="formStack authForm">
          <div>
            <div className="smallMuted authLabel">{t("用户名", "Username")}</div>
            <input className="input authInput" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </div>

          <div>
            <div className="smallMuted authLabel">{t("密码", "Password")}</div>
            <input
              className="input authInput"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="errorBox">{error}</div>}

          <button className="btn btnBrand authSubmitButton" type="submit" disabled={saving || !username.trim() || !password}>
            {saving ? t("处理中...", "Submitting...") : t("登录", "Login")}
          </button>
        </form>
      </div>
    </div>
  );
}
