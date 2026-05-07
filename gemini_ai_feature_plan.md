# Gemini AI Feature Implementation Plan

## 1. 功能定位

本功能命名为 **AI Match Analyst**。

它的作用不是重新计算排行榜，也不是自动修改比赛、自动安排赛程，而是在现有比赛数据和排行榜逻辑之上，增加一个只读的 AI 分析层。

用户可以用它完成三件事：

1. **球员状态分析**
   - 选择一个球员。
   - 系统读取该球员最近比赛、胜率、局胜率、Rating 趋势、直播/练习赛表现、放门比赛影响。
   - AI 输出可读解释：最近状态如何、强项是什么、风险是什么、数据是否足够可信。

2. **两名球员对阵分析**
   - 选择两个球员。
   - 系统读取双方排行榜数据、历史交手、最近交手、比分差距、放门记录。
   - AI 输出谁更占优、为什么、这场是否接近、是否受放门影响。

3. **推荐下一个对手**
   - 选择一个球员和推荐目标。
   - 推荐目标包括：
     - `balanced_match`：实力接近，适合胶着对局。
     - `skill_test`：稍强对手，适合挑战。
     - `easier_match`：稍弱对手，适合恢复状态或练习。
   - 系统先用规则 baseline 算出推荐，再让 Gemini 解释和补充。

一句话总结：

> AI Match Analyst 是一个基于现有台球比赛记录的智能分析和对手推荐助手，用 Gemini 把排行榜、近期状态、历史交手和放门影响解释成人能直接使用的建议。

## 2. 当前 App 架构判断

当前项目已经不是纯前端 localStorage 架构。

现有架构：

- 前端：React + Vite。
- 后端：Express。
- 数据库：Prisma。
- 认证：JWT bearer token。
- 已有数据服务：
  - `backEnd/src/services/stats.service.js`
  - `backEnd/src/services/ranking.service.js`
  - `backEnd/src/services/match.service.js`
  - `backEnd/src/services/player.service.js`
- 已有受保护 API：
  - `/api/players`
  - `/api/matches`
  - `/api/leaderboard`
  - `/api/leaderboard/players/:playerId/stats`

因此 AI 功能必须通过后端实现。

原因：

- Gemini API key 不能暴露给浏览器。
- 后端已经能读取正式比赛、球员、排行榜和统计数据。
- 后端可以复用现有 ranking/statistics 逻辑，避免前后端算法不一致。
- 后端可以验证 Gemini 返回的 playerId 和 matchId，降低幻觉风险。

## 3. MVP 范围

MVP 必须包含：

- 后端 Gemini 集成。
- 一个前端 AI 分析页面。
- 球员状态分析。
- 两名球员对阵分析。
- 对手推荐。
- 规则 baseline。
- Gemini 结构化 JSON 输出。
- Gemini 失败或未配置 API key 时的 baseline fallback。
- 证据比赛展示。
- 至少 5 个 evaluation cases。

MVP 暂不做：

- 向量数据库。
- embedding search。
- 聊天机器人。
- 自动排赛程。
- AI 修改排行榜。
- AI 修改比赛数据。
- 长期保存 AI 分析结果。
- streaming response。

## 4. 用户流程

### 4.1 AI 分析入口

前端新增页面：

```text
/ai-analysis
```

导航栏新增入口：

```text
AI 分析
```

该页面需要登录后访问，和现有 `/matches`、`/players`、`/leaderboard` 一样走 `ProtectedPage`。

### 4.2 页面结构

`AiAnalysisPage.jsx` 使用三个 tab：

1. `球员分析`
2. `对阵分析`
3. `推荐对手`

页面公共筛选项：

- 赛季：
  - `all`
  - 后端 `/leaderboard/seasons` 返回的 season id
- 比赛范围：
  - `all`
  - `practice`
  - `live`

### 4.3 球员分析流程

用户操作：

1. 选择一个球员。
2. 选择赛季和比赛范围。
3. 点击“生成分析”。

前端请求：

```text
POST /api/ai/player-analysis
```

请求 body：

```json
{
  "playerId": "player_id",
  "seasonId": "all",
  "mode": "all"
}
```

页面展示：

