import { prisma } from "../lib/prisma.js";
import { httpError } from "../utils/httpError.js";
import { serializeShameRecord } from "./shape.service.js";

// 5 局起钉上耻辱柱（群规则）。改这里即可调整门槛。
export const MIN_PINS = 5;

function cleanPins(pins) {
  const n = Math.trunc(Number(pins));
  if (!Number.isFinite(n)) throw httpError(400, "Pins must be a number");
  if (n < MIN_PINS) throw httpError(400, `Pins must be at least ${MIN_PINS}`);
  return n;
}

function cleanDate(dateISO) {
  const value = String(dateISO ?? "").trim();
  if (!value) throw httpError(400, "Date is required");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, "Invalid date");
  return date;
}

async function cleanLoserId(loserId) {
  const id = String(loserId ?? "").trim();
  if (!id) throw httpError(400, "Loser is required");
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) throw httpError(404, "Loser player not found");
  return id;
}

// 同场球员（去重，剔除 loser 本人，loser 单独记录）
function cleanParticipantIds(participantIds, loserId) {
  const ids = Array.isArray(participantIds)
    ? participantIds.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  return [...new Set(ids)].filter((id) => id !== loserId);
}

const RECORD_INCLUDE = { loser: true, participants: { orderBy: { name: "asc" } } };

export async function listShameRecords() {
  const records = await prisma.shameRecord.findMany({
    include: RECORD_INCLUDE,
    orderBy: [{ dateISO: "desc" }, { createdAt: "desc" }],
  });

  return { records: records.map(serializeShameRecord) };
}

export async function createShameRecord(input, createdById) {
  const loserId = await cleanLoserId(input?.loserId);
  const pins = cleanPins(input?.pins);
  const dateISO = cleanDate(input?.dateISO);
  const participantIds = cleanParticipantIds(input?.participantIds, loserId);

  const record = await prisma.shameRecord.create({
    data: {
      dateISO,
      pins,
      loserId,
      createdById: createdById ?? null,
      participants: participantIds.length
        ? { connect: participantIds.map((id) => ({ id })) }
        : undefined,
    },
    include: RECORD_INCLUDE,
  });

  return serializeShameRecord(record);
}

export async function updateShameRecord(id, input) {
  const existing = await prisma.shameRecord.findUnique({ where: { id } });
  if (!existing) throw httpError(404, "Shame record not found");

  const loserId = await cleanLoserId(input?.loserId);
  const pins = cleanPins(input?.pins);
  const dateISO = cleanDate(input?.dateISO);
  const participantIds = cleanParticipantIds(input?.participantIds, loserId);

  const record = await prisma.shameRecord.update({
    where: { id },
    data: {
      dateISO,
      pins,
      loserId,
      participants: { set: participantIds.map((pid) => ({ id: pid })) },
    },
    include: RECORD_INCLUDE,
  });

  return serializeShameRecord(record);
}

export async function deleteShameRecord(id) {
  const existing = await prisma.shameRecord.findUnique({ where: { id } });
  if (!existing) throw httpError(404, "Shame record not found");

  await prisma.shameRecord.delete({ where: { id } });
  return { ok: true };
}
