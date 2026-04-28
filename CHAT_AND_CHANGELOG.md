# Pool Score Tracker Backend/API Integration Chat and Change Log

Generated: 2026-04-28

This document records the visible project discussion and the implementation changes made during this chat. It does not include hidden system/developer instructions.

## Conversation Summary

### 1. Backend Planning Request

The app originally stored and processed all data in the frontend through `localStorage` and `src/data/store.js`.

Requested backend goals:

- Add a `backEnd/` folder inside the current app folder.
- Store all data in the backend: users, accounts, players, matches, points, rankings.
- Add user login.
- Support two user roles: administrator and player.
- Player permissions:
  - View own detail and other players' detail.
  - View all approved matches.
  - View rankings and stats.
  - Create/report matches and submit scores.
- Administrator permissions:
  - All player permissions.
  - View submitted match scores.
  - Approve or reject submitted scores.
- Only administrator-approved matches enter official match records and ranking calculations.

Initial backend plan:

- Backend stack: Node.js, Express, Prisma, SQLite for local development.
- Later database can be changed to PostgreSQL.
- Authentication with JWT.
- Roles: `ADMIN` and `PLAYER`.
- Separate pending score reports from official approved matches.

### 2. Clarification: `project_plan.md`

The user clarified that this backend work is unrelated to `project_plan.md`.

Decision:

- `project_plan.md` is not used or modified.
- Backend implementation is independent from that file.

### 3. Admin Seed Accounts

The user requested two preset administrator accounts:

- Username: `Jack`
- Username: `Johnny`

Passwords were provided in the chat and used for local seed setup. These are local development defaults and should be changed before production deployment.

Implemented:

- `backEnd/prisma/seed.js`
- Seed creates or updates the two admin users.

### 4. User Account Management

Requested:

- All users can change their own username and password after login.
- Existing historical players should not be lost.
- Existing player/match data exists in JSON files.
- After importing JSON, admins should be able to set usernames/passwords for historical players.
- Once those players log in, they should be able to change their own password.

Decision:

- Historical `players` and `matches` are imported as official existing data.
- Imported players do not automatically get login accounts.
- Admin can set an account directly on a historical player row.
- That account is bound to the historical `player.id`, so all existing match records already belong to that player.

### 5. JSON Format Clarification

The user said to follow the JSON export format from `src/data/store.js`.

Implemented import/export behavior:

- Reads `players` and `matches` from the existing frontend export format.
- Ignores `computed`, because backend recalculates computed stats/rankings.
- Preserves historical player IDs and match player references.
- Export returns a compatible object:

```json
{
  "exportedAtISO": "...",
  "storageKey": "pool_tracker_v1",
  "players": [],
  "matches": [],
  "computed": {}
}
```

### 6. Ranking Logic Constraint

The user explicitly required:

- The ranking and points calculation logic from `store.js` must not change.

Implemented:

- Backend `ranking.service.js` was written to preserve the existing logic:
  - Season logic.
  - Handicap factor logic.
  - Player win/loss stats.
  - FargoLite-style rating replay.
  - Rating tiers.
  - Rack win rate.
  - Recent trend.
  - Win/loss points leaderboard.
- Data source changed from `localStorage` to approved backend `matches`.
- Calculation formulas were not redesigned.

One lint-only cleanup was made:

- Removed an unused `effWins` variable from both `src/data/store.js` and backend ranking code.
- It had no effect on outputs because it was not used in any returned value or calculation.

### 7. Admin-Only JSON Import/Export

The user clarified:

- Historical JSON import and current JSON export are administrator-only features.

Implemented:

- `POST /api/data/import` requires `ADMIN`.
- `GET /api/data/export` requires `ADMIN`.
- Frontend exposes these only in `/admin/data`.

### 8. Frontend API Integration

The user requested connecting the frontend to the backend API.

Implemented:

- Added API client and auth state.
- Added login/register page.
- Added account settings page.
- Protected routes by login status.
- Added administrator-only route protection.
- Converted main pages from `localStorage` access to backend API calls.
- Added administrator review page.
- Added administrator data import/export page.

### 9. Historical Player Account Binding Question

The user asked how existing historical match records for Jack, Johnny, and other players become associated with login accounts.

Explanation:

- Match records are linked to `players.id`, not directly to `users.id`.
- Therefore, historical records do not need to be moved.
- The correct operation is to bind a login account to the existing historical player.

For normal historical players:

