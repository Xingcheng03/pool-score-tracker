# Gemini AI Feature Implementation Plan

## 1. Goal

Add an AI Match Analyst feature to the pool score tracker app using the Google Gemini API.

The feature should help users:

- Analyze a player's recent form and strength.
- Compare two players based on head-to-head history and ranking data.
- Recommend a suitable next opponent.
- Explain recommendations with concrete match evidence.
- Compare Gemini analysis with a deterministic rule-based baseline.

The AI feature should not replace the existing ranking logic. It should explain and summarize the existing statistics, recent match history, head-to-head records, and handicap effects.

## 2. Revised Architecture

The current project already has:

- React/Vite frontend.
- Express backend.
- Prisma database layer.
- Auth-protected API routes.
- Existing ranking and player statistics services.

Therefore, the AI feature should be implemented through the backend, not directly in the frontend.

Recommended flow:

1. The user opens the AI analysis page in the frontend.
2. The user selects a player, a matchup, or an opponent recommendation mode.
3. The frontend calls a backend AI API route.
4. The backend retrieves relevant players, matches, ranking rows, recent form, head-to-head records, and handicap data.
5. The backend computes a rule-based baseline.
6. The backend sends compact structured context to Gemini.
7. Gemini returns structured JSON.
8. The frontend renders AI analysis, baseline comparison, confidence, cautions, and evidence matches.

API keys must only exist on the backend. The frontend must never receive or expose the Gemini API key.

## 3. Model and Provider

Provider:

- Google Gemini API

Recommended default model:

- `gemini-2.5-flash`

Optional models:

- `gemini-2.5-flash-lite` for lower cost and faster routine analysis.
- `gemini-2.5-pro` for more complex matchup reasoning if needed.

For the MVP, use `gemini-2.5-flash` because it supports structured outputs and should be strong enough for player analysis, matchup comparison, and recommendation explanations.

Backend dependency:

```bash
cd backEnd
npm install @google/genai
```

Environment variables:

```env
GEMINI_API_KEY=your_api_key_here
AI_MODEL=gemini-2.5-flash
AI_MAX_MATCHES=12
```

## 4. Backend Implementation Plan

Add the following backend files:

- `backEnd/src/routes/ai.routes.js`
- `backEnd/src/services/aiAnalysis.service.js`
- `backEnd/src/services/aiBaseline.service.js`

Update:

- `backEnd/src/app.js`
- `backEnd/src/config/env.js`

New API routes:

```text
POST /api/ai/player-analysis
POST /api/ai/matchup-analysis
POST /api/ai/opponent-recommendation
```

All routes should use `requireAuth`.

### Backend Responsibilities

The backend should:

- Validate request inputs.
- Load match and player data through existing services.
- Reuse existing ranking/statistics logic when possible.
- Build a compact evidence package.
- Compute a deterministic baseline recommendation.
- Call Gemini with structured output enabled.
- Validate Gemini JSON before returning it.
- Return a useful fallback response if Gemini fails.

The backend should not:

- Send the full database to Gemini.
- Let Gemini modify match data.
- Trust Gemini output without validation.
- Expose the API key to the frontend.

## 5. Structured Retrieval Instead of Full RAG

For the MVP, do not add a vector database or embedding search.

The project data is already structured, so retrieval can be deterministic:

- Recent matches for a selected player.
- Head-to-head matches for two selected players.
- Ranking rows from the existing leaderboard logic.
- Handicap matches involving the selected player.
- Season-filtered records.
- Opponent records and win/loss relationships.

Send only the most relevant match records to Gemini, usually 5 to 12 records.

This is simpler, cheaper, and easier to evaluate than full vector RAG.

## 6. Baseline Recommendation Logic

The baseline should be rule-based and deterministic.

Suggested baseline inputs:

- Current rating.
- Effective match count.
- Rack win rate.
- Recent 10-match trend.
- Head-to-head win/loss ratio.
- Recent head-to-head result.
- Live vs practice performance.
- Handicap-adjusted outcomes.
- Match count confidence.

Suggested baseline outputs:

```json
{
  "recommendedOpponentId": "",
  "strengthScore": 0,
  "recentFormScore": 0,
  "headToHeadScore": 0,
  "matchupBalanceScore": 0,
  "confidence": "low",
  "reasons": [],
  "evidenceMatchIds": []
}
```

