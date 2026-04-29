import React, { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
          <span>街灯</span>
        </div>

        <div className="badge authModeBadge">账号登录</div>
        <h1 className="h1 authTitle">欢迎回来</h1>
        <p className="authSubtitle">登录后查看比赛、球员和街灯榜。</p>

        <form onSubmit={onSubmit} className="formStack authForm">
          <div>
            <div className="smallMuted authLabel">用户名</div>
            <input className="input authInput" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </div>

          <div>
            <div className="smallMuted authLabel">密码</div>
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
            {saving ? "处理中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
