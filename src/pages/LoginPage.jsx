import React, { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

export default function LoginPage() {
  const { isAuthenticated, login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [playerName, setPlayerName] = useState("");
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
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password, playerName || username);
      }
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
        <div className="badge">{mode === "login" ? "账号登录" : "新用户注册"}</div>
        <h1 className="h1" style={{ marginTop: 12 }}>
          街灯
        </h1>
        <p className="sub">
          管理员可以审核比分、导入导出历史 JSON、给已有球员绑定账号。球员登录后可以查看数据并上报比赛分数。
        </p>

        <form onSubmit={onSubmit} className="formStack">
          <div>
            <div className="smallMuted">用户名</div>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>

          <div>
            <div className="smallMuted">密码</div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>

          {mode === "register" && (
            <div>
              <div className="smallMuted">球员名称</div>
              <input className="input" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="默认使用用户名" />
            </div>
          )}

          {error && <div className="errorBox">{error}</div>}

          <button className="btn btnBrand" type="submit" disabled={saving || !username.trim() || !password}>
            {saving ? "处理中..." : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </form>

        <div className="rowBetween" style={{ marginTop: 14 }}>
          <span className="smallMuted">{mode === "login" ? "没有账号？" : "已有账号？"}</span>
          <button className="btn" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "注册球员账号" : "返回登录"}
          </button>
        </div>
      </div>
    </div>
  );
}
