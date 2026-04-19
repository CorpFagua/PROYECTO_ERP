import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errorHandler.js";

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, "El correo ya está registrado");
  }

  const hashedPassword = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      name: input.name,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  const token = signToken(user.id, user.email, user.role);
  return { user, token };
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

  const token = signToken(user.id, user.email, user.role);
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError(404, "Usuario no encontrado");
  return user;
}

function signToken(userId: string, email: string, role: string): string {
  return jwt.sign({ userId, email, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}
