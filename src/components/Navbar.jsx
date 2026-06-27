import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";
import { useT, useLanguage } from "../lib/i18n.jsx";

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const t = useT();
  const { lang, setLang } = useLanguage();
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
  const toggleLang = () => setLang(lang === "en" ? "zh" : "en");

  return (
    <div className={navClassName}>
      <button className="navDrawerOverlay" type="button" aria-label={t("关闭导航", "Close menu")} onClick={closeMenu} />
      <div className="navInner">
        <div className="brand">
          <span className="brandDot" />
          <span>{t("街灯", "Street Light")}</span>
          <button
            className="pill navLangToggle"
            type="button"
            onClick={toggleLang}
            aria-label={t("切换语言", "Toggle language")}
            title={t("切换语言", "Toggle language")}
          >
            {lang === "en" ? "中" : "EN"}
          </button>
        </div>

        <button
          className="navMenuButton"
          type="button"
          aria-label={isMenuOpen ? t("收起导航", "Collapse menu") : t("打开导航", "Open menu")}
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
                {t("比赛数据", "Matches")}
              </NavLink>
              <NavLink to="/players" className={linkClass} onClick={closeMenu}>
                {t("球员", "Players")}
              </NavLink>
              <NavLink to="/new" className={linkClass} onClick={closeMenu}>
                {t("上报比赛", "Submit Match")}
              </NavLink>
              <NavLink to="/leaderboard" className={linkClass} onClick={closeMenu}>
                {t("街灯榜", "Street Light Leaderboard")}
              </NavLink>
              <NavLink to="/shame" className={linkClass} onClick={closeMenu}>
                {t("耻辱柱", "Hall of Shame")}
              </NavLink>
              <NavLink to="/tournaments" className={linkClass} onClick={closeMenu}>
                {t("赛程", "Tournaments")}
              </NavLink>
              <NavLink to="/history" className={linkClass} onClick={closeMenu}>
                {t("历史球员", "Historical Players")}
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin/reports" className={linkClass} onClick={closeMenu}>
                  {t("审核比分", "Review Reports")}
                </NavLink>
              )}
            </>
          ) : (
            <NavLink to="/login" className={linkClass} onClick={closeMenu}>
              {t("登录", "Login")}
            </NavLink>
          )}
          <button
            className="pill navLangToggleDrawer"
            type="button"
            onClick={toggleLang}
            aria-label={t("切换语言", "Toggle language")}
          >
            {lang === "en" ? "切换到中文" : "Switch to English"}
          </button>
        </div>

        {isAuthenticated && (
          <div className="navAccountLinks">
            <NavLink to={accountLink} className={linkClass}>
              {user?.username ?? t("账号", "Account")}
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
              {t("退出登录", "Logout")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
