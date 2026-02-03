import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import PageShell from "./components/PageShell.jsx";

import MatchesPage from "./pages/MatchesPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import PlayerDetailPage from "./pages/PlayerDetailPage.jsx";
import NewMatchPage from "./pages/NewMatchPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <PageShell>
        <Routes>
          <Route path="/" element={<Navigate to="/matches" replace />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:playerId" element={<PlayerDetailPage />} />
          <Route path="/new" element={<NewMatchPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/matches" replace />} />
          
        </Routes>
      </PageShell>
    </div>
  );
}