- AI summary。
- confidence。
- player strength summary。
- recent form。
- live/practice difference。
- handicap cautions。
- baseline summary。
- evidence matches table。

### 4.4 对阵分析流程

用户操作：

1. 选择 player A。
2. 选择 player B。
3. 选择赛季和比赛范围。
4. 点击“分析对阵”。

前端请求：

```text
POST /api/ai/matchup-analysis
```

请求 body：

```json
{
  "playerId": "player_a_id",
  "opponentId": "player_b_id",
  "seasonId": "all",
  "mode": "all"
}
```

页面展示：

- head-to-head advantage。
- ranking comparison。
- recent matchup trend。
- whether the matchup is balanced。
- cautions。
- evidence matches table。

### 4.5 推荐对手流程

用户操作：

1. 选择目标球员。
2. 选择推荐目标：
   - balanced match
   - skill test
   - easier match
3. 选择赛季和比赛范围。
4. 点击“推荐对手”。

前端请求：

```text
POST /api/ai/opponent-recommendation
```

请求 body：

```json
{
  "playerId": "player_id",
  "goal": "balanced_match",
  "seasonId": "all",
  "mode": "all"
}
```

页面展示：

- recommended opponent。
- recommendation goal。
- baseline recommendation。
- whether Gemini agrees with baseline。
- why this opponent fits。
- other candidate notes。
- evidence matches table。

## 5. 后端实施计划

### 5.1 安装依赖

在后端安装 Google GenAI SDK：

```bash
cd backEnd
npm install @google/genai
```

不需要数据库 migration。

### 5.2 环境变量

更新：

```text
backEnd/.env.example
backEnd/src/config/env.js
```

新增 env：

```env
GEMINI_API_KEY="your_api_key_here"
AI_MODEL="gemini-2.5-flash"
AI_MAX_MATCHES=12
AI_TIMEOUT_MS=12000
AI_ENABLED=true
```

`env.js` 新增字段：

```js
geminiApiKey: process.env.GEMINI_API_KEY ?? "",
aiModel: process.env.AI_MODEL ?? "gemini-2.5-flash",
aiMaxMatches: Number(process.env.AI_MAX_MATCHES ?? 12),
aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 12000),
aiEnabled: process.env.AI_ENABLED !== "false",
```

### 5.3 新增后端文件

新增：

```text
backEnd/src/routes/ai.routes.js
backEnd/src/services/aiAnalysis.service.js
backEnd/src/services/aiBaseline.service.js
backEnd/src/services/aiContext.service.js
```

文件职责：

- `ai.routes.js`
  - 定义 `/api/ai/*` 路由。
  - 使用 `requireAuth`。
  - 做基本 request body 校验。
  - 调用 service。

- `aiContext.service.js`
  - 从现有 stats/ranking service 读取数据。
  - 构造给 baseline 和 Gemini 使用的 compact context。
  - 负责 recent matches、head-to-head matches、leaderboard rows、handicap notes。

- `aiBaseline.service.js`
  - 实现 deterministic baseline。
  - 不调用 AI。
  - 输出稳定、可复现的推荐和评分。

- `aiAnalysis.service.js`
  - 调用 baseline。
  - 调用 Gemini。
  - 提供 fallback。
  - 验证 Gemini 返回 JSON。
  - 返回前端统一结构。

### 5.4 修改后端入口

更新：

```text
backEnd/src/app.js
```

新增 import：

```js
import { aiRouter } from "./routes/ai.routes.js";
```

新增 route：

```js
app.use("/api/ai", aiRouter);
```

建议放在 `/api/data` 前后均可，但必须在 `notFound` 之前。

## 6. 后端 API 设计

### 6.1 公共规则

所有 AI routes 必须：

- 使用 `requireAuth`。
- 只读取正式比赛表 `Match`。
- 不创建、不更新、不删除比赛数据。
- 不把 Gemini API key 返回给前端。
- 不把完整数据库发送给 Gemini。
- 对返回 ID 做业务验证。

公共 request 字段：

```json
{
  "seasonId": "all",
  "mode": "all"
}
```

字段约束：

- `seasonId`：
  - 默认 `all`
  - 允许 `all` 或 `season-N`
- `mode`：
  - 默认 `all`
  - 允许 `all`、`practice`、`live`

