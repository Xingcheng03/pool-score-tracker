import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import PageShell from "./components/PageShell.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import AccountPage from "./pages/AccountPage.jsx";
import AdminReportsPage from "./pages/AdminReportsPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MatchesPage from "./pages/MatchesPage.jsx";
import NewMatchPage from "./pages/NewMatchPage.jsx";
import PlayerDetailPage from "./pages/PlayerDetailPage.jsx";
import HistoricalPlayersPage from "./pages/HistoricalPlayersPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import ShamePage from "./pages/ShamePage.jsx";
import TournamentsPage from "./pages/TournamentsPage.jsx";
import TournamentDetailPage from "./pages/TournamentDetailPage.jsx";

function ProtectedPage({ children, adminOnly = false }) {
  return <ProtectedRoute adminOnly={adminOnly}>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <PageShell>
        <Routes>
          <Route path="/" element={<Navigate to="/matches" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/matches" element={<ProtectedPage><MatchesPage /></ProtectedPage>} />
          <Route path="/players" element={<ProtectedPage><PlayersPage /></ProtectedPage>} />
          <Route path="/players/:playerId" element={<ProtectedPage><PlayerDetailPage /></ProtectedPage>} />
          <Route path="/new" element={<ProtectedPage><NewMatchPage /></ProtectedPage>} />
          <Route path="/leaderboard" element={<ProtectedPage><LeaderboardPage /></ProtectedPage>} />
          <Route path="/shame" element={<ProtectedPage><ShamePage /></ProtectedPage>} />
          <Route path="/tournaments" element={<ProtectedPage><TournamentsPage /></ProtectedPage>} />
          <Route path="/tournaments/:tournamentId" element={<ProtectedPage><TournamentDetailPage /></ProtectedPage>} />
          <Route path="/history" element={<ProtectedPage><HistoricalPlayersPage /></ProtectedPage>} />
          <Route path="/account" element={<ProtectedPage><AccountPage /></ProtectedPage>} />
          <Route path="/admin/reports" element={<ProtectedPage adminOnly><AdminReportsPage /></ProtectedPage>} />
          <Route path="*" element={<Navigate to="/matches" replace />} />
        </Routes>
      </PageShell>
    </div>
  );
}
