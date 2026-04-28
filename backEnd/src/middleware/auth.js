import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../utils/jwt.js";
import { httpError } from "../utils/httpError.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.get("authorization") ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw httpError(401, "Missing bearer token");
    }

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { player: true },
    });

    if (!user) {
      throw httpError(401, "Invalid token user");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error.status ? error : httpError(401, "Invalid or expired token"));
  }
}
