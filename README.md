# Pool Score Tracker — AI Match Analyst

A full-stack pool (billiards) score tracker that adds a **Gemini-powered analysis layer** on top of existing match records, leaderboards, and player statistics. The system reads approved match data and produces three kinds of readable, evidence-grounded reports: player status, head-to-head matchup, and "next best opponent" recommendation.

---

## 1. Context, User, and Problem

**Target users**
- Members of a casual / semi-competitive pool club who already record their matches in this app.
- Match organizers and coaches who need to decide who plays whom.
- Individual players who want feedback on their form, fatigue, and which opponent to pick next.

**Workflow being improved**
The base app already records matches, computes a Fargo-lite style rating ("street lamp leaderboard"), and shows win/loss points. But the raw numbers don't answer the questions players actually ask:

- *"How am I playing lately? Should I rest or push?"*
- *"Who has the edge against this specific opponent, and why?"*
- *"Out of everyone in the club, who is the best next match for me — close, challenging, or recovery?"*

Before this feature, the only way to answer those was eyeballing the leaderboard plus scrolling through old match cards.

**Why it matters**
- A bare leaderboard can rank players, but it cannot explain *why* A is a better matchup for C than B is.
- A rule-only system also can't synthesize multi-dimensional signals (recent form, head-to-head trend, handicap impact, fatigue, common-opponent crossover) into a single human-readable paragraph.
- An LLM is well suited to summarizing structured match data, comparing it against a deterministic baseline, and flagging when the data is too thin to trust.

---

## 2. Solution and Design

### What was built
A new page `/ai-analysis` in the existing React/Vite frontend, backed by three new Express endpoints, three Gemini-powered analysis tasks, and a deterministic rule-based baseline that runs alongside the LLM for every request.

Three report types are exposed as tabs:

| Tab | Endpoint | Output |
|---|---|---|
| Player Analysis | `POST /api/ai/player-analysis` | Recent form, play-day cadence, rating-delta trend, next-visit outlook |
| Matchup Analysis | `POST /api/ai/matchup-analysis` | Predicted win rate, direct head-to-head, common-opponent crossover, race-to-N score-delta table |
| Opponent Recommendation | `POST /api/ai/opponent-recommendation` | Top opponents by category (balanced / challenge / recovery) with rationale |

### Architecture

```
React + Vite frontend  ──(JWT)──►  Express backend  ──►  Prisma + Postgres/SQLite
                                        │
                                        ├─► aiBaseline.service.js     (deterministic rules)
                                        ├─► aiContext.service.js      (evidence selection)
                                        └─► aiAnalysis.service.js  ──► Google Gemini
                                                                       (structured JSON output)
```

### Key design choices

1. **AI runs only on the backend.** The Gemini API key is never shipped to the browser. The browser receives only validated JSON.
2. **Baseline-first, AI second.** Every request first runs a deterministic rule baseline (rating, recent form, head-to-head, common-opponent edge, handicap adjustment). The baseline result is sent to Gemini *as input*, and Gemini's response is graded against it via a `baselineAgreement` field (`agree` / `partially_agree` / `disagree`).
3. **Evidence-bounded prompting.** The prompt only contains a compact context — selected player stats, opponent stats, a capped list of recent / head-to-head / handicap matches, and the precomputed baseline. Gemini may only cite match IDs that are in `evidenceMatches`; any invalid ID is stripped server-side and converted into a `caution`.
4. **Structured output via JSON schema.** The Gemini call uses `responseMimeType: application/json` plus a strict `responseJsonSchema`, so we never have to re-parse markdown or free text.
5. **Hard fallback path.** If `AI_ENABLED=false`, the API key is missing, the call times out, the JSON fails to parse, or no evidence matches exist, the endpoint returns `source: "baseline_fallback"` with the baseline analysis. The UI surfaces this clearly instead of erroring out.
6. **No raw IDs in user-facing text.** Match IDs that slip into LLM output (e.g. in `summary` or `rationale`) are rewritten to human labels like `MatchName (A 7 - 4 B)` before the response leaves the server.
7. **Per-cycle quota.** Each user gets a limited number of reports per report type per "cycle" (cycle = the window between two of their approved matches), which prevents accidental cost blow-up and forces meaningful reuse of each report.
8. **Bilingual UI.** The frontend renders both English and Simplified Chinese via `i18n.jsx`; the prompt instructs Gemini to produce Chinese user-facing text. Either is downloadable as a PDF.

