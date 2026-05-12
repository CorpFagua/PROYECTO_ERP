import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";

// ─── Usuarios ────────────────────────────────────────────────

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      rol: { select: { id: true, nombre: true } },
      empleado: { select: { id: true, nombre: true, apellido: true } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    active: u.active,
    createdAt: u.createdAt,
    rol: u.rol,
    empleado: u.empleado ?? null,
  }));
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  rolId: number;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, "El correo ya está registrado");

  const rol = await prisma.rol.findUnique({ where: { id: input.rolId } });
  if (!rol) throw new AppError(400, "Rol no válido");

  const hashedPassword = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      name: input.name,
      rolId: input.rolId,
    },
    include: {
      rol: { select: { id: true, nombre: true } },
    },
  });
  return { id: user.id, email: user.email, name: user.name, active: user.active, rol: user.rol };
}

export async function updateUser(
  id: string,
  input: { name?: string; email?: string; rolId?: number; password?: string },
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, "Usuario no encontrado");

  if (input.email && input.email !== user.email) {
    const conflict = await prisma.user.findUnique({ where: { email: input.email } });
    if (conflict) throw new AppError(409, "El correo ya está en uso");
  }
  if (input.rolId) {
    const rol = await prisma.rol.findUnique({ where: { id: input.rolId } });
    if (!rol) throw new AppError(400, "Rol no válido");
  }

  const data: Record<string, unknown> = {};
  if (input.name) data.name = input.name;
  if (input.email) data.email = input.email;
  if (input.rolId) data.rolId = input.rolId;
  if (input.password) data.password = await bcrypt.hash(input.password, 12);

  const updated = await prisma.user.update({
    where: { id },
    data,
    include: { rol: { select: { id: true, nombre: true } } },
  });
  return { id: updated.id, email: updated.email, name: updated.name, active: updated.active, rol: updated.rol };
}

export async function toggleUserActive(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, "Usuario no encontrado");

  const updated = await prisma.user.update({
    where: { id },
    data: { active: !user.active },
    include: { rol: { select: { id: true, nombre: true } } },
  });
  return { id: updated.id, email: updated.email, name: updated.name, active: updated.active, rol: updated.rol };
}

// ─── Roles y permisos ─────────────────────────────────────────

export async function listRoles() {
  return prisma.rol.findMany({
    where: { activo: true },
    orderBy: { id: "asc" },
    include: {
      permisos: {
        include: { permiso: true },
      },
    },
  });
}

export async function listPermisos() {
  return prisma.permiso.findMany({ orderBy: [{ modulo: "asc" }, { accion: "asc" }] });
}

export async function updateRolPermisos(rolId: number, permisoIds: number[]) {
  const rol = await prisma.rol.findUnique({ where: { id: rolId } });
  if (!rol) throw new AppError(404, "Rol no encontrado");

  // Reemplazar todos los permisos del rol
  await prisma.$transaction([
    prisma.rolPermiso.deleteMany({ where: { rolId } }),
    prisma.rolPermiso.createMany({
      data: permisoIds.map((permisoId) => ({ rolId, permisoId })),
      skipDuplicates: true,
    }),
  ]);

  return prisma.rol.findUnique({
    where: { id: rolId },
    include: { permisos: { include: { permiso: true } } },
  });
}
