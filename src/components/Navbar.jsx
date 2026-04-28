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
          <span>PoolLeague</span>
        </div>

        <div className="navLinks">
          {isAuthenticated ? (
            <>
              <NavLink to="/matches" className={linkClass}>
                Matches
              </NavLink>
              <NavLink to="/players" className={linkClass}>
                Players
              </NavLink>
              <NavLink to="/new" className={linkClass}>
                Submit Match
              </NavLink>
              <NavLink to="/leaderboard" className={linkClass}>
                {INTERNAL_POINTS_NAME}
              </NavLink>
              <NavLink to="/win-lose-points" className={linkClass}>
                Win/Loss Points
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin/reports" className={linkClass}>
                  Review Scores
                </NavLink>
              )}
            </>
          ) : (
            <NavLink to="/login" className={linkClass}>
              Login
            </NavLink>
          )}
        </div>

        {isAuthenticated && (
          <div className="navAccountLinks">
            <NavLink to={accountLink} className={linkClass}>
              {user?.username ?? "Account"}
            </NavLink>
            <button
              className="pill navButton"
              type="button"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