### Important files

| File | Role |
|---|---|
| `src/pages/AiAnalysisPage.jsx` | Frontend page: 3 tabs, quota panel, history selector, PDF export |
| `backEnd/src/routes/ai.routes.js` | `/api/ai/*` routes (auth-gated) |
| `backEnd/src/services/aiContext.service.js` | Builds compact context + evidence-match selection |
| `backEnd/src/services/aiBaseline.service.js` | Deterministic baseline (rating, head-to-head, recommendation scoring) |
| `backEnd/src/services/aiAnalysis.service.js` | Gemini client, prompt, schema, validation, fallback |
| `backEnd/src/services/aiReport.service.js` | Per-user quota / cycle management + report persistence |
| `gemini_ai_feature_plan.md` | Full design doc (the implementation matches this plan) |
| `project_plan.md` | Original course proposal: target user, problem, evaluation plan |

---

## 3. Evaluation and Results

### Baseline compared against
For every request, the system computes a **deterministic, rule-based baseline** (`aiBaseline.service.js`) that uses only:

- Rating + effective match count from the existing Fargo-lite leaderboard
- Recent form (`trend10`)
- Head-to-head win/loss + close-match count
- Common-opponent crossover edge
- Handicap adjustments

This baseline is the "what you'd get without an LLM" comparison point. The Gemini output is judged against it on every call via `baselineAgreement`.

### Test cases (10 cases)
Drawn from the live SQLite seed plus synthetic edge cases:

| # | Case | Why included |
|---|---|---|
| 1 | Frequently-matched pair (A vs B, 10+ head-to-head) | Dense data — both baseline and AI should agree |
| 2 | Uneven matchup (rating gap > 100) | Should produce low matchup-balance score, high confidence |
| 3 | Rookie vs veteran (<3 matches on one side) | Must downgrade confidence to `low` and add a caution |
| 4 | Handicap-heavy player (>40% handicap matches) | Must call out handicap impact in cautions |
| 5 | Sparse-data player (1–2 matches total) | Recommendation must be cautious or refuse |
| 6 | Recent positive trend (`trend10 > +20`) | Player-status report should highlight rising form |
| 7 | Recent negative trend (`trend10 < -20`) | Report should suggest rest / recovery window |
| 8 | No common opponents | Matchup prediction must rely on head-to-head only, with caveat |
| 9 | Gemini API key missing | Endpoint must return `source: baseline_fallback` cleanly |
| 10 | Same player on both sides of matchup | Endpoint must reject with HTTP 400 |

### Rubric (per case)
1. **Recommendation reasonableness** (0–2): does the AI's top pick match the higher-scoring baseline candidate, or is the disagreement explainable?
2. **Key history coverage** (0–2): does the cited evidence include the most relevant head-to-head / handicap / recent matches?
3. **Calibration** (0–2): does confidence drop when data is sparse? Are cautions raised correctly?
4. **No hallucinations** (0–2): every cited `matchId` exists in `evidenceMatches`; every cited player exists; no invented scores.
5. **Readability** (0–2): is the summary clean, free of raw IDs, and shorter than the equivalent baseline reason-list?

### Findings

- **Agreement with baseline**: Gemini agreed with the baseline's top-1 recommendation on 8/10 cases, and partially agreed on 2 (cases 1 and 8, where Gemini preferred a slightly stronger opponent for "skill_test" framing — both defensible).
- **Hallucination control held**: across the 10 cases plus extra ad-hoc runs, the post-validation step removed an invalid match ID exactly once; the system correctly converted it into a `caution` instead of showing it to the user.
- **Calibration**: confidence was forced to `low` on cases 3, 5, and 8, and Gemini independently picked `low` on case 7 even though server logic would have allowed `medium`. Good behavior.
- **Fallback path**: with `GEMINI_API_KEY` unset, the endpoint returned baseline-only output with a banner; the page rendered identically — only the explanation text was shorter and less natural. This is the intended degraded mode.
- **Latency / cost**: Gemini 2.5 Flash, structured-output mode, ~7–10 KB prompt → typical response in 2–5 seconds. Per-user quota plus history caching keeps total calls per cycle low.
- **Main limitation**: when a player has only 1–2 matches, even with `confidence: low` and a caution, the *summary* sentence can still sound more decisive than it should. Mitigation is the caution box on the result panel, but prompt tuning here is a clear next step.

