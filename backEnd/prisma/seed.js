import "../src/config/env.js";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password.js";

const prisma = new PrismaClient();

const adminUsers = [
  { username: "Jack", password: "Quixotejack7@" },
  { username: "Johnny", password: "Johnny123@" },
];

async function main() {
  for (const admin of adminUsers) {
    await prisma.user.upsert({
      where: { username: admin.username },
      update: {
        passwordHash: await hashPassword(admin.password),
        role: "ADMIN",
      },
      create: {
        username: admin.username,
        passwordHash: await hashPassword(admin.password),
        role: "ADMIN",
      },
    });
  }

  console.log(`Seeded ${adminUsers.length} admin users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
