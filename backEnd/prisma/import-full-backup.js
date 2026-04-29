import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../src/config/env.js";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultBackupPath = path.join(__dirname, "sqlite-full-backup.json");
const backupPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultBackupPath;

const prisma = new PrismaClient();

const dateFields = {
  users: ["createdAt", "updatedAt"],
  players: ["createdAt", "updatedAt"],
  matches: ["dateISO", "createdAt", "updatedAt"],
  matchReports: ["dateISO", "reviewedAt", "createdAt", "updatedAt"],
  auditLogs: ["createdAt"],
};

function parseRecord(tableName, record) {
  const parsed = { ...record };
  for (const field of dateFields[tableName] || []) {
    if (parsed[field]) {
      parsed[field] = new Date(parsed[field]);
    }
  }
  return parsed;
}

async function assertEmptyDatabase() {
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.player.count(),
    prisma.match.count(),
    prisma.matchReport.count(),
    prisma.auditLog.count(),
  ]);

  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total > 0) {
    throw new Error(
      `Target database is not empty (users=${counts[0]}, players=${counts[1]}, matches=${counts[2]}, matchReports=${counts[3]}, auditLogs=${counts[4]}). Aborting import.`
    );
  }
}

async function main() {
  const raw = await fs.readFile(backupPath, "utf8");
  const backup = JSON.parse(raw);
  const tables = backup.tables || {};

  const players = (tables.players || []).map((record) => parseRecord("players", record));
  const users = (tables.users || []).map((record) => parseRecord("users", record));
  const matches = (tables.matches || []).map((record) => parseRecord("matches", record));
  const matchReports = (tables.matchReports || []).map((record) =>
    parseRecord("matchReports", record)
  );
  const auditLogs = (tables.auditLogs || []).map((record) => parseRecord("auditLogs", record));

  await assertEmptyDatabase();

  await prisma.$transaction(async (tx) => {
    if (players.length) {
      await tx.player.createMany({ data: players });
    }
    if (users.length) {
      await tx.user.createMany({ data: users });
    }
    if (matches.length) {
      await tx.match.createMany({ data: matches });
    }
    if (matchReports.length) {
      await tx.matchReport.createMany({ data: matchReports });
    }
    if (auditLogs.length) {
      await tx.auditLog.createMany({ data: auditLogs });
    }
  });

  console.log(`Imported backup from ${backupPath}`);
  console.log(
    `Imported users=${users.length}, players=${players.length}, matches=${matches.length}, matchReports=${matchReports.length}, auditLogs=${auditLogs.length}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