### 6.2 POST /api/ai/player-analysis

Request：

```json
{
  "playerId": "string",
  "seasonId": "all",
  "mode": "all"
}
```

Validation：

- `playerId` 必填。
- player 必须存在。

Response：

```json
{
  "task": "player_analysis",
  "source": "gemini",
  "model": "gemini-2.5-flash",
  "generatedAt": "2026-04-29T00:00:00.000Z",
  "contextSummary": {
    "seasonId": "all",
    "mode": "all",
    "playerCount": 20,
    "matchCount": 120,
    "evidenceMatchCount": 12
  },
  "baseline": {},
  "analysis": {
    "summary": "string",
    "confidence": "low",
    "playerForm": "string",
    "rankingSuggestion": "string",
    "cautions": [],
    "evidence": [],
    "baselineAgreement": "agree"
  },
  "evidence": {
    "matches": [],
    "players": []
  }
}
```

### 6.3 POST /api/ai/matchup-analysis

Request：

```json
{
  "playerId": "string",
  "opponentId": "string",
  "seasonId": "all",
  "mode": "all"
}
```

Validation：

- `playerId` 必填。
- `opponentId` 必填。
- 两个 id 不能相同。
- 两个 player 必须都存在。

Response：

```json
{
  "task": "matchup_analysis",
  "source": "gemini",
  "model": "gemini-2.5-flash",
  "generatedAt": "2026-04-29T00:00:00.000Z",
  "contextSummary": {},
  "baseline": {},
  "analysis": {
    "summary": "string",
    "confidence": "medium",
    "headToHead": {
      "advantagePlayerId": "string",
      "rationale": "string"
    },
    "rankingSuggestion": "string",
    "cautions": [],
    "evidence": [],
    "baselineAgreement": "partially_agree"
  },
  "evidence": {
    "matches": [],
    "players": []
  }
}
```

### 6.4 POST /api/ai/opponent-recommendation

Request：

```json
{
  "playerId": "string",
  "goal": "balanced_match",
  "seasonId": "all",
  "mode": "all"
}
```

Validation：

- `playerId` 必填。
- player 必须存在。
- `goal` 默认 `balanced_match`。
- `goal` 允许：
  - `balanced_match`
  - `skill_test`
  - `easier_match`

Response：

```json
{
  "task": "opponent_recommendation",
  "source": "gemini",
  "model": "gemini-2.5-flash",
  "generatedAt": "2026-04-29T00:00:00.000Z",
  "contextSummary": {},
  "baseline": {
    "recommendedOpponentId": "string",
    "goal": "balanced_match",
    "strengthScore": 0,
    "recentFormScore": 0,
    "headToHeadScore": 0,
    "matchupBalanceScore": 0,
    "confidence": "medium",
    "reasons": [],
    "evidenceMatchIds": []
  },
  "analysis": {
    "summary": "string",
    "confidence": "medium",
    "recommendedOpponent": {
      "playerId": "string",
      "reason": "string",
      "goal": "balanced_match"
    },
    "rankingSuggestion": "string",
    "cautions": [],
    "evidence": [],
    "baselineAgreement": "agree"
  },
  "evidence": {
    "matches": [],
    "players": []
  }
}
```

## 7. 数据构造计划

### 7.1 复用现有服务

`aiContext.service.js` 复用：

```js
import { getStatsData } from "./stats.service.js";
import {
  buildFargoLiteLeaderboardFromData,
  calcPlayerStats,
  filterMatchesBySeason,
  normalizeSeasonId,
} from "./ranking.service.js";
```

不直接重复排行榜算法。

### 7.2 基础 context 构造

公共函数：

```js
async function buildAiContext({ task, playerId, opponentId, seasonId, mode, goal })
```

返回：

```json
{
  "task": "player_analysis",
  "seasonId": "all",
  "mode": "all",
  "goal": "balanced_match",
  "players": [],
  "selectedPlayer": {},
  "opponent": {},
  "leaderboardRows": [],
  "selectedPlayerRow": {},
  "opponentRow": {},
  "selectedPlayerStats": {},
  "opponentStats": {},
  "recentMatches": [],
  "headToHeadMatches": [],
  "handicapMatches": [],
  "candidateRows": [],
  "evidenceMatches": []
}
```

