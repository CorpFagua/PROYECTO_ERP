import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import {
  scanNuevoProducto,
  scanNuevaCompra,
  scanNuevaVenta,
} from "../immune-system/immune.service.js";

// ─── Productos ───────────────────────────────────────────────

export async function listProductos(filters?: { idTipoProducto?: number; activo?: boolean }) {
  return prisma.producto.findMany({
    where: {
      ...(filters?.idTipoProducto && { idTipoProducto: filters.idTipoProducto }),
      activo: filters?.activo ?? true,
    },
    include: { tipoProducto: true },
    orderBy: { nombre: "asc" },
  });
}

export async function getProducto(id: number) {
  const producto = await prisma.producto.findUnique({
    where: { id },
    include: {
      tipoProducto: true,
      stockLevels: { include: { sucursal: true } },
    },
  });
  if (!producto) throw new AppError(404, "Producto no encontrado");
  return producto;
}

export async function listTiposProducto() {
  return prisma.tipoProducto.findMany({ orderBy: { nombre: "asc" } });
}

export async function createProducto(input: {
  nombre: string;
  precio: number;
  idTipoProducto: number;
}) {
  const tipo = await prisma.tipoProducto.findUnique({ where: { id: input.idTipoProducto } });
  if (!tipo) throw new AppError(400, "Tipo de producto no válido");
  const producto = await prisma.producto.create({
    data: { ...input, activo: true },
    include: { tipoProducto: true },
  });
  // AIS — Self: escaneo reactivo de precio tras la creación
  scanNuevoProducto(producto.id).catch(() => undefined);
  return producto;
}

export async function updateProducto(
  id: number,
  input: { nombre?: string; precio?: number; idTipoProducto?: number; activo?: boolean },
) {
  const existing = await prisma.producto.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Producto no encontrado");
  return prisma.producto.update({
    where: { id },
    data: input,
    include: { tipoProducto: true },
  });
}

/** Baja lógica: marca activo = false */
export async function deleteProducto(id: number) {
  const existing = await prisma.producto.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Producto no encontrado");
  return prisma.producto.update({ where: { id }, data: { activo: false } });
}

// ─── Sucursales ───────────────────────────────────────────────

export async function listSucursales() {
  return prisma.sucursal.findMany({
    where: { activa: true },
    include: { localidad: true },
    orderBy: { nombre: "asc" },
  });
}

export async function getSucursal(id: number) {
  const sucursal = await prisma.sucursal.findUnique({
    where: { id },
    include: { localidad: true },
  });
  if (!sucursal) throw new AppError(404, "Sucursal no encontrada");
  return sucursal;
}

export async function createSucursal(input: {
  nombre: string;
  domicilio?: string;
  idLocalidad: number;
}) {
  return prisma.sucursal.create({
    data: { ...input, activa: true },
    include: { localidad: true },
  });
}

export async function updateSucursal(
  id: number,
  input: { nombre?: string; domicilio?: string; idLocalidad?: number; activa?: boolean },
) {
  const existing = await prisma.sucursal.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Sucursal no encontrada");
  return prisma.sucursal.update({
    where: { id },
    data: input,
    include: { localidad: true },
  });
}

// ─── Proveedores ──────────────────────────────────────────────

export async function listProveedores() {
  return prisma.proveedor.findMany({
    include: { localidad: true },
    orderBy: { nombre: "asc" },
  });
}

export async function createProveedor(input: {
  nombre?: string;
  domicilio?: string;
  idLocalidad: number;
}) {
  return prisma.proveedor.create({
    data: input,
    include: { localidad: true },
  });
}

export async function updateProveedor(
  id: number,
  input: { nombre?: string; domicilio?: string; idLocalidad?: number },
) {
  const existing = await prisma.proveedor.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Proveedor no encontrado");
  return prisma.proveedor.update({
    where: { id },
    data: input,
    include: { localidad: true },
  });
}

// ─── Localidades ──────────────────────────────────────────────

export async function listLocalidades() {
  return prisma.localidad.findMany({
    orderBy: { nombre: "asc" },
  });
}

// ─── Compras ─────────────────────────────────────────────────

interface CreateCompraInput {
  id?: number;
  fecha: Date;
  idProducto: number;
  cantidad: number;
  precio: number;
  idProveedor: number;
}