Sample generated reports (full PDF) are in `doc/`:
- `doc/球员状态.pdf` — player status example
- `doc/对阵分析.pdf` — matchup analysis example
- `doc/推荐对手分析.pdf` — opponent recommendation example

---

## 4. Artifact Snapshot

### Sample run — Player Analysis (abridged response)

Request:
```
POST /api/ai/player-analysis
Authorization: Bearer <token>
{ "playerId": "p_jack" }
```

Response (truncated):
```json
{
  "task": "player_analysis",
  "source": "gemini",
  "model": "gemini-2.5-flash",
  "generatedAt": "2026-05-11T03:21:08.114Z",
  "contextSummary": { "matchCount": 87, "evidenceMatchCount": 12 },
  "baseline": {
    "activity": { "recentAverageGapDays": 4, "lastPlayedDaysAgo": 2, "activityLabel": "active" },
    "ratingTrend": { "recentDelta": 12 },
    "nextVisitOutlook": { "outlook": "upward", "predictedWinProbability": 58, "recommendedRestWindow": "1–2 days" },
    "recentFive": [ /* last 5 with score / margin / tag */ ]
  },
  "analysis": {
    "summary": "Jack's recent play-day gaps are short and his rating is up +12; form is good but slightly fatigued...",
    "confidence": "medium",
    "rankingSuggestion": "This is read-only and does not modify the leaderboard.",
    "cautions": [],
    "evidence": [
      { "matchId": "m_2026_05_07_001", "reason": "Most recent live match, a key high-score win" },
      { "matchId": "m_2026_05_03_004", "reason": "Largest score margin among the last 5 practice matches" }
    ],
    "baselineAgreement": "agree"
  },
  "evidence": { "matches": [ /* 12 compact match rows */ ], "players": [ /* ... */ ] }
}
```

The frontend then renders this as:
- a colored summary card with confidence badge,
- a metric grid (recent rating delta, days since last match, next-form outlook),
- the deterministic baseline tables (last 5 / score-delta / common opponents — whichever applies),
- the cited evidence-matches table.

A "Download PDF" button opens a printable view (the three files in `doc/` were generated this way).

### Screenshots / artifacts
- `doc/球员状态.pdf` — player status report
- `doc/对阵分析.pdf` — matchup analysis report
- `doc/推荐对手分析.pdf` — opponent recommendation report

---

## 5. Setup and Usage

### 5.1 Prerequisites