### 7.3 Match evidence 格式

发送给 Gemini 的 match 不要包含无关字段。

推荐格式：

```json
{
  "id": "match_id",
  "dateISO": "2026-04-01T00:00:00.000Z",
  "matchName": "string",
  "tag": "practice",
  "raceTo": 7,
  "leftPlayerId": "string",
  "leftPlayerName": "string",
  "rightPlayerId": "string",
  "rightPlayerName": "string",
  "leftScore": 7,
  "rightScore": 4,
  "winnerId": "string",
  "winnerName": "string",
  "isHandicap": false,
  "handicapGiverId": null,
  "handicapGiverName": null,
  "handicapReceiverId": null,
  "handicapReceiverName": null
}
```

### 7.4 Evidence 选择规则

默认 `AI_MAX_MATCHES=12`。

球员分析 evidence：

- 最近 8 场该球员比赛。
- 最多 4 场放门比赛。
- 如果重复，按 match id 去重。
- 最终最多 12 场。

对阵分析 evidence：

- 两人 head-to-head 最近 12 场。
- 如果 head-to-head 少于 4 场，补充双方各自最近比赛，直到最多 12 场。

推荐对手 evidence：

- 目标球员最近 6 场。
- baseline 推荐对手最近 3 场。
- 两人历史交手最多 3 场。
- 最终最多 12 场。

排序：

- 默认按 `dateISO desc`。
- 同一天用 `id asc` 保证稳定。

### 7.5 Insufficient data 规则

后端必须提前识别数据不足：

- 目标球员有效比赛数 `< 3`：confidence 强制 `low`。
- matchup 两人没有任何 head-to-head：允许分析，但必须在 cautions 中说明。
- 推荐对手时候选球员少于 2：返回 fallback，说明无法推荐。
- evidence matches 数量为 0：不调用 Gemini，直接返回 baseline fallback。

## 8. Baseline 计划

### 8.1 Baseline 原则

baseline 必须：

- deterministic。
- 不调用 Gemini。
- 输入一样，输出必须一样。
- 能解释自己的推荐原因。
- 能在 Gemini 失败时单独支撑页面展示。

### 8.2 公共评分字段

每个候选球员 row 来自 `buildFargoLiteLeaderboardFromData`。

使用字段：

- `rating`
- `effMatches`
- `rackWinRate`
- `trend10`
- `liveRackWinRate`
- `pracRackWinRate`
- `confidence`

### 8.3 推荐对手 baseline

候选人：

- 排除目标球员自己。
- 排除 `effMatches <= 0` 的球员，除非所有候选都没有比赛。
- 根据 `mode` 使用对应 leaderboard。

基础计算：

```js
ratingDiff = candidate.rating - selected.rating
absoluteRatingDiff = Math.abs(ratingDiff)
```

分数建议：

```js
matchupBalanceScore = clamp(100 - absoluteRatingDiff * 2.5, 0, 100)
strengthScore = clamp(50 + ratingDiff * 2, 0, 100)
recentFormScore = clamp(50 + candidate.trend10 - selected.trend10, 0, 100)
candidateConfidenceScore = confidenceToScore(candidate.confidence)
```

`confidenceToScore`：

```js
high = 100
medium = 70
low = 40
```

根据 goal 调整总分：

#### balanced_match

目标：实力接近。

```js
totalScore =
  matchupBalanceScore * 0.50 +
  candidateConfidenceScore * 0.20 +
  headToHeadScore * 0.15 +
  recentCompatibilityScore * 0.15
```

#### skill_test

目标：略强但不是碾压。

```js
skillGapScore =
  ratingDiff >= 5 && ratingDiff <= 35
    ? 100 - Math.abs(ratingDiff - 20) * 3
    : clamp(60 - Math.abs(ratingDiff - 20) * 2, 0, 60)

totalScore =
  skillGapScore * 0.45 +
  candidateConfidenceScore * 0.20 +
  headToHeadScore * 0.15 +
  recentFormScore * 0.20
```

#### easier_match

目标：略弱但仍有价值。

