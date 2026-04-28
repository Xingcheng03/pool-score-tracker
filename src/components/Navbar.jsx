import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { INTERNAL_POINTS_NAME } from "../constants/labels.js";

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const linkClass = ({ isActive }) => (isActive ? "pill pillActive" : "pill");

  return (
    <div className="nav">
      <div className="navInner">
        <div className="brand">
          <span className="brandDot" />
          <span>PoolLeague</span>
        </div>

        <div className="navLinks">
          {isAuthenticated ? (
            <>
              <NavLink to="/matches" className={linkClass}>
                比赛数据
              </NavLink>
              <NavLink to="/players" className={linkClass}>
                球员
              </NavLink>
              <NavLink to="/new" className={linkClass}>
                上报比赛
              </NavLink>
              <NavLink to="/leaderboard" className={linkClass}>
                {INTERNAL_POINTS_NAME}
              </NavLink>
              <NavLink to="/win-lose-points" className={linkClass}>
                胜负积分榜
              </NavLink>
              {isAdmin && (
                <>
                  <NavLink to="/admin/reports" className={linkClass}>
                    审核比分
                  </NavLink>
                  <NavLink to="/admin/data" className={linkClass}>
                    数据导入导出
                  </NavLink>
                </>
              )}
              <NavLink to="/account" className={linkClass}>
                {user?.username ?? "账号"}
              </NavLink>
              <button
                className="pill navButton"
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              >
                退出
              </button>
            </>
          ) : (
            <NavLink to="/login" className={linkClass}>
              登录
            </NavLink>
          )}
        </div>
      </div>
    </div>
  );
}