The AI should explain the baseline and add human-readable reasoning. It should not replace the baseline.

## 7. Gemini Output Schema

Gemini should return structured JSON.

Recommended schema:

```json
{
  "summary": "",
  "confidence": "low",
  "recommendedOpponent": {
    "playerId": "",
    "reason": "",
    "goal": "balanced_match"
  },
  "headToHead": {
    "advantagePlayerId": "",
    "rationale": ""
  },
  "rankingSuggestion": "",
  "cautions": [],
  "evidence": [
    {
      "matchId": "",
      "reason": ""
    }
  ],
  "baselineAgreement": "agree"
}
```

Allowed values:

- `confidence`: `low`, `medium`, `high`
- `goal`: `balanced_match`, `skill_test`, `easier_match`
- `baselineAgreement`: `agree`, `partially_agree`, `disagree`

The app should validate that returned player IDs and match IDs actually exist in the evidence package.

## 8. Frontend Implementation Plan

Add:

- `src/pages/AiAnalysisPage.jsx`

Update:

- `src/App.jsx`
- `src/components/Navbar.jsx`
- optionally `src/pages/LeaderboardPage.jsx`
- optionally `src/pages/PlayerDetailPage.jsx`

Frontend views:

- Player analysis tab.
- Matchup analysis tab.
- Opponent recommendation tab.

UI should show:

- AI summary.
- Recommended opponent.
- Confidence.
- Cautions.
- Head-to-head advantage.
- Ranking suggestion.
- Baseline recommendation.
- Evidence matches used by the model.

The frontend should handle:

- Loading state.
- Gemini/backend error state.
- Insufficient data state.
- Empty player/match state.

## 9. Prompt Design

The Gemini prompt should be strict and evidence-based.

Key instructions:

- Use only the provided match and player data.
- Do not invent matches, players, scores, or rankings.
- If data is insufficient, say confidence is low.
- Explain recommendations using match IDs or evidence summaries.
- Compare your conclusion with the baseline.
- Return only JSON matching the schema.

The prompt should include:

- Task type.
- Selected player or matchup.
- Baseline result.
- Relevant leaderboard rows.
- Recent matches.
- Head-to-head records.
- Handicap notes.
- Output schema requirements.

## 10. Evaluation Plan

Use 10 to 15 test cases if time allows. For Week 6 MVP, at least 5 representative cases are enough.

Required test cases:

- Two players with frequent head-to-head history.
- A clearly uneven matchup.
- A rookie or sparse-data player.
- A player with recent improvement or decline.
- A matchup affected by handicap records.

Metrics:

- Recommendation reasonableness.
- Whether the explanation cites correct evidence.
- Whether confidence is appropriately low for sparse data.
- Whether the AI agrees or disagrees with the baseline for understandable reasons.
- Latency and rough cost per analysis.

Evaluation table columns:

- Test case.
- Baseline recommendation.
- Gemini recommendation.
- Agreement.
- Evidence quality.
- Confidence quality.
- Notes.

## 11. Risk Controls

Main risks:

- Gemini may overstate confidence.
- Gemini may hallucinate if the prompt is too loose.
- Sparse data may produce misleading recommendations.
- Long match history may increase cost and latency.

Controls:

- Use structured output.
- Keep context compact.
- Validate returned IDs.
- Display evidence matches.
- Display confidence and cautions.
- Force low confidence when match count is too small.
- Keep AI analysis read-only.

## 12. MVP Scope

The MVP should include:

- Backend Gemini integration.
- One AI analysis page.
- Player analysis.
- Matchup analysis.
- Opponent recommendation.
- Rule-based baseline.
- Structured JSON output.
- 5 evaluation cases.

Defer until later:

- Vector database RAG.
- Chat-style AI assistant.
- Automatic schedule generation.
- AI-modified rankings.
- Long-term AI result storage.
- Streaming responses.

## 13. Final Positioning

The AI Match Analyst should be described as:

> A Gemini-powered explanation and recommendation layer that uses existing pool match records, leaderboard statistics, recent form, head-to-head history, and handicap-aware baseline logic to generate readable player analysis and opponent recommendations.

This positioning is realistic for the current codebase and easier to implement, evaluate, and defend in a course project.
