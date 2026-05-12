import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;        // nombre del rol (ej. "VENDEDOR")
  permisos: string[];  // códigos de permiso (ej. ["inventario:ver", "ventas:crear"])
  empleadoId?: number;
  sucursalId?: number; // sucursal del empleado (autocompletado en ventas)
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token no proporcionado" });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

/**
 * Verifica que el usuario tenga al menos uno de los permisos especificados.
 * Uso: authorize("inventario:crear")  o  authorize("inventario:crear", "inventario:editar")
 */
export function authorize(...permisos: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    if (permisos.length > 0) {
      const tiene = permisos.some((p) => req.user!.permisos.includes(p));
      if (!tiene) {
        res.status(403).json({ error: "Sin permisos suficientes" });
        return;
      }
    }
    next();
  };
}
