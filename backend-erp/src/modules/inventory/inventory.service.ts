import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { MovementType } from "@prisma/client";

// ─── Productos ───────────────────────────────────────────────

interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit?: string;
  minStock?: number;
  maxStock?: number;
}

export async function listProducts(filters?: { category?: string; active?: boolean }) {
  return prisma.product.findMany({
    where: {
      ...(filters?.category && { category: filters.category }),
      active: filters?.active ?? true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { stockLevels: { include: { warehouse: true } } },
  });
  if (!product) throw new AppError(404, "Producto no encontrado");
  return product;
}

export async function createProduct(input: CreateProductInput) {
  const existing = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (existing) throw new AppError(409, "Ya existe un producto con ese SKU");

  return prisma.product.create({ data: input });
}

export async function updateProduct(id: string, input: Partial<CreateProductInput>) {
  await getProduct(id);
  return prisma.product.update({ where: { id }, data: input });
}

// ─── Bodegas ─────────────────────────────────────────────────

export async function listWarehouses() {
  return prisma.warehouse.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function createWarehouse(input: { name: string; location?: string }) {
  return prisma.warehouse.create({ data: input });
}

// ─── Movimientos de inventario ───────────────────────────────

interface CreateMovementInput {
  productId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  reason?: string;
  userId: string;
}

export async function registerMovement(input: CreateMovementInput) {
  // Validar que producto y bodega existan
  const [product, warehouse] = await Promise.all([
    prisma.product.findUnique({ where: { id: input.productId } }),
    prisma.warehouse.findUnique({ where: { id: input.warehouseId } }),
  ]);
  if (!product) throw new AppError(404, "Producto no encontrado");
  if (!warehouse) throw new AppError(404, "Bodega no encontrada");

  // Calcular delta
  const delta =
    input.type === "IN"
      ? input.quantity
      : input.type === "OUT"
        ? -input.quantity
        : input.quantity; // ADJUSTMENT usa el valor tal cual (puede ser + o -)

  // Transacción: crear movimiento + actualizar stock
  const [movement] = await prisma.$transaction([
    prisma.inventoryMovement.create({ data: input }),
    prisma.stockLevel.upsert({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
      update: { quantity: { increment: delta } },
      create: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: Math.max(0, delta),
      },
    }),
  ]);

  return movement;
}

export async function listMovements(filters?: {
  productId?: string;
  warehouseId?: string;
  limit?: number;
}) {
  return prisma.inventoryMovement.findMany({
    where: {
      ...(filters?.productId && { productId: filters.productId }),
      ...(filters?.warehouseId && { warehouseId: filters.warehouseId }),
    },
    include: { product: true, warehouse: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? 50,
  });
}

// ─── Stock ───────────────────────────────────────────────────

export async function getStockLevels(warehouseId?: string) {
  return prisma.stockLevel.findMany({
    where: warehouseId ? { warehouseId } : undefined,
    include: { product: true, warehouse: true },
    orderBy: { product: { name: "asc" } },
  });
}
