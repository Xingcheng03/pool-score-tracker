import { Prisma } from "@prisma/client";

export function notFound(_req, _res, next) {
  const error = new Error("Route not found");
  error.status = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ error: "Unique constraint conflict", detail: error.meta });
      return;
    }

    if (error.code === "P2025") {
      res.status(404).json({ error: "Record not found" });
      return;
    }
  }

  const status = Number(error.status ?? 500);
  res.status(status).json({
    error: error.message ?? "Internal server error",
  });
}
