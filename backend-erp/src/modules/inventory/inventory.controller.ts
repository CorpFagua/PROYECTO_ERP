import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as inventoryService from "./inventory.service.js";

// ─── Schemas ─────────────────────────────────────────────────

const productoCreateSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  precio: z.number().positive("El precio debe ser positivo"),
  idTipoProducto: z.number().int().positive(),
});

const productoUpdateSchema = z.object({
  nombre: z.string().min(1).optional(),
  precio: z.number().positive().optional(),
  idTipoProducto: z.number().int().positive().optional(),
  activo: z.boolean().optional(),
});

const sucursalCreateSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  domicilio: z.string().optional(),
  idLocalidad: z.number().int().positive(),
});

const sucursalUpdateSchema = z.object({
  nombre: z.string().min(1).optional(),
  domicilio: z.string().optional(),
  idLocalidad: z.number().int().positive().optional(),
  activa: z.boolean().optional(),
});

const proveedorCreateSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").optional(),
  domicilio: z.string().optional(),
  idLocalidad: z.number().int().positive(),
});

const proveedorUpdateSchema = z.object({
  nombre: z.string().min(1).optional(),
  domicilio: z.string().optional(),
  idLocalidad: z.number().int().positive().optional(),
});

const compraSchema = z.object({
  fecha: z.string().datetime({ offset: true }).or(z.string().date()),
  idProducto: z.number().int().positive(),
  cantidad: z.number().int().positive(),
  precio: z.number().positive(),
  idProveedor: z.number().int().positive(),
});

const ventaSchema = z.object({
  fecha: z.string().datetime({ offset: true }).or(z.string().date()),
  fechaEntrega: z.string().datetime({ offset: true }).or(z.string().date()),
  idCanal: z.number().int().positive().optional(),
  idCliente: z.number().int().positive().optional(),
  idSucursal: z.number().int().positive().optional(),
  idEmpleado: z.number().int().positive().optional(),
  idProducto: z.number().int().positive(),
  precio: z.number().positive(),
  cantidad: z.number().int().positive(),
});

// ─── Productos ───────────────────────────────────────────────

export async function listProductos(req: Request, res: Response, next: NextFunction) {
  try {
    const idTipo = req.query.tipo ? Number(req.query.tipo) : undefined;
    const productos = await inventoryService.listProductos({ idTipoProducto: idTipo });
    res.json(productos);
  } catch (err) {
    next(err);
  }
}

export async function getProducto(req: Request, res: Response, next: NextFunction) {
  try {
    const producto = await inventoryService.getProducto(Number(req.params.id));
    res.json(producto);
  } catch (err) {
    next(err);
  }
}

export async function listTiposProducto(_req: Request, res: Response, next: NextFunction) {
  try {
    const tipos = await inventoryService.listTiposProducto();
    res.json(tipos);
  } catch (err) {
    next(err);
  }
}

// ─── Sucursales ───────────────────────────────────────────────

export async function listSucursales(_req: Request, res: Response, next: NextFunction) {
  try {
    const sucursales = await inventoryService.listSucursales();
    res.json(sucursales);
  } catch (err) {
    next(err);
  }
}

export async function getSucursal(req: Request, res: Response, next: NextFunction) {
  try {
    const sucursal = await inventoryService.getSucursal(Number(req.params.id));
    res.json(sucursal);
  } catch (err) {
    next(err);
  }
}

// ─── Proveedores ──────────────────────────────────────────────

export async function listProveedores(_req: Request, res: Response, next: NextFunction) {
  try {
    const proveedores = await inventoryService.listProveedores();
    res.json(proveedores);
  } catch (err) {
    next(err);
  }
}

// ─── Compras ─────────────────────────────────────────────────

export async function registrarCompra(req: Request, res: Response, next: NextFunction) {
  try {
    const data = compraSchema.parse(req.body);
    const compra = await inventoryService.registrarCompra({
      ...data,
      fecha: new Date(data.fecha),
    });
    res.status(201).json(compra);
  } catch (err) {
    next(err);
  }
}

