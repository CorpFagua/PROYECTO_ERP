import { Router } from "express";
import * as inventoryController from "./inventory.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";

const router = Router();

router.use(authenticate);

// Productos
router.get("/products",           authorize("inventario:ver"),    inventoryController.listProductos);
router.get("/products/:id",       authorize("inventario:ver"),    inventoryController.getProducto);
router.get("/product-types",      authorize("inventario:ver"),    inventoryController.listTiposProducto);

// Sucursales
router.get("/sucursales",         authorize("inventario:ver"),    inventoryController.listSucursales);
router.get("/sucursales/:id",     authorize("inventario:ver"),    inventoryController.getSucursal);

// Proveedores
router.get("/proveedores",        authorize("compras:ver"),       inventoryController.listProveedores);

// Compras
router.post("/compras",           authorize("compras:crear"),     inventoryController.registrarCompra);
router.get("/compras",            authorize("compras:ver"),       inventoryController.listCompras);

// Ventas
router.post("/ventas",            authorize("ventas:crear"),      inventoryController.registrarVenta);
router.get("/ventas",             authorize("ventas:ver"),        inventoryController.listVentas);

// Stock
router.get("/stock",              authorize("inventario:ver"),    inventoryController.getStockLevels);

export { router as inventoryRoutes };
