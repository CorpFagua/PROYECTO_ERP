import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errorHandler.js";

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  rolId: number;
}

interface LoginInput {
  email: string;
  password: string;
}

// Carga un usuario con su rol y permisos completos
async function getUserWithPermisos(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      rol: {
        include: {
          permisos: {
            include: { permiso: true },
          },
        },
      },
      empleado: { select: { id: true, nombre: true, apellido: true } },
    },
  });
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, "El correo ya está registrado");
  }

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
  });

  const full = await getUserWithPermisos(user.id);
  const permisos = full!.rol.permisos.map((rp) => rp.permiso.codigo);
  const token = signToken(user.id, user.email, rol.nombre, permisos, undefined);

  return {
    user: { id: user.id, email: user.email, name: user.name, rol: rol.nombre },
    token,
  };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.active) {
    throw new AppError(401, "Credenciales inválidas");
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    throw new AppError(401, "Credenciales inválidas");
  }

  const full = await getUserWithPermisos(user.id);
  const permisos = full!.rol.permisos.map((rp) => rp.permiso.codigo);
  const token = signToken(
    user.id,
    user.email,
    full!.rol.nombre,
    permisos,
    full!.empleado?.id,
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      rol: full!.rol.nombre,
      permisos,
      empleado: full!.empleado ?? null,
    },
    token,
  };
}

export async function getProfile(userId: string) {
  const user = await getUserWithPermisos(userId);
  if (!user) throw new AppError(404, "Usuario no encontrado");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    rol: user.rol.nombre,
    permisos: user.rol.permisos.map((rp) => rp.permiso.codigo),
    empleado: user.empleado ?? null,
    createdAt: user.createdAt,
  };
}

function signToken(
  userId: string,
  email: string,
  role: string,
  permisos: string[],
  empleadoId?: number,
): string {
  return jwt.sign(
    { userId, email, role, permisos, ...(empleadoId && { empleadoId }) },
    env.JWT_SECRET,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: env.JWT_EXPIRES_IN as any },
  );
}