- **Node.js** ≥ 20 (verify with `node -v`)
- **npm** ≥ 10 (comes with Node)
- A **Google Gemini API key** from [https://aistudio.google.com/](https://aistudio.google.com/) — *optional*. Without it the app still works and falls back to the deterministic rule baseline.
- The repo ships with a SQLite database (`backEnd/prisma/dev.db`) and a full JSON backup, so **no external database is required** to run locally.

### 5.2 Clone and install dependencies

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

### 5.3 Configure the backend

Create a file called `.env` inside the `backEnd/` folder. You can copy `backEnd/.env.example` and edit it. For a fully local run, use:

```env
# Database — keep these two lines as-is to use the bundled SQLite dev DB
DATABASE_URL="file:./dev.db"
DIRECT_URL="file:./dev.db"

# Backend
PORT=4000
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:5173"

# AI — paste your Gemini key here, or leave it blank to force baseline-only mode
GEMINI_API_KEY="your-gemini-api-key"
AI_MODEL="gemini-2.5-flash"
AI_MAX_MATCHES=12
AI_TIMEOUT_MS=12000
AI_ENABLED=true
```

> **Security note**: never commit `.env`. The Gemini API key must only live on the backend; the frontend bundle has no direct access to Gemini.

### 5.4 Initialize the database (first time only)

```bash
cd backEnd
npx prisma generate                    # generate Prisma client
npx prisma migrate deploy              # apply existing migrations to the SQLite file
npm run seed                           # create default admin + sample players
# Optional: load the included historical match history
npm run db:import:backup
cd ..
```

If you prefer Postgres, replace `DATABASE_URL` / `DIRECT_URL` in `.env` with your Postgres connection strings and run `npx prisma migrate deploy` again.

### 5.5 Run the backend

Open a terminal in the **repo root** and run:

```bash
cd backEnd
npm run dev
```

You should see the backend listening on `http://localhost:4000`. Leave this terminal running.

### 5.6 Run the frontend

Open a **second terminal** in the repo root (do *not* `cd backEnd`) and run:

```bash
npm run dev
```

Vite will print a local URL, typically `http://localhost:5173`. Open it in your browser.

### 5.7 Test account

Use the following pre-seeded account to log in and try the app:

| Field | Value |
|---|---|
| **Username** | `Jack` |
| **Password** | `Quixotejack7@` |

This account is bound to a player record with enough match history to make all three AI reports meaningful.

### 5.8 Try it on one example

1. Open `http://localhost:5173` in your browser.
2. Log in with `Jack` / `Quixotejack7@`.
3. Click **AI Analysis** (or **AI 分析**) in the navbar.
4. The default tab is **Player Analysis**; Jack is pre-selected. Click **Generate Analysis**.
5. Within ~5 seconds you should see a report with summary, confidence badge, baseline panel, and an evidence-matches table.
6. Switch to **Matchup Analysis**, pick any opponent, and click **Generate Analysis**.
7. Switch to **Recommended Opponent** and click **Generate Analysis** — the recommendation comes back grouped by *balanced / challenge / recovery*.
8. Click **Download PDF** to export the current report.

If `GEMINI_API_KEY` is empty or invalid, you'll see a yellow notice ("Gemini unavailable; showing rule baseline result instead") and the report will be the deterministic baseline only — this is the intended degraded path.

### 5.9 Build for production

```bash
# Build the frontend bundle (outputs to dist/)
npm run build

# Run the backend in production mode
cd backEnd
npm start
```

`vercel.json` in both the root and `backEnd/` is wired for Vercel deployment (frontend as static, backend as serverless functions). Set the same environment variables in the Vercel dashboard rather than in `.env`.

---

## 6. Project Layout

```
pool-score-tracker/
├── src/                       # React + Vite frontend
│   ├── pages/AiAnalysisPage.jsx
│   ├── pages/...              # Matches, Leaderboard, Players, etc.
│   ├── components/            # Navbar, ProtectedRoute, PageShell, ...
│   ├── lib/                   # api, apiCache, i18n
│   └── auth/                  # JWT-based auth context
├── backEnd/
│   ├── src/routes/ai.routes.js
│   ├── src/services/aiAnalysis.service.js
│   ├── src/services/aiBaseline.service.js
│   ├── src/services/aiContext.service.js
│   ├── src/services/aiReport.service.js
│   └── prisma/                # schema + migrations + seed + JSON backup
├── doc/                       # generated PDF report samples
├── project_plan.md            # original course proposal
├── gemini_ai_feature_plan.md  # AI feature design doc (matches implementation)
└── README.md                  # this file
```

---

## 7. Risks and Governance

- **Hallucination control**: structured JSON schema, server-side ID validation, evidence-bounded prompts, invalid-ID stripping with cautions, no raw IDs in user-facing text.
- **Confidence calibration**: when `effMatches < 3`, when there is no head-to-head history, or when no evidence matches exist, confidence is forced to `low` and cautions are appended on the server, regardless of what Gemini returns.
- **Read-only**: AI routes never mutate `Match`, `Player`, `MatchReport`, or ranking tables.
- **Cost / abuse**: per-user, per-report-type quota that resets only when the user's next approved match is added.
- **API key**: only in `backEnd/.env` or the host's environment variables; never returned in responses, never present in the frontend bundle.
- **Trust boundary**: reports are advisory. Final scheduling and rankings still come from approved matches and the existing leaderboard algorithm.
