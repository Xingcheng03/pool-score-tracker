import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, "sqlite-full-backup.json");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SQLITE_DATABASE_URL || "file:./dev.db",
    },
  },
});

function serializeRecord(record) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ])
  );
}

async function main() {
  const [users, players, matches, matchReports, auditLogs] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.player.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.match.findMany({ orderBy: { dateISO: "asc" } }),
    prisma.matchReport.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const backup = {
    exportedAtISO: new Date().toISOString(),
    source: "sqlite",
    tables: {
      users: users.map(serializeRecord),
      players: players.map(serializeRecord),
      matches: matches.map(serializeRecord),
      matchReports: matchReports.map(serializeRecord),
      auditLogs: auditLogs.map(serializeRecord),
    },
  };

  await fs.writeFile(outputPath, `${JSON.stringify(backup, null, 2)}\n`, "utf8");

  console.log(`SQLite full backup written to ${outputPath}`);
  console.log(
    `Exported users=${users.length}, players=${players.length}, matches=${matches.length}, matchReports=${matchReports.length}, auditLogs=${auditLogs.length}`
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