```js
easeScore =
  ratingDiff <= -5 && ratingDiff >= -35
    ? 100 - Math.abs(ratingDiff + 20) * 3
    : clamp(60 - Math.abs(ratingDiff + 20) * 2, 0, 60)

totalScore =
  easeScore * 0.45 +
  candidateConfidenceScore * 0.20 +
  matchupBalanceScore * 0.20 +
  headToHeadScore * 0.15
```

### 8.4 Head-to-head baseline

对两名球员的历史交手统计：

```json
{
  "total": 0,
  "playerWins": 0,
  "opponentWins": 0,
  "lastWinnerId": null,
  "averageScoreDiff": 0,
  "closeMatchCount": 0,
  "handicapCount": 0
}
```

对阵优势判断：

- 如果 head-to-head total 为 0：
  - `advantagePlayerId = null`
  - confidence `low`
- 如果一方胜率 >= 65% 且 total >= 3：
  - 该方 advantage。
- 如果胜率接近 50% 或 close match 多：
  - advantage 可以为 null。

### 8.5 Player analysis baseline

输出：

```json
{
  "playerId": "string",
  "strengthScore": 0,
  "recentFormScore": 0,
  "confidence": "low",
  "summaryPoints": [],
  "cautions": [],
  "evidenceMatchIds": []
}
```

规则：

- `strengthScore` 主要来自 rating 和 rack win rate。
- `recentFormScore` 来自 trend10。
- `confidence` 来自 effMatches。
- 如果 live/practice 差距大，加入 summaryPoints。
- 如果放门比赛占比较高，加入 cautions。

## 9. Gemini 调用计划

### 9.1 SDK 初始化

在 `aiAnalysis.service.js`：

```js
import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
```

初始化：

```js
const ai = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;
```

如果：

- `AI_ENABLED=false`
- 或没有 `GEMINI_API_KEY`
- 或 evidence 为空

则不调用 Gemini，直接返回 baseline fallback。

### 9.2 Gemini Prompt 原则

Prompt 必须明确：

- 只能使用 provided data。
- 不能发明球员、比赛、比分、排名。
- 如果数据不足，confidence 必须 low。
- evidence 只能引用传入的 match id。
- recommended opponent 只能来自候选球员。
- 返回 JSON，不要 markdown。
- 不要改变排行榜算法，只解释已有数据和 baseline。

### 9.3 Prompt 输入结构

发送内容：

```json
{
  "task": "opponent_recommendation",
  "goal": "balanced_match",
  "selectedPlayer": {},
  "opponent": {},
  "leaderboardRows": [],
  "baseline": {},
  "recentMatches": [],
  "headToHeadMatches": [],
  "handicapMatches": [],
  "candidateRows": []
}
```

### 9.4 Gemini 输出 schema

使用 Gemini structured output。

公共 schema：

```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "confidence": {
      "type": "string",
      "enum": ["low", "medium", "high"]
    },
    "recommendedOpponent": {
      "type": "object",
      "properties": {
        "playerId": { "type": ["string", "null"] },
        "reason": { "type": "string" },
        "goal": {
          "type": "string",
          "enum": ["balanced_match", "skill_test", "easier_match"]
        }
      },
      "required": ["playerId", "reason", "goal"]
    },
    "headToHead": {
      "type": "object",
      "properties": {
        "advantagePlayerId": { "type": ["string", "null"] },
        "rationale": { "type": "string" }
      },
      "required": ["advantagePlayerId", "rationale"]
    },
    "rankingSuggestion": { "type": "string" },
    "cautions": {
      "type": "array",
      "items": { "type": "string" }
    },
    "evidence": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "matchId": { "type": "string" },
          "reason": { "type": "string" }
        },
        "required": ["matchId", "reason"]
      }
    },
    "baselineAgreement": {
      "type": "string",
      "enum": ["agree", "partially_agree", "disagree"]
    }
  },
  "required": [
    "summary",
    "confidence",
    "recommendedOpponent",
    "headToHead",
    "rankingSuggestion",
    "cautions",
    "evidence",
    "baselineAgreement"
  ]
}
```

### 9.5 Gemini 输出验证

即使使用 structured output，后端仍必须验证业务语义：

- `confidence` 必须是 `low | medium | high`。
- `baselineAgreement` 必须是 `agree | partially_agree | disagree`。
- `recommendedOpponent.playerId`：
  - 如果非 null，必须存在于 `candidateRows` 或 evidence players。
