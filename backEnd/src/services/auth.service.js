import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { httpError } from "../utils/httpError.js";
import { serializeUser } from "./shape.service.js";

function assertUsername(username) {
  const value = String(username ?? "").trim();
  if (!value) throw httpError(400, "Username is required");
  if (value.length > 60) throw httpError(400, "Username is too long");
  return value;
}

function assertPassword(password) {
  const value = String(password ?? "");
  if (value.length < 6) throw httpError(400, "Password must be at least 6 characters");
  return value;
}

export async function registerPlayerAccount(input) {
  const username = assertUsername(input?.username);
  const password = assertPassword(input?.password);
  const playerName = String(input?.playerName ?? username).trim() || username;
  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const player = await tx.player.create({
      data: {
        name: playerName,
      },
    });

    return tx.user.create({
      data: {
        username,
        passwordHash,
        role: "PLAYER",
        playerId: player.id,
      },
      include: { player: true },
    });
  });

  return {
    token: signToken(user),
    user: serializeUser(user),
  };
}

export async function login(input) {
  const username = assertUsername(input?.username);
  const password = String(input?.password ?? "");

  const user = await prisma.user.findUnique({
    where: { username },
    include: { player: true },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw httpError(401, "Invalid username or password");
  }

  return {
    token: signToken(user),
    user: serializeUser(user),
  };
}

export async function updateMyAccount(userId, input) {
  const data = {};

  if (input?.username != null) {
    data.username = assertUsername(input.username);
  }

  if (input?.newPassword != null) {
    const currentPassword = String(input?.currentPassword ?? "");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw httpError(401, "Current password is incorrect");
    }
    data.passwordHash = await hashPassword(assertPassword(input.newPassword));
  }

  if (Object.keys(data).length === 0) {
    throw httpError(400, "No account changes provided");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    include: { player: true },
  });

  return serializeUser(updated);
}
