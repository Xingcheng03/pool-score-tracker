import React from "react";
import { NavLink } from "react-router-dom";

export default function Navbar() {
  const linkClass = ({ isActive }) => (isActive ? "pill pillActive" : "pill");

  return (
    <div className="nav">
      <div className="navInner">
        <div className="brand">
          <span className="brandDot" />
          <span>PoolLeague</span>
        </div>

        <div className="navLinks">
          <NavLink to="/matches" className={linkClass}>
            比赛数据
          </NavLink>
          <NavLink to="/players" className={linkClass}>
            球员
          </NavLink>
          <NavLink to="/new" className={linkClass}>
            新建比赛
          </NavLink>
          <NavLink to="/leaderboard" className={linkClass}>
            Fargo 积分榜
          </NavLink>
          <NavLink to="/win-lose-points" className={linkClass}>
            胜负积分榜
          </NavLink>
        </div>
      </div>
    </div>
  );
}
