# Pool Score Tracker Backend

This backend is independent from `project_plan.md`. It stores users, players, approved matches, pending match reports, and ranking data in a database.

## Setup

```bash
cd backEnd
npm install
npm run prisma:migrate -- --name init
npm run seed
npm run dev
```

Default local API:

```text
http://localhost:4000/api
```

## Admin-Only Data Import/Export

The JSON format is compatible with the current frontend `store.js` export:

```json
{
  "exportedAtISO": "...",
  "storageKey": "pool_tracker_v1",
  "players": [],
  "matches": [],
  "computed": {}
}
```

Import reads `players` and `matches`; `computed` is ignored because backend rankings are recalculated from approved matches.

```text
POST /api/data/import
GET  /api/data/export
```

Both routes require an admin bearer token.

## Account Rules

Players can register and later update their own username/password with `PATCH /api/auth/me`.

Imported historical players do not automatically get login accounts. An admin can bind or reset a player account:

```text
PUT /api/players/:id/account
```

Body:

```json
{
  "username": "player-login",
  "password": "new-password"
}
```

If `username` already exists and that user is not bound to another player, the backend binds that existing user to this historical player. This is how seeded admin users such as `Jack` and `Johnny` can be attached to their imported historical player records without creating duplicate accounts.

## Match Approval

Players submit match scores to `POST /api/match-reports`. These records do not affect rankings.

Admins approve or reject:

```text
POST /api/match-reports/:id/approve
POST /api/match-reports/:id/reject
```

Only approved reports are copied into the official `matches` table. Leaderboards and player stats read only official matches.
