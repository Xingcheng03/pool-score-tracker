# Pool Score Tracker

A full-stack pool (billiards) score tracker for a casual / semi-competitive club.
Members record their matches; the app maintains a Fargo-lite style rating
("street lamp leaderboard"), win/loss points, a hall of shame, historical
(retired) players, and an admin review queue for submitted scores.

---

## 1. Features

- **Match reporting** — players submit match scores; admins approve or reject them.
- **Leaderboard** — Fargo-lite rating plus win/loss points ("street lamp leaderboard").
- **Players** — per-player detail pages with stats, opponents, and match history.
- **Hall of shame** — tracks notable losses.
- **Historical players** — retired-player records kept out of the active roster.
- **Admin review** — pending match-report approval workflow with an audit log.
- **Bilingual UI** — English and Simplified Chinese via `src/lib/i18n.jsx`.
- **JWT auth** — role-based access (admin / player).

---

## 2. Tech Stack

```
React + Vite frontend  ──(JWT)──►  Express backend  ──►  Prisma + Postgres/SQLite
```

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, React Router |
| Backend | Express, Prisma ORM |
| Database | PostgreSQL (Supabase) in production, SQLite for local dev |
| Auth | JWT + bcrypt |

---

## 3. Setup and Usage

### 3.1 Prerequisites

- **Node.js** ≥ 20 (verify with `node -v`)
- **npm** ≥ 10 (comes with Node)
- The repo ships with a SQLite database (`backEnd/prisma/dev.db`) and a full JSON
  backup, so **no external database is required** to run locally.

### 3.2 Clone and install dependencies

```bash
git clone <this-repo-url>
cd pool-score-tracker

# 1) Install frontend dependencies (run from the repo root)
npm install

# 2) Install backend dependencies
cd backEnd
npm install
cd ..
```

### 3.3 Configure the backend

Create a file called `.env` inside the `backEnd/` folder. You can copy
`backEnd/.env.example` and edit it. For a fully local run, use:

```env
# Database — keep these two lines as-is to use the bundled SQLite dev DB
DATABASE_URL="file:./dev.db"
DIRECT_URL="file:./dev.db"

# Backend
PORT=4000
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173"
```

> **Security note**: never commit `.env`.

### 3.4 Initialize the database (first time only)

```bash
cd backEnd
npx prisma generate                    # generate Prisma client
npx prisma migrate deploy              # apply existing migrations to the SQLite file
npm run seed                           # create default admin + sample players
# Optional: load the included historical match history
npm run db:import:backup
cd ..
```

If you prefer Postgres, replace `DATABASE_URL` / `DIRECT_URL` in `.env` with your
Postgres connection strings and run `npx prisma db push` to sync the schema.

### 3.5 Run the backend

Open a terminal in the **repo root** and run:

```bash
cd backEnd
npm run dev
```

You should see the backend listening on `http://localhost:4000`. Leave this
terminal running.

### 3.6 Run the frontend

Open a **second terminal** in the repo root (do *not* `cd backEnd`) and run:

```bash
npm run dev
```

Vite will print a local URL, typically `http://localhost:5173`. Open it in your
browser.

### 3.7 Test account

Use the following pre-seeded account to log in and try the app:

| Field | Value |
|---|---|
| **Username** | `Jack` |
| **Password** | `Quixotejack7@` |

### 3.8 Build for production

```bash
# Build the frontend bundle (outputs to dist/)
npm run build

# Run the backend in production mode
cd backEnd
npm start
```

`vercel.json` in both the root and `backEnd/` is wired for Vercel deployment
(frontend as static, backend as serverless functions). Set the same environment
variables in the Vercel dashboard rather than in `.env`.

---

## 4. Project Layout

```
pool-score-tracker/
├── src/                       # React + Vite frontend
│   ├── pages/                 # Matches, Leaderboard, Players, Shame, etc.
│   ├── components/            # Navbar, ProtectedRoute, PageShell, ...
│   ├── lib/                   # api, apiCache, i18n
│   └── auth/                  # JWT-based auth context
├── backEnd/
│   ├── src/routes/            # auth, players, matches, leaderboard, shame, ...
│   ├── src/services/          # ranking, stats, match, player, shame, ...
│   └── prisma/                # schema + migrations + seed + JSON backup
├── doc/                       # documentation / report samples
└── README.md                  # this file
```