export async function registrarCompra(input: CreateCompraInput) {
  const [producto, proveedor] = await Promise.all([
    prisma.producto.findUnique({ where: { id: input.idProducto } }),
    prisma.proveedor.findUnique({ where: { id: input.idProveedor } }),
  ]);
  if (!producto) throw new AppError(404, "Producto no encontrado");
  if (!proveedor) throw new AppError(404, "Proveedor no encontrado");

  // AIS — Self: analizar la compra ANTES de persistir (IQR dinámico)
  // Si es outlier extremo → PENDING_APPROVAL, sin ingresar stock todavía.
  const aisResult = await scanNuevaCompra({
    idProducto: input.idProducto,
    cantidad: input.cantidad,
    precio: input.precio,
  });

  const DEPOSITO_ID = 9;

  if (aisResult.requiresApproval) {
    // Guardar la compra bloqueada SIN actualizar stock
    const compra = await prisma.compra.create({
      data: {
        fecha: input.fecha,
        idProducto: input.idProducto,
        cantidad: input.cantidad,
        precio: input.precio,
        idProveedor: input.idProveedor,
        status: "PENDING_APPROVAL",
        anomalyLogId: aisResult.anomalyLogId,
      },
    });
    return { ...compra, _aisBlocked: true };
  }

  // Flujo normal: crear compra y actualizar stock en una transacción
  const compra = await prisma.$transaction(async (tx) => {
    const c = await tx.compra.create({
      data: {
        fecha: input.fecha,
        idProducto: input.idProducto,
        cantidad: input.cantidad,
        precio: input.precio,
        idProveedor: input.idProveedor,
        status: "NORMAL",
      },
    });

    await tx.stockLevel.upsert({
      where: { idProducto_idSucursal: { idProducto: input.idProducto, idSucursal: DEPOSITO_ID } },
      update: { cantidad: { increment: input.cantidad } },
      create: { idProducto: input.idProducto, idSucursal: DEPOSITO_ID, cantidad: input.cantidad },
    });

    return c;
  });

  return compra;
}

export async function listCompras(filters?: {
  idProducto?: number;
  idProveedor?: number;
  limit?: number;
}) {
  return prisma.compra.findMany({
    where: {
      ...(filters?.idProducto && { idProducto: filters.idProducto }),
      ...(filters?.idProveedor && { idProveedor: filters.idProveedor }),
    },
    include: {
      producto: { include: { tipoProducto: true } },
      proveedor: true,
    },
    orderBy: { fecha: "desc" },
    take: filters?.limit ?? 50,
  });
}

// ─── Ventas ──────────────────────────────────────────────────

interface CreateVentaInput {
  id?: number;
  fecha: Date;
  fechaEntrega: Date;
  idCanal?: number;
  idCliente?: number;
  idSucursal?: number;
  idEmpleado?: number;
  idProducto: number;
  precio: number;
  cantidad: number;
}

export async function registrarVenta(input: CreateVentaInput) {
  const producto = await prisma.producto.findUnique({ where: { id: input.idProducto } });
  if (!producto) throw new AppError(404, "Producto no encontrado");

  if (input.idSucursal) {
    const stock = await prisma.stockLevel.findUnique({
      where: { idProducto_idSucursal: { idProducto: input.idProducto, idSucursal: input.idSucursal } },
    });
    if (!stock || stock.cantidad < input.cantidad) {
      throw new AppError(422, "Stock insuficiente en la sucursal");
    }
  }

  const venta = await prisma.$transaction(async (tx) => {
    const v = await tx.venta.create({
      data: {
        fecha: input.fecha,
        fechaEntrega: input.fechaEntrega,
        idCanal: input.idCanal,
        idCliente: input.idCliente,
        idSucursal: input.idSucursal,
        idEmpleado: input.idEmpleado,
        idProducto: input.idProducto,
        precio: input.precio,
        cantidad: input.cantidad,
      },
    });

    if (input.idSucursal) {
      await tx.stockLevel.update({
        where: { idProducto_idSucursal: { idProducto: input.idProducto, idSucursal: input.idSucursal } },
        data: { cantidad: { decrement: input.cantidad } },
      });
    }

    return v;
  });

  // AIS — Self: escaneo reactivo de stock tras el descuento
  scanNuevaVenta({
    idProducto: input.idProducto,
    cantidad: input.cantidad,
    idSucursal: input.idSucursal,
  }).catch(() => undefined);

  return venta;
}

export async function listVentas(filters?: {
  idProducto?: number;
  idSucursal?: number;
  idEmpleado?: number;
  limit?: number;
}) {
  return prisma.venta.findMany({
    where: {
      ...(filters?.idProducto && { idProducto: filters.idProducto }),
      ...(filters?.idSucursal && { idSucursal: filters.idSucursal }),
      ...(filters?.idEmpleado && { idEmpleado: filters.idEmpleado }),
    },
    include: {
      producto: { include: { tipoProducto: true } },
      sucursal: true,
      canal: true,
    },
    orderBy: { fecha: "desc" },
    take: filters?.limit ?? 50,
  });
}

// ─── Stock ────────────────────────────────────────────────────

export async function getStockLevels(idSucursal?: number) {
  return prisma.stockLevel.findMany({
    where: { ...(idSucursal && { idSucursal }) },
    include: {
      producto: { include: { tipoProducto: true } },
      sucursal: true,
    },
    orderBy: { cantidad: "asc" },
  });
}
