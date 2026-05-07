import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { INTERNAL_POINTS_NAME } from "../constants/labels.js";

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const linkClass = ({ isActive }) => (isActive ? "pill pillActive" : "pill");
  const accountLink = user?.player?.id ? `/players/${user.player.id}` : "/account";
  const navClassName = `${location.pathname === "/login" ? "nav navLoginPage" : "nav"}${isMenuOpen ? " navMenuOpen" : ""}`;

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className={navClassName}>
      <button className="navDrawerOverlay" type="button" aria-label="关闭导航" onClick={closeMenu} />
      <div className="navInner">
        <div className="brand">
          <span className="brandDot" />
          <span>街灯</span>
        </div>

        <button
          className="navMenuButton"
          type="button"
          aria-label={isMenuOpen ? "收起导航" : "打开导航"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="navLinks">
          {isAuthenticated ? (
            <>
              <NavLink to="/matches" className={linkClass} onClick={closeMenu}>
                比赛数据
              </NavLink>
              <NavLink to="/players" className={linkClass} onClick={closeMenu}>
                球员
              </NavLink>
              <NavLink to="/new" className={linkClass} onClick={closeMenu}>
                上报比赛
              </NavLink>
              <NavLink to="/leaderboard" className={linkClass} onClick={closeMenu}>
                {INTERNAL_POINTS_NAME}
              </NavLink>
              <NavLink to="/win-lose-points" className={linkClass} onClick={closeMenu}>
                胜负积分
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin/reports" className={linkClass} onClick={closeMenu}>
                  审核比分
                </NavLink>
              )}
            </>
          ) : (
            <NavLink to="/login" className={linkClass} onClick={closeMenu}>
              登录
            </NavLink>
          )}
        </div>

        {isAuthenticated && (
          <div className="navAccountLinks">
            <NavLink to="/ai-analysis" className={linkClass}>
              AI 分析
            </NavLink>
            <NavLink to={accountLink} className={linkClass}>
              {user?.username ?? "账号"}
            </NavLink>
            <button
              className="pill navButton"
              type="button"
              onClick={() => {
                closeMenu();
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
