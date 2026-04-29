import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { httpError } from "../utils/httpError.js";
import {
  AI_TASKS,
  attachRecommendationEvidence,
  buildAiContext,
  compactAiMatch,
} from "./aiContext.service.js";
import { baselineEvidence, buildAiBaseline } from "./aiBaseline.service.js";

const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);
const VALID_AGREEMENT = new Set(["agree", "partially_agree", "disagree"]);
const VALID_GOALS = new Set(["balanced_match", "skill_test", "easier_match"]);

const AI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    recommendedOpponent: {
      type: "object",
      properties: {
        playerId: { type: ["string", "null"] },
        reason: { type: "string" },
        goal: { type: "string", enum: ["balanced_match", "skill_test", "easier_match"] },
      },
      required: ["playerId", "reason", "goal"],
    },
    headToHead: {
      type: "object",
      properties: {
        advantagePlayerId: { type: ["string", "null"] },
        rationale: { type: "string" },
      },
      required: ["advantagePlayerId", "rationale"],
    },
    rankingSuggestion: { type: "string" },
    cautions: {
      type: "array",
      items: { type: "string" },
    },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          matchId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["matchId", "reason"],
      },
    },
    baselineAgreement: { type: "string", enum: ["agree", "partially_agree", "disagree"] },
  },
  required: [
    "summary",
    "confidence",
    "recommendedOpponent",
    "headToHead",
    "rankingSuggestion",
    "cautions",
    "evidence",
    "baselineAgreement",
  ],
};

let geminiClient = null;