- Admin finds the historical player in the Players page.
- Admin sets a username and password.
- Backend creates a `PLAYER` user bound to that `player.id`.
- The player logs in and automatically owns the historical matches tied to that player.

For seeded admin users Jack and Johnny:

- Since `Jack` and `Johnny` already exist as admin users, trying to create new accounts with the same username would conflict.
- Backend was updated so that if an admin enters an existing username that is not already bound to another player, it binds that existing user to the selected historical player.
- The user keeps their existing role, so `Jack` and `Johnny` remain admins while also being linked to their historical player records.

## Implemented Backend

Backend location:

```text
backEnd/
```

### Backend Stack

- Node.js
- Express
- Prisma
- SQLite
- JWT
- bcrypt password hashing
- CORS

### Backend Directory Structure

```text
backEnd/
  package.json
  package-lock.json
  .env.example
  README.md
  prisma/
    schema.prisma
    seed.js
    migrations/
  src/
    app.js
    server.js
    config/
      env.js
    lib/
      prisma.js
    middleware/
      auth.js
      errorHandler.js
      requireRole.js
    routes/
      auth.routes.js
      data.routes.js
      leaderboard.routes.js
      matches.routes.js
      matchReports.routes.js
      players.routes.js
    services/
      auth.service.js
      data.service.js
      match.service.js
      matchInput.service.js
      matchReport.service.js
      player.service.js
      ranking.service.js
      shape.service.js
      stats.service.js
    utils/
      asyncHandler.js
      httpError.js
      jwt.js
      password.js
```

### Backend Database Models

Core Prisma models:

- `User`
- `Player`
- `Match`
- `MatchReport`
- `AuditLog`

Core enums:

- `UserRole`: `ADMIN`, `PLAYER`
- `MatchTag`: `PRACTICE`, `LIVE`
- `MatchReportStatus`: `PENDING`, `APPROVED`, `REJECTED`
- `AuditAction`

### Backend Auth/API Behavior

Authentication:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `PATCH /api/auth/me`

Players:

- `GET /api/players`
- `GET /api/players/:id`
- `POST /api/players` admin only
- `PATCH /api/players/:id` admin only
- `DELETE /api/players/:id` admin only
- `PUT /api/players/:id/account` admin only

Matches:

- `GET /api/matches`
- `GET /api/matches/:id`
- `DELETE /api/matches/:id` admin only

Match reports:

- `POST /api/match-reports`
- `GET /api/match-reports/mine`
- `GET /api/match-reports` admin only
- `POST /api/match-reports/:id/approve` admin only
- `POST /api/match-reports/:id/reject` admin only

Rankings/stats:

- `GET /api/leaderboard`
- `GET /api/leaderboard/win-lose`
- `GET /api/leaderboard/seasons`
- `GET /api/leaderboard/players/:playerId/stats`

Data import/export:

- `POST /api/data/import` admin only
- `GET /api/data/export` admin only

Health:

- `GET /api/health`

## Implemented Frontend Changes

### New Frontend Infrastructure

Added:

```text
src/lib/api.js
src/auth/AuthContext.jsx
src/auth/useAuth.js
src/components/ProtectedRoute.jsx
```

Purpose:

- Store JWT token in localStorage.
- Attach `Authorization: Bearer ...` to API requests.
- Load current user from `/api/auth/me`.
- Provide login/register/logout/update account functions.
- Protect routes from unauthenticated users.
- Protect admin-only pages.

### New Frontend Pages

Added:

```text
src/pages/LoginPage.jsx
src/pages/AccountPage.jsx
src/pages/AdminReportsPage.jsx
src/pages/AdminDataPage.jsx
```

Routes:

- `/login`
- `/account`
- `/admin/reports`
- `/admin/data`

### Converted Existing Pages to API

Updated:

```text
src/pages/MatchesPage.jsx
src/pages/PlayersPage.jsx
src/pages/NewMatchPage.jsx
src/pages/LeaderboardPage.jsx
src/pages/PlayerDetailPage.jsx
src/pages/WinLosePointsPage.jsx
```

Behavior:

- `MatchesPage` now reads official approved matches from `/api/matches`.
- `PlayersPage` reads players from `/api/players`.
- Admins can create/edit/delete players and set player accounts.
- `NewMatchPage` submits to `/api/match-reports`, not directly to official matches.
- `LeaderboardPage` reads backend-computed ranking rows.
- `PlayerDetailPage` reads backend player stats and rating history.
- `WinLosePointsPage` reads backend-computed win/loss points.