export async function listCompras(req: Request, res: Response, next: NextFunction) {
  try {
    const compras = await inventoryService.listCompras({
      idProducto: req.query.idProducto ? Number(req.query.idProducto) : undefined,
      idProveedor: req.query.idProveedor ? Number(req.query.idProveedor) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(compras);
  } catch (err) {
    next(err);
  }
}

// ─── Ventas ──────────────────────────────────────────────────

export async function registrarVenta(req: Request, res: Response, next: NextFunction) {
  try {
    const data = ventaSchema.parse(req.body);
    const venta = await inventoryService.registrarVenta({
      ...data,
      fecha: new Date(data.fecha),
      fechaEntrega: new Date(data.fechaEntrega),
      idEmpleado: data.idEmpleado ?? req.user?.empleadoId,
    });
    res.status(201).json(venta);
  } catch (err) {
    next(err);
  }
}

export async function listVentas(req: Request, res: Response, next: NextFunction) {
  try {
    const ventas = await inventoryService.listVentas({
      idProducto: req.query.idProducto ? Number(req.query.idProducto) : undefined,
      idSucursal: req.query.idSucursal ? Number(req.query.idSucursal) : undefined,
      idEmpleado: req.query.idEmpleado ? Number(req.query.idEmpleado) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(ventas);
  } catch (err) {
    next(err);
  }
}

// ─── Stock ───────────────────────────────────────────────────

export async function getStockLevels(req: Request, res: Response, next: NextFunction) {
  try {
    const levels = await inventoryService.getStockLevels(
      req.query.idSucursal ? Number(req.query.idSucursal) : undefined,
    );
    res.json(levels);
  } catch (err) {
    next(err);
  }
}

// ─── CRUD Productos ──────────────────────────────────────────

export async function createProducto(req: Request, res: Response, next: NextFunction) {
  try {
    const data = productoCreateSchema.parse(req.body);
    const producto = await inventoryService.createProducto(data);
    res.status(201).json(producto);
  } catch (err) {
    next(err);
  }
}

export async function updateProducto(req: Request, res: Response, next: NextFunction) {
  try {
    const data = productoUpdateSchema.parse(req.body);
    const producto = await inventoryService.updateProducto(Number(req.params.id), data);
    res.json(producto);
  } catch (err) {
    next(err);
  }
}

export async function deleteProducto(req: Request, res: Response, next: NextFunction) {
  try {
    await inventoryService.deleteProducto(Number(req.params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ─── CRUD Sucursales ─────────────────────────────────────────

export async function createSucursal(req: Request, res: Response, next: NextFunction) {
  try {
    const data = sucursalCreateSchema.parse(req.body);
    const sucursal = await inventoryService.createSucursal(data);
    res.status(201).json(sucursal);
  } catch (err) {
    next(err);
  }
}

export async function updateSucursal(req: Request, res: Response, next: NextFunction) {
  try {
    const data = sucursalUpdateSchema.parse(req.body);
    const sucursal = await inventoryService.updateSucursal(Number(req.params.id), data);
    res.json(sucursal);
  } catch (err) {
    next(err);
  }
}

// ─── CRUD Proveedores ────────────────────────────────────────

export async function createProveedor(req: Request, res: Response, next: NextFunction) {
  try {
    const data = proveedorCreateSchema.parse(req.body);
    const proveedor = await inventoryService.createProveedor(data);
    res.status(201).json(proveedor);
  } catch (err) {
    next(err);
  }
}

export async function updateProveedor(req: Request, res: Response, next: NextFunction) {
  try {
    const data = proveedorUpdateSchema.parse(req.body);
    const proveedor = await inventoryService.updateProveedor(Number(req.params.id), data);
    res.json(proveedor);
  } catch (err) {
    next(err);
  }
}

// ─── Localidades ─────────────────────────────────────────────

export async function listLocalidades(_req: Request, res: Response, next: NextFunction) {
  try {
    const localidades = await inventoryService.listLocalidades();
    res.json(localidades);
  } catch (err) {
    next(err);
  }
}
