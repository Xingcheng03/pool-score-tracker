import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { INTERNAL_POINTS_NAME } from "../constants/labels.js";

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const linkClass = ({ isActive }) => (isActive ? "pill pillActive" : "pill");
  const accountLink = user?.player?.id ? `/players/${user.player.id}` : "/account";

  return (
    <div className="nav">
      <div className="navInner">
        <div className="brand">
          <span className="brandDot" />
          <span>街灯</span>
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
                胜负积分
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin/reports" className={linkClass}>
                  审核比分
                </NavLink>
              )}
            </>
          ) : (
            <NavLink to="/login" className={linkClass}>
              登录
            </NavLink>
          )}
        </div>

        {isAuthenticated && (
          <div className="navAccountLinks">
            <NavLink to={accountLink} className={linkClass}>
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
              退出登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