- `headToHead.advantagePlayerId`：
  - 如果非 null，必须是 matchup 两名球员之一。
- `evidence[].matchId`：
  - 必须存在于本次 evidence matches。
- 如果数据不足，后端可以把 Gemini 的 confidence 降级为 `low`。
- 如果 Gemini 返回非法 ID，移除该字段并加入 caution。

### 9.6 Fallback response

Gemini 失败时不要让页面报错。

失败情况：

- API key 未配置。
- Gemini timeout。
- Gemini JSON parse failed。
- Gemini 返回 ID 不合法。
- Google API 报错。

返回：

```json
{
  "source": "baseline_fallback",
  "model": null,
  "analysis": {
    "summary": "AI analysis is unavailable, so this result is generated from the deterministic baseline.",
    "confidence": "low",
    "cautions": ["Gemini response was unavailable. Showing rule-based baseline only."]
  },
  "baseline": {}
}
```

前端显示为：

```text
当前显示规则分析结果，Gemini 暂不可用。
```

## 10. 前端实施计划

### 10.1 新增页面文件

新增：

```text
src/pages/AiAnalysisPage.jsx
```

该页面负责：

- 加载 players。
- 加载 seasons。
- 管理 tab。
- 管理表单状态。
- 调用 AI POST API。
- 渲染结果。

### 10.2 修改路由

更新：

```text
src/App.jsx
```

新增 import：

```js
import AiAnalysisPage from "./pages/AiAnalysisPage.jsx";
```

新增 route：

```jsx
<Route path="/ai-analysis" element={<ProtectedPage><AiAnalysisPage /></ProtectedPage>} />
```

### 10.3 修改导航栏

更新：

```text
src/components/Navbar.jsx
```

在已登录用户导航中新增：

```jsx
<NavLink to="/ai-analysis" className={linkClass}>
  AI 分析
</NavLink>
```

建议放在 `胜负积分` 后面或 `街灯榜` 后面。

### 10.4 前端 API 调用

复用：

```js
import { apiRequest, jsonBody } from "../lib/api.js";
import { cachedApiRequest } from "../lib/apiCache.js";
```

加载基础数据：

```js
const [playerResult, seasonResult] = await Promise.all([
  cachedApiRequest("/players"),
  cachedApiRequest("/leaderboard/seasons"),
]);
```

AI POST 不使用 `cachedApiRequest`，直接使用 `apiRequest`：

```js
await apiRequest("/ai/player-analysis", {
  method: "POST",
  body: jsonBody({ playerId, seasonId, mode }),
});
```

原因：

- AI POST 有成本。
- 用户需要明确点击按钮触发。
- 避免缓存导致用户误以为重新生成。

### 10.5 AiAnalysisPage state 设计

建议 state：

```js
const [players, setPlayers] = useState([]);
const [seasons, setSeasons] = useState([]);
const [activeTab, setActiveTab] = useState("player");
const [seasonId, setSeasonId] = useState("all");
const [mode, setMode] = useState("all");
const [playerId, setPlayerId] = useState("");
const [opponentId, setOpponentId] = useState("");
const [goal, setGoal] = useState("balanced_match");
const [result, setResult] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
```

### 10.6 页面组件拆分

可以在同一个文件内拆小组件：

- `TabButton`
- `PlayerSelect`
- `ResultPanel`
- `BaselinePanel`
- `EvidenceTable`
- `ConfidenceBadge`
- `CautionList`

MVP 不需要新建很多组件文件，避免改动过散。

### 10.7 UI 展示规则

结果区展示顺序：

1. Summary
2. Confidence
3. Recommended opponent 或 head-to-head advantage
4. Baseline comparison
5. Cautions
6. Evidence matches

如果 `source === "baseline_fallback"`：

- 显示黄色/提示信息。
- 文案：

```text
Gemini 暂不可用，当前结果来自规则 baseline。
```

如果数据不足：

- 显示 caution。
- 不要隐藏结果。

### 10.8 Evidence table 字段

Evidence matches table 显示：

- 日期
- 比赛名
- 标签
- 左侧球员
- 比分
- 右侧球员
- 胜者
- 放门
- AI 引用原因