function getGeminiClient() {
  if (!env.aiEnabled || !env.geminiApiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }
  return geminiClient;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Gemini request timed out after ${ms}ms`)), ms);
    }),
  ]);
}

function compactPromptContext(context, baseline) {
  return {
    task: context.task,
    selectedPlayer: context.selectedPlayer,
    opponent: context.opponent,
    selectedPlayerStats: context.selectedPlayerStats,
    opponentStats: context.opponentStats,
    baseline,
    recentMatches: context.recentMatches.slice(0, context.maxMatches).map((match) => compactAiMatch(match, context.playerMap)),
    headToHeadMatches: context.headToHeadMatches.slice(0, context.maxMatches).map((match) => compactAiMatch(match, context.playerMap)),
    handicapMatches: context.handicapMatches.slice(0, context.maxMatches).map((match) => compactAiMatch(match, context.playerMap)),
    evidenceMatches: context.evidence.matches,
    insufficientDataReasons: context.insufficientDataReasons,
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchDisplayLabel(match, playerMap) {
  const leftName = playerMap.get(match.leftPlayerId) ?? "左侧球员";
  const rightName = playerMap.get(match.rightPlayerId) ?? "右侧球员";
  const score = `${match.leftScore} - ${match.rightScore}`;
  return `${match.matchName ?? "这场比赛"}（${leftName} ${score} ${rightName}）`;
}

function buildMatchIdLabelMap(context) {
  const seen = new Set();
  const sourceMatches = [];

  for (const match of [
    ...(Array.isArray(context.matches) ? context.matches : []),
    ...(Array.isArray(context.evidenceMatches) ? context.evidenceMatches : []),
  ]) {
    if (!match?.id || seen.has(match.id)) continue;
    seen.add(match.id);
    sourceMatches.push(match);
  }

  return new Map(
    sourceMatches
      .filter((match) => match?.id)
      .map((match) => [match.id, matchDisplayLabel(match, context.playerMap)]),
  );
}

function replaceVisibleMatchIds(value, context) {
  if (value == null) return value;

  let text = String(value);
  const idLabels = buildMatchIdLabelMap(context);

  for (const [matchId, label] of idLabels.entries()) {
    const pattern = new RegExp(`(?:比赛\\s*ID\\s*[:：]?\\s*)?${escapeRegExp(matchId)}`, "g");
    text = text.replace(pattern, label);
  }

  return text;
}

function sanitizeAnalysisForDisplay(analysis, context) {
  if (!analysis || typeof analysis !== "object") return analysis;
  const clean = (value) => replaceVisibleMatchIds(value, context);

  return {
    ...analysis,
    summary: clean(analysis.summary),
    playerForm: clean(analysis.playerForm),
    rankingSuggestion: clean(analysis.rankingSuggestion),
    recommendedOpponent: analysis.recommendedOpponent && typeof analysis.recommendedOpponent === "object"
      ? {
        ...analysis.recommendedOpponent,
        reason: clean(analysis.recommendedOpponent.reason),
      }
      : analysis.recommendedOpponent,
    headToHead: analysis.headToHead && typeof analysis.headToHead === "object"
      ? {
        ...analysis.headToHead,
        rationale: clean(analysis.headToHead.rationale),
      }
      : analysis.headToHead,
    cautions: Array.isArray(analysis.cautions) ? analysis.cautions.map(clean) : analysis.cautions,
    evidence: Array.isArray(analysis.evidence)
      ? analysis.evidence.map((item) => ({
        ...item,
        reason: clean(item.reason),
      }))
      : analysis.evidence,
  };
}

function buildPrompt(context, baseline) {
  const promptContext = compactPromptContext(context, baseline);

  return `
You are AI Match Analyst for a pool score tracker.
Write all user-facing text in Simplified Chinese.

Rules:
- Use only the provided JSON data.
- Do not invent players, matches, scores, ratings, or rankings.
- Evidence citations must use match IDs from evidenceMatches only.
- Never expose raw match IDs in any user-facing text. Use opponent names, match names, scores, dates, and win/loss instead.
- Player reports must discuss all historical matches, recent 5 match dates, activity frequency, score margins, rating delta trend, and next-visit form outlook.
- Matchup reports must explain predicted win rates using direct matches, shared opponents, and recent form from match records. Do not use leaderboard rank as the reason for win probability.
- Opponent recommendations must explain three categories: balanced_match/even opponents, challenge/stronger opponents, and stabilize/weaker opponents.
- The score delta table is the only place where street-lamp ranking math should be discussed.
- If data is sparse or no direct/common-opponent evidence exists, say confidence is low and add a caution.
- For player_analysis, recommendedOpponent.playerId must be null.
- For matchup_analysis, recommendedOpponent.playerId must be null; headToHead.advantagePlayerId may be null or one of the two selected players.
- For opponent_recommendation, recommendedOpponent.playerId should usually be the top balanced opponent, but the report must describe all three categories from baseline.recommendationCategories.
- Return only JSON matching the schema.

Input JSON:
${JSON.stringify(promptContext)}
`;
}

function fallbackAnalysis(context, baseline, reason) {
  const cautions = [
    ...(Array.isArray(baseline?.cautions) ? baseline.cautions : []),
    ...(Array.isArray(context.insufficientDataReasons) ? context.insufficientDataReasons : []),
  ];

  if (reason) cautions.push(reason);

  return {
    summary: baseline?.summaryPoints?.join(" ") || baseline?.reasons?.join(" ") || "Gemini 暂不可用，当前结果来自规则 baseline。",
    confidence: baseline?.confidence ?? "low",
    playerForm: baseline?.summaryPoints?.join(" ") ?? "",
    recommendedOpponent: {
      playerId: baseline?.recommendedOpponentId ?? null,
      reason: baseline?.reasons?.join(" ") ?? "",
      goal: context.goal,
    },
    headToHead: {
      advantagePlayerId: baseline?.headToHead?.advantagePlayerId ?? null,
      rationale: baseline?.reasons?.join(" ") ?? "",
    },
    rankingSuggestion: "此结果只读，不会修改排行榜。请结合现有排行榜和实际比赛安排判断。",
    cautions: [...new Set(cautions)].filter(Boolean),
    evidence: baselineEvidence(context),
    baselineAgreement: "agree",
  };
}

function makeResponse({ context, baseline, analysis, source, model, fallbackReason }) {
  return {
    task: context.task,
    source,
    model,
    generatedAt: new Date().toISOString(),
    contextSummary: context.contextSummary,
    baseline,
    analysis: sanitizeAnalysisForDisplay(analysis, context),
    evidence: context.evidence,
    fallbackReason,
  };
}

function parseGeminiJson(response) {
  const text = response?.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return JSON.parse(text);
}

function normalizeAnalysisShape(value, context, baseline) {
  const analysis = value && typeof value === "object" ? { ...value } : {};
  const cautions = Array.isArray(analysis.cautions) ? analysis.cautions.filter(Boolean).map(String) : [];
  const evidenceIds = new Set(context.evidence.matches.map((match) => match.id));
  const candidateIds = new Set(context.candidateRows.map((row) => row.id));
  const evidencePlayerIds = new Set(context.evidence.players.map((player) => player.id));

  analysis.summary = String(analysis.summary ?? "");
  analysis.confidence = VALID_CONFIDENCE.has(analysis.confidence) ? analysis.confidence : "low";
  analysis.rankingSuggestion = String(analysis.rankingSuggestion ?? "");
  analysis.baselineAgreement = VALID_AGREEMENT.has(analysis.baselineAgreement) ? analysis.baselineAgreement : "partially_agree";

  if (context.insufficientDataReasons.length > 0) {
    analysis.confidence = "low";
    cautions.push(...context.insufficientDataReasons);
  }

  const recommendedOpponent = analysis.recommendedOpponent && typeof analysis.recommendedOpponent === "object"
    ? { ...analysis.recommendedOpponent }
    : {};
  recommendedOpponent.playerId = recommendedOpponent.playerId ?? null;
  recommendedOpponent.reason = String(recommendedOpponent.reason ?? "");
  recommendedOpponent.goal = VALID_GOALS.has(recommendedOpponent.goal) ? recommendedOpponent.goal : context.goal;

  if (context.task !== AI_TASKS.OPPONENT_RECOMMENDATION) {
    recommendedOpponent.playerId = null;
  } else if (recommendedOpponent.playerId && !candidateIds.has(recommendedOpponent.playerId) && !evidencePlayerIds.has(recommendedOpponent.playerId)) {
    cautions.push("Gemini returned an invalid recommended opponent ID, so it was removed.");
    recommendedOpponent.playerId = baseline?.recommendedOpponentId ?? null;
  }

  const headToHead = analysis.headToHead && typeof analysis.headToHead === "object" ? { ...analysis.headToHead } : {};
  headToHead.advantagePlayerId = headToHead.advantagePlayerId ?? null;
  headToHead.rationale = String(headToHead.rationale ?? "");

  if (headToHead.advantagePlayerId) {
    const validAdvantageIds = context.task === AI_TASKS.MATCHUP_ANALYSIS && context.opponent
      ? new Set([context.selectedPlayer.id, context.opponent.id])
      : new Set([context.selectedPlayer.id]);
    if (!validAdvantageIds.has(headToHead.advantagePlayerId)) {
      cautions.push("Gemini returned an invalid head-to-head advantage ID, so it was removed.");
      headToHead.advantagePlayerId = null;
    }
  }

  const evidence = Array.isArray(analysis.evidence)
    ? analysis.evidence
      .filter((item) => item?.matchId && evidenceIds.has(item.matchId))
      .map((item) => ({ matchId: item.matchId, reason: String(item.reason ?? "") }))
    : [];

  if (Array.isArray(analysis.evidence) && evidence.length !== analysis.evidence.length) {
    cautions.push("Some Gemini evidence references were removed because they did not match the provided evidence package.");
  }

  return {
    ...analysis,
    recommendedOpponent,
    headToHead,
    cautions: [...new Set(cautions)].filter(Boolean),
    evidence,
  };
}

async function runAiTask(task, input = {}) {
  let context = await buildAiContext({ ...input, task });
  let baseline = buildAiBaseline(context);

  if (task === AI_TASKS.OPPONENT_RECOMMENDATION) {
    context = attachRecommendationEvidence(context, baseline.recommendations?.map((item) => item.opponentId) ?? baseline.recommendedOpponentId);
    baseline = {
      ...baseline,
      evidenceMatchIds: context.evidenceMatches.map((match) => match.id),
    };
  }

  const fallbackReason = !env.aiEnabled
    ? "Gemini is disabled by AI_ENABLED=false."
    : !env.geminiApiKey
      ? "Gemini API key is not configured."
      : context.evidenceMatches.length === 0
        ? "No evidence matches are available, so Gemini was not called."
        : "";

  if (fallbackReason) {
    return makeResponse({
      context,
      baseline,
      analysis: fallbackAnalysis(context, baseline, fallbackReason),
      source: "baseline_fallback",
      model: null,
      fallbackReason,
    });
  }

  const client = getGeminiClient();
  if (!client) {
    const reason = "Gemini client is unavailable.";
    return makeResponse({
      context,
      baseline,
      analysis: fallbackAnalysis(context, baseline, reason),
      source: "baseline_fallback",
      model: null,
      fallbackReason: reason,
    });
  }

  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: env.aiModel,
        contents: buildPrompt(context, baseline),
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: AI_RESPONSE_SCHEMA,
        },
      }),
      env.aiTimeoutMs,
    );

    const parsed = parseGeminiJson(response);
    const analysis = normalizeAnalysisShape(parsed, context, baseline);
    return makeResponse({
      context,
      baseline,
      analysis,
      source: "gemini",
      model: env.aiModel,
      fallbackReason: null,
    });
  } catch (error) {
    const reason = `Gemini analysis failed: ${error?.message ?? String(error)}`;
    return makeResponse({
      context,
      baseline,
      analysis: fallbackAnalysis(context, baseline, reason),
      source: "baseline_fallback",
      model: null,
      fallbackReason: reason,
    });
  }
}

export async function analyzePlayer(input = {}) {
  return runAiTask(AI_TASKS.PLAYER_ANALYSIS, {
    playerId: input.playerId,
  });
}

export async function analyzeMatchup(input = {}) {
  if (!input.opponentId) throw httpError(400, "opponentId is required");
  return runAiTask(AI_TASKS.MATCHUP_ANALYSIS, {
    playerId: input.playerId,
    opponentId: input.opponentId,
  });
}

export async function recommendOpponent(input = {}) {
  return runAiTask(AI_TASKS.OPPONENT_RECOMMENDATION, {
    playerId: input.playerId,
  });
}
