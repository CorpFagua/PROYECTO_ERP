import { Router } from "express";
import * as inventoryController from "./inventory.controller.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

// Todas las rutas de inventario requieren autenticación
router.use(authenticate);

// Productos
router.get("/products", inventoryController.listProducts);
router.get("/products/:id", inventoryController.getProduct);
router.post("/products", inventoryController.createProduct);
router.patch("/products/:id", inventoryController.updateProduct);

// Bodegas
router.get("/warehouses", inventoryController.listWarehouses);
router.post("/warehouses", inventoryController.createWarehouse);

// Movimientos
router.post("/movements", inventoryController.registerMovement);
router.get("/movements", inventoryController.listMovements);

// Stock
router.get("/stock", inventoryController.getStockLevels);

export { router as inventoryRoutes };
