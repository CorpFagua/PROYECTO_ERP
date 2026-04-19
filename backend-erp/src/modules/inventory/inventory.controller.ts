import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as inventoryService from "./inventory.service.js";

// ─── Schemas ─────────────────────────────────────────────────

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  unit: z.string().optional(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).optional(),
});

const updateProductSchema = createProductSchema.partial();

const createMovementSchema = z.object({
  productId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number().int().min(1),
  reason: z.string().optional(),
});

const createWarehouseSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
});

// ─── Productos ───────────────────────────────────────────────

export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const products = await inventoryService.listProducts({
      category: req.query.category as string | undefined,
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await inventoryService.getProduct(req.params.id);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await inventoryService.createProduct(data);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateProductSchema.parse(req.body);
    const product = await inventoryService.updateProduct(req.params.id, data);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

// ─── Bodegas ─────────────────────────────────────────────────

export async function listWarehouses(_req: Request, res: Response, next: NextFunction) {
  try {
    const warehouses = await inventoryService.listWarehouses();
    res.json(warehouses);
  } catch (err) {
    next(err);
  }
}

export async function createWarehouse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createWarehouseSchema.parse(req.body);
    const warehouse = await inventoryService.createWarehouse(data);
    res.status(201).json(warehouse);
  } catch (err) {
    next(err);
  }
}

// ─── Movimientos ─────────────────────────────────────────────

export async function registerMovement(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createMovementSchema.parse(req.body);
    const movement = await inventoryService.registerMovement({
      ...data,
      userId: req.user!.userId,
    });
    res.status(201).json(movement);
  } catch (err) {
    next(err);
  }
}

export async function listMovements(req: Request, res: Response, next: NextFunction) {
  try {
    const movements = await inventoryService.listMovements({
      productId: req.query.productId as string | undefined,
      warehouseId: req.query.warehouseId as string | undefined,
    });
    res.json(movements);
  } catch (err) {
    next(err);
  }
}

// ─── Stock ───────────────────────────────────────────────────

export async function getStockLevels(req: Request, res: Response, next: NextFunction) {
  try {
    const levels = await inventoryService.getStockLevels(
      req.query.warehouseId as string | undefined
    );
    res.json(levels);
  } catch (err) {
    next(err);
  }
}
