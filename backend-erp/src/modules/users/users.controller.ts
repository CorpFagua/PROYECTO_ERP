import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as usersService from "./users.service.js";

const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  name: z.string().min(1, "El nombre es requerido"),
  rolId: z.number().int().positive("rolId debe ser un entero positivo"),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email("Email inválido").optional(),
  rolId: z.number().int().positive().optional(),
  password: z.string().min(6).optional(),
});

const updateRolPermisosSchema = z.object({
  permisoIds: z.array(z.number().int().positive()),
});

// ─── Usuarios ────────────────────────────────────────────────

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await usersService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await usersService.createUser(data);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);
    const user = await usersService.updateUser(id, data);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function toggleUserActive(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const user = await usersService.toggleUserActive(id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// ─── Roles y permisos ─────────────────────────────────────────

export async function listRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await usersService.listRoles();
    res.json(roles);
  } catch (err) {
    next(err);
  }
}

export async function listPermisos(req: Request, res: Response, next: NextFunction) {
  try {
    const permisos = await usersService.listPermisos();
    res.json(permisos);
  } catch (err) {
    next(err);
  }
}

export async function updateRolPermisos(req: Request, res: Response, next: NextFunction) {
  try {
    const rolId = parseInt(req.params.rolId);
    if (isNaN(rolId)) {
      res.status(400).json({ error: "rolId inválido" });
      return;
    }
    const { permisoIds } = updateRolPermisosSchema.parse(req.body);
    const rol = await usersService.updateRolPermisos(rolId, permisoIds);
    res.json(rol);
  } catch (err) {
    next(err);
  }
}