`evidence[].reason` 通过 matchId 合并到 match row。

### 10.9 样式

优先复用现有 class：

- `card`
- `btn`
- `btnBrand`
- `input`
- `badge`
- `errorBox`
- `successBox`
- `tableWrap`

如需新增样式，更新：

```text
src/styles.css
```

建议新增 class：

```css
.aiTabs
.aiFormGrid
.aiResultGrid
.aiSummary
.aiEvidenceTable
.aiConfidenceLow
.aiConfidenceMedium
.aiConfidenceHigh
```

不要引入新的 UI library。

## 11. 可选前端增强

MVP 完成后可以加：

### 11.1 PlayerDetailPage 入口

在球员详情页加按钮：

```text
AI 分析这个球员
```

跳转：

```text
/ai-analysis?tab=player&playerId=xxx
```

### 11.2 LeaderboardPage 入口

在排行榜每个球员 row 增加小按钮：

```text
AI
```

跳转到 AI 页面。

### 11.3 URL query 初始化

`AiAnalysisPage` 可读取：

- `tab`
- `playerId`
- `opponentId`
- `goal`
- `season`

MVP 可以先不做。

## 12. 安全和治理

### 12.1 API key

必须只存在于：

```text
backEnd/.env
Vercel backend environment variables
```

不能出现在：

- 前端 `.env`
- React code
- Git commit
- API response

### 12.2 数据边界

只发送 compact context 给 Gemini。

不要发送：

- user password hash。
- JWT。
- admin account data。
- audit logs。
- pending/rejected match reports。
- full database dump。

### 12.3 只读原则

AI routes 只能读数据。

禁止：

- 修改 Match。
- 修改 Player。
- 修改 MatchReport。
- 修改 Ranking。
- 自动创建推荐赛程。

### 12.4 幻觉控制

控制方式：

- structured output。
- evidence match IDs。
- 后端验证 ID。
- invalid ID 自动移除。
- insufficient data 降低 confidence。
- UI 展示 cautions。

## 13. 测试计划

### 13.1 后端手动测试

启动后端：

```bash
cd backEnd
npm run dev
```

启动前端：

```bash
npm run dev
```

登录后在浏览器测试：

- `/ai-analysis`
- player analysis
- matchup analysis
- opponent recommendation

### 13.2 构建验证

前端：

```bash
npm run build
```

后端至少确认：

```bash
cd backEnd
npm run prisma:generate
node src/server.js
```

如果已有后端 dev server 正在运行，用正常 stop/start 方式验证。

### 13.3 API 测试点

必须覆盖：

1. 未登录访问 `/api/ai/player-analysis`
   - 预期 401。

2. playerId 不存在
   - 预期 404 或 400。

3. matchup 选择同一个 player
   - 预期 400。

4. 没有 `GEMINI_API_KEY`
   - 预期返回 `source: baseline_fallback`。

5. 有 `GEMINI_API_KEY`
   - 预期返回 `source: gemini`。

6. sparse-data player
   - 预期 confidence low，并有 caution。

### 13.4 Evaluation cases

至少准备 5 个 case：

| Case | 输入 | Baseline | Gemini | Agreement | Evidence quality | Notes |
|---|---|---|---|---|---|---|
| Frequent head-to-head | A vs B | TBD | TBD | TBD | TBD | 两人多次交手 |
| Uneven matchup | strong vs weak | TBD | TBD | TBD | TBD | Rating 差距大 |
| Sparse player | new player | TBD | TBD | TBD | TBD | 数据不足 |
| Recent improvement | player with positive trend10 | TBD | TBD | TBD | TBD | 近期变强 |
| Handicap affected | handicap matches | TBD | TBD | TBD | TBD | 放门影响 |

评价维度：

- 推荐是否合理。
- 是否引用真实 match id。
- 是否正确说明数据不足。
- 是否正确处理放门。
- Gemini 是否和 baseline 有可解释的一致或分歧。

## 14. 实施顺序

### Phase 1: Backend baseline first

目标：不接 Gemini，也能跑完整 API。

步骤：

