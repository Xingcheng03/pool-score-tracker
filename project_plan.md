# Project Plan

## 1. Project Title

AI Match Analyst: Player Ranking and Opponent Recommendation for Pool

## 2. Target User, Workflow, and Business Value

Target user
- Pool club managers, match organizers, player coaches, or competitive players.

Improved workflow
- Extract head-to-head history and performance from recorded match data to generate a strength comparison between two players.
- Recommend the next best opponent for a chosen player.
- Provide ranking suggestions based on recent match history to support scheduling and matchmaking.

Workflow start and end
- Start: the user selects a player or player matchup from existing recorded match data.
- End: the system outputs opponent recommendations, head-to-head advantage analysis, and ranking guidance based on match history.

Why it matters
- The current app only shows basic statistics and leaderboards.
- AI analysis can combine multiple factors such as performance trends, direct match history, win rate, recent form, and handicap effects to produce a more useful recommendation.
- That helps reduce reliance on intuition when arranging matches, schedule practice sessions, and choose strategic opponents.

## 3. Problem Statement and GenAI Fit

Task statement
- This system will analyze historical pool match data and produce intelligent recommendations for player strength comparison, head-to-head trends, and the next best opponent.

Why this fits GenAI
- The task requires synthesizing multiple match records into human-readable conclusions and explaining why a particular opponent is recommended.
- A large language model is well suited for summarizing results, reasoning about trends, and generating structured recommendations with explanations.
- Compared to raw statistics, an LLM can describe factors like win rate, recent form, handicaps, match format differences, and repeated meetings with the same opponent.

Why a simpler tool is not enough
- A basic stats dashboard can show rankings but cannot easily answer “why is A a better matchup for C than B?”.
- A rule-based system struggles to cover multi-dimensional cases and does not produce clear, readable rationale.

## 4. Planned System Design and Baseline

Proposed architecture
- Keep the existing React/Vite frontend and local data storage. Add an “AI analysis” page or module.
- For a single player, retrieve historical results, win rate, recent performance, handicap records, and opponent win/loss relationships.
- For two players, retrieve their head-to-head history, win/loss cycles, and recent match outcomes.
- Use a prompt template to ask the LLM for “strength comparison / key advantage / recommendation reason / next opponent recommendation” and return JSON-formatted results.
- Optionally: send the most relevant 5-10 match records as retrieval context in a RAG-style prompt.

Design details
- Data: use existing `matches` and `players` data filtered by player or matchup.
- Prompt: use a clear system + user prompt with behavior instructions and structured output constraints.
- Output schema: e.g. `{ rankingSummary, headToHead, recommendedOpponent, rationale, confidence }`.
- UI: allow users to choose “player analysis,” “matchup analysis,” or “recommend opponent”; display conclusions, explanations, and related match highlights.

Course concepts to integrate
- Model/provider selection: compare high-quality models and lightweight models, balancing cost and latency. For example, use `gpt-4o-mini` for routine suggestions and `gpt-4.1` for key comparison analysis.
- Prompt and output constraints: use system prompts, few-shot examples, and JSON schema to enforce structured output and reduce noisy responses.
- Retrieval-augmented generation (RAG): retrieve relevant match fragments from local data by player, opponent, and date, and send them as context to the model.
- Evaluation design: build a rule-based baseline, create test cases, and compare model output against the baseline.

Simpler baseline
- The baseline will be rule-driven, using metrics such as win rate, recent form, head-to-head win ratio, and score margin over the last 5 matches.
- Compare whether AI analysis gives a more reasonable recommendation, whether the explanation is more persuasive, and whether AI captures insights missed by the rule baseline.

App description
- From the existing `Leaderboard` or `Players` page, the user can click an “AI analysis” button.
- The user selects one player or a pair of players.
- The system shows “AI strength comparison + head-to-head analysis + opponent recommendation + ranking adjustment suggestion.”
- The user can compare the AI recommendation with the baseline rule recommendation and review the key match summaries used by the model.

## 5. Evaluation Plan

Success looks like
- The system provides opponent recommendations that are reasonable and explained clearly.
- The results align better with actual match trends than a simple rule-based baseline.
- The user can understand the AI conclusions and know when to review them manually.

What to measure
- Accuracy: whether the AI recommendation matches historical results and head-to-head trends.
- Explanation quality: whether the recommendation reason is clear and cites key match factors.
- Refusal/caution behavior: whether the system correctly says “cannot decide” when data is insufficient.
- Latency and cost: average model call delay and token cost per analysis.
- Baseline comparison: whether AI and the rule baseline agree, and in which cases AI provides a better decision.

Test set size and source
- 10–15 test cases including:
  - analysis of two frequently matched players;
  - a clearly uneven matchup;
  - a rookie vs veteran pairing;
  - matches with handicaps;
  - sparse or no head-to-head histories.
- The data can be generated from existing local sample data or created manually as 10–15 synthetic match histories.

How to compare
- Run each test case through the AI system and the rule-based baseline.
- Record both recommendations and explanations.
- Score them on “recommendation reasonableness,” “key history coverage,” and “avoidance of overcommitment.”
- Present 5–8 comparison tables in the final report.

## 6. Example Inputs and Failure Cases

Example inputs
1. Analyze players A and B who often compete and explain who has the advantage and why.
2. For player A, recommend the next best opponent and explain whether the choice is to maximize win probability, test skill, or avoid a tough matchup.
3. Analyze matches that include handicaps and determine whether the handicap changed the win/loss trend.
4. Generate a season ranking recommendation and compare it with the current leaderboard.
5. For a new player with little history, return a cautious message such as “insufficient data, suggest a practice match first.”

Likely failure cases
- Insufficient data: if a player has only 1–2 matches, the model may be overly confident.
- Model hallucination: the LLM may invent matches that did not occur or misinterpret existing data.
- Overly complex recommendations: if the recommendation does not explain scheduling or match balance, it may be judged untrustworthy.
- Data quality issues: incorrect scores or duplicate records can distort analysis.

## 7. Risks and Governance

Where the system can fail
- AI analysis is unreliable when historical data is sparse.
- The model can amplify abnormal or noisy match results.
- The model may present overly certain conclusions without proper confidence.

Trust boundaries
- The system should only provide advice, not decide the final schedule.
- Opponent recommendations must be manually reviewed, especially for important matches.
- Ranking suggestions should be treated as reference only; official standings remain based on actual match outcomes and referee standards.

Controls
- Add an “explanation + evidence” section to help users understand the model’s conclusion.
- Display a clear caution when data is insufficient: e.g. “insufficient data, recommend collecting more match records.”
- Do not allow the model to directly modify match data; only display analysis results.
- Document in README/app that API keys must not be committed and should be loaded from environment variables.

Data and cost considerations
- Use local records or synthetic sample data only; do not include real personal data.
- Keep match data in local JSON/localStorage.
- Prefer free or low-cost models to avoid high usage fees.
- If using OpenAI API, only send non-sensitive match summaries and avoid exposing personal details.

## 8. Plan for the Week 6 Check-in

Week 6 goals
- Build a working AI analysis page where the user can select players or matchups and view model analysis results.
- Implement a simple rule-based baseline and show “AI recommendation vs baseline recommendation” in the UI.
- Prepare at least 5 test cases and document initial evaluation results.

Expected deliverables
- Working front-end page with local sample data.
- AI features: player strength comparison and opponent recommendation.
- Evaluation: a comparison table showing AI vs baseline for 5 representative cases.

## 9. (Optional) Pair request

I plan to complete this project individually and do not request a partner.
