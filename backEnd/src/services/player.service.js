import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../utils/password.js";
import { httpError } from "../utils/httpError.js";
import { serializePlayer, serializeUser } from "./shape.service.js";

function cleanName(name) {
  const value = String(name ?? "").trim();
  if (!value) throw httpError(400, "Player name is required");
  return value;
}

function cleanUsername(username) {
  const value = String(username ?? "").trim();
  if (!value) throw httpError(400, "Username is required");
  return value;
}

function cleanPassword(password, required = true) {
  if (password == null || password === "") {
    if (required) throw httpError(400, "Password is required");
    return null;
  }

  const value = String(password);
  if (value.length < 6) throw httpError(400, "Password must be at least 6 characters");
  return value;
}

export async function listPlayers(opts = {}) {
  const players = await prisma.player.findMany({
    include: { user: true },
    orderBy: { name: "asc" },
  });

  return players.map((player) => serializePlayer(player, { includeAccount: opts.includeAccount }));
}

export async function getPlayer(id, opts = {}) {
  const player = await prisma.player.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!player) throw httpError(404, "Player not found");
  return serializePlayer(player, { includeAccount: opts.includeAccount });
}

export async function createPlayer(input) {
  const player = await prisma.player.create({
    data: {
      name: cleanName(input?.name),
    },
    include: { user: true },
  });

  return serializePlayer(player, { includeAccount: true });
}

export async function updatePlayer(id, input) {
  const player = await prisma.player.update({
    where: { id },
    data: {
      name: cleanName(input?.name),
    },
    include: { user: true },
  });

  return serializePlayer(player, { includeAccount: true });
}

export async function deletePlayer(id) {
  const [matches, reports] = await Promise.all([
    prisma.match.count({
      where: {
        OR: [
          { leftPlayerId: id },
          { rightPlayerId: id },
          { winnerId: id },
          { handicapGiverId: id },
          { handicapReceiverId: id },
        ],
      },
    }),
    prisma.matchReport.count({
      where: {
        OR: [
          { leftPlayerId: id },
          { rightPlayerId: id },
          { winnerId: id },
          { handicapGiverId: id },
          { handicapReceiverId: id },
        ],
      },
    }),
  ]);

  if (matches > 0 || reports > 0) {
    throw httpError(409, "This player has match data and cannot be deleted. Rename instead.");
  }

  await prisma.player.delete({ where: { id } });
  return { ok: true };
}

export async function setPlayerAccount(playerId, input, actorId) {
  const username = cleanUsername(input?.username);
  const password = cleanPassword(input?.password, false);

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { user: true },
  });

  if (!player) throw httpError(404, "Player not found");

  const result = await prisma.$transaction(async (tx) => {
    if (player.user) {
      const data = {
        username,
        role: "PLAYER",
      };

      if (password) {
        data.passwordHash = await hashPassword(password);
      }

      const user = await tx.user.update({
        where: { id: player.user.id },
        data,
        include: { player: true },
      });

      await tx.auditLog.create({
        data: {
          action: "PLAYER_ACCOUNT_UPDATED",
          actorId,
          targetId: playerId,
          detail: JSON.stringify({ username }),
        },
      });

      return user;
    }

    const existingUser = await tx.user.findUnique({
      where: { username },
      include: { player: true },
    });

    if (existingUser) {
      if (existingUser.playerId && existingUser.playerId !== playerId) {
        throw httpError(409, "This username is already bound to another player");
      }

      const data = { playerId };
      if (password) {
        data.passwordHash = await hashPassword(password);
      }

      const user = await tx.user.update({
        where: { id: existingUser.id },
        data,
        include: { player: true },
      });

      await tx.auditLog.create({
        data: {
          action: "PLAYER_ACCOUNT_UPDATED",
          actorId,
          targetId: playerId,
          detail: JSON.stringify({ username, boundExistingUser: true }),
        },
      });

      return user;
    }

    const requiredPassword = cleanPassword(input?.password, true);
    const user = await tx.user.create({
      data: {
        username,
        passwordHash: await hashPassword(requiredPassword),
        role: "PLAYER",
        playerId,
      },
      include: { player: true },
    });

    await tx.auditLog.create({
      data: {
        action: "PLAYER_ACCOUNT_CREATED",
        actorId,
        targetId: playerId,
        detail: JSON.stringify({ username }),
      },
    });

    return user;
  });

  return serializeUser(result);
}
