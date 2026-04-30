import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";

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

// ─── Proveedores ──────────────────────────────────────────────

export async function listProveedores() {
  return prisma.proveedor.findMany({
    include: { localidad: true },
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

  // Compra no está vinculada a una sucursal específica (es un ingreso al sistema)
  // Se actualiza el stock del depósito (sucursal 9 = "Deposito" en el seed)
  const DEPOSITO_ID = 9;

  const compra = await prisma.$transaction(async (tx) => {
    const c = await tx.compra.create({
      data: {
        fecha: input.fecha,
        idProducto: input.idProducto,
        cantidad: input.cantidad,
        precio: input.precio,
        idProveedor: input.idProveedor,
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