1. 新增 `ai.routes.js`。
2. 新增 `aiContext.service.js`。
3. 新增 `aiBaseline.service.js`。
4. 在 `app.js` 挂载 `/api/ai`。
5. 返回 `source: baseline_fallback`。
6. 用 Postman/browser devtools 验证三个 POST route。

完成标准：

- 三个 endpoint 都能返回 baseline。
- 数据不足不会崩。
- ID 校验正确。

### Phase 2: Gemini integration

目标：接入 Gemini structured output。

步骤：

1. 安装 `@google/genai`。
2. 更新 `.env.example` 和 `env.js`。
3. 在 `aiAnalysis.service.js` 写 Gemini client。
4. 加 prompt builder。
5. 加 response schema。
6. 加 parse + validation。
7. 加 timeout/fallback。

完成标准：

- 有 key 时返回 `source: gemini`。
- 无 key 时返回 `source: baseline_fallback`。
- Gemini 返回非法 ID 时不会污染前端。

### Phase 3: Frontend AI page

目标：用户可以在 UI 完成三种分析。

步骤：

1. 新增 `AiAnalysisPage.jsx`。
2. 加三个 tab。
3. 加 player/season/mode/goal inputs。
4. 调用三个 AI POST API。
5. 渲染 summary、baseline、cautions、evidence。
6. 加 loading/error/empty state。
7. 更新 `App.jsx` route。
8. 更新 `Navbar.jsx` link。

完成标准：

- 登录后能打开 `/ai-analysis`。
- 三个 tab 都能生成结果。
- Gemini fallback 时 UI 文案清楚。
- evidence matches 可读。

### Phase 4: Polish and evaluation

目标：能用于课程展示。

步骤：

1. 选 5 个 evaluation cases。
2. 保存 baseline vs Gemini 对比表。
3. 检查移动端布局。
4. 运行 `npm run build`。
5. 更新 README 或报告说明。

完成标准：

- 页面可 demo。
- 有 5 个测试案例。
- 有清楚的风险控制说明。

## 15. 预计文件改动清单

后端新增：

```text
backEnd/src/routes/ai.routes.js
backEnd/src/services/aiAnalysis.service.js
backEnd/src/services/aiBaseline.service.js
backEnd/src/services/aiContext.service.js
```

后端修改：

```text
backEnd/src/app.js
backEnd/src/config/env.js
backEnd/.env.example
backEnd/package.json
backEnd/package-lock.json
```

前端新增：

```text
src/pages/AiAnalysisPage.jsx
```

前端修改：

```text
src/App.jsx
src/components/Navbar.jsx
src/styles.css
```

可选修改：

```text
src/pages/PlayerDetailPage.jsx
src/pages/LeaderboardPage.jsx
README.md
```

## 16. 主要风险和处理

### 风险 1: Gemini 过度自信

处理：

- 后端根据 effMatches 强制降级 confidence。
- prompt 要求 sparse data 使用 low confidence。
- UI 显示 caution。

### 风险 2: Gemini 编造比赛

处理：

- 只传 evidence matches。
- schema 中 evidence 只允许 matchId。
- 后端验证 matchId 必须存在于 evidence。

### 风险 3: 推荐对手不稳定

处理：

- baseline 先决定主要推荐。
- Gemini 负责解释和补充。
- UI 显示 baselineAgreement。

### 风险 4: API key 泄露

处理：

- 只在后端 `.env`。
- 前端永不使用 Gemini SDK。
- response 不返回 key。

### 风险 5: 数据少导致结论弱

处理：

- confidence low。
- caution 明确说明样本不足。
- 推荐收集更多比赛记录。

## 17. 最终展示说法

项目介绍时可以这样描述：

> AI Match Analyst is a Gemini-powered analysis layer for a pool score tracker. It uses existing match records, leaderboard ratings, recent form, head-to-head history, and handicap-aware baseline logic to generate readable player analysis, matchup comparison, and opponent recommendations. The AI does not replace the ranking algorithm; it explains the data and compares its conclusion with a deterministic baseline.

中文说明：

> AI Match Analyst 是一个基于 Gemini 的台球比赛分析层。它读取现有正式比赛、排行榜、近期状态、历史交手和放门记录，生成球员状态分析、对阵比较和对手推荐。AI 不替代排行榜算法，只负责解释数据，并和规则 baseline 做对比。
