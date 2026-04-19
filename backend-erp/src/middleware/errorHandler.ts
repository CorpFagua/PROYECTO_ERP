import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Errores de validación Zod
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Error de validación",
      details: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  // Errores controlados con statusCode
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Error inesperado
  console.error("[error]", err);
  res.status(500).json({ error: "Error interno del servidor" });
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}