### Navigation and Routes

Updated:

```text
src/main.jsx
src/App.jsx
src/components/Navbar.jsx
```

Behavior:

- App is wrapped in `AuthProvider`.
- Business routes require login.
- Admin pages require admin role.
- Navbar shows:
  - Match data
  - Players
  - Submit match
  - Rating leaderboard
  - Win/loss leaderboard
  - Admin review/data pages for admins only
  - Current username
  - Logout button

### Styles

Updated:

```text
src/styles.css
```

Added styles for:

- Login layout.
- Account settings card.
- Form stacks.
- Success/error boxes.
- Navbar logout button.

## Important Behavior Notes

### Historical Data Ownership

Historical matches are owned through `Player`, not through `User`.

If a historical match has:

```json
{
  "leftPlayerId": "old-player-id-for-jack"
}
```

Then any user account with:

```json
{
  "playerId": "old-player-id-for-jack"
}
```

will be considered Jack's account for those historical records.

### Normal Historical Players

For any imported historical player:

1. Admin opens Players page.
2. Finds that historical player.
3. Clicks account setup.
4. Enters username/password.
5. Backend creates a user bound to that player.
6. The player logs in and sees their historical data.

### Seeded Admin Users

For `Jack` and `Johnny`:

1. Admin imports historical JSON.
2. Admin opens Players page.
3. Finds historical player Jack.
4. Sets username to `Jack`.
5. Password can be left blank if only binding the existing seeded user.
6. Backend binds existing admin user `Jack` to that historical player.
7. Jack remains an admin and also has player identity.

Same process for Johnny.

## Verification Performed

Backend:

- Installed dependencies with `npm.cmd install`.
- Ran Prisma migration:

```powershell
cd backEnd
npm.cmd run prisma:migrate -- --name init
```

- Seeded admin users.
- Verified backend module import:

```text
backend app import ok
```

- Verified HTTP health/login:

```text
health=True; login=Jack:ADMIN
```

Frontend:

- Ran lint:

```powershell
npm.cmd run lint
```

Result:

```text
Passed
```

- Ran production build:

```powershell
npm.cmd run build
```

Result:

```text
Passed
```

## Run Instructions

Start backend:

```powershell
cd backEnd
npm.cmd run dev
```

Start frontend in another terminal:

```powershell
npm.cmd run dev
```

Default API base URL:

```text
http://localhost:4000/api
```

Frontend default API configuration:

```text
VITE_API_BASE_URL=http://localhost:4000/api
```

If no `VITE_API_BASE_URL` is set, frontend uses `http://localhost:4000/api`.

## Security Notes

- Local seed credentials are development defaults.
- Change default admin passwords before production.
- Do not commit real production `.env` files.
- `backEnd/.env` and SQLite database files are ignored by `.gitignore`.
- JSON import/export is admin-only.
- Player users cannot approve scores or import/export data.

## Changed Files Summary

Added major backend files:

```text
backEnd/package.json
backEnd/package-lock.json
backEnd/.env.example
backEnd/README.md
backEnd/prisma/schema.prisma
backEnd/prisma/seed.js
backEnd/prisma/migrations/...
backEnd/src/...
```

Added major frontend files:

```text
src/auth/AuthContext.jsx
src/auth/useAuth.js
src/lib/api.js
src/components/ProtectedRoute.jsx
src/pages/LoginPage.jsx
src/pages/AccountPage.jsx
src/pages/AdminReportsPage.jsx
src/pages/AdminDataPage.jsx
```

Updated major frontend files:

```text
src/main.jsx
src/App.jsx
src/components/Navbar.jsx
src/pages/MatchesPage.jsx
src/pages/PlayersPage.jsx
src/pages/NewMatchPage.jsx
src/pages/LeaderboardPage.jsx
src/pages/PlayerDetailPage.jsx
src/pages/WinLosePointsPage.jsx
src/styles.css
```

Updated config/files:

```text
.gitignore
eslint.config.js
src/data/store.js
```

## Current Status

The app now has:

- Backend database.
- Login and registration.
- Admin/player roles.
- Historical JSON import/export for admins.
- Player account setup for imported historical players.
- Existing user binding for seeded admin accounts.
- Match score reporting and admin approval.
- Official matches only after approval.
- Rankings and stats computed from backend official matches using the original calculation logic.

