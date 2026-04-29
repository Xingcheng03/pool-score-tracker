import { prisma } from "../lib/prisma.js";
import { httpError } from "../utils/httpError.js";
import { serializeMatch } from "./shape.service.js";
import { invalidateStatsCache } from "./stats.service.js";

function buildMatchWhere(query) {
  const where = {};

  if (query?.tag === "live") where.tag = "LIVE";
  if (query?.tag === "practice") where.tag = "PRACTICE";

  return where;
}

export async function listMatches(query = {}) {
  const matches = await prisma.match.findMany({
    where: buildMatchWhere(query),
    orderBy: [{ dateISO: "desc" }, { id: "asc" }],
  });

  return matches.map(serializeMatch);
}

export async function getMatch(id) {
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) throw httpError(404, "Match not found");
  return serializeMatch(match);
}

export async function deleteMatch(id) {
  await prisma.match.delete({ where: { id } });
  invalidateStatsCache();
  return { ok: true };
}
