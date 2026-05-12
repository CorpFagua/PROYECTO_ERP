import { Router } from "express";
import * as inventoryController from "./inventory.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";

const router = Router();

router.use(authenticate);

// Productos
router.get("/products",           authorize("inventario:ver"),       inventoryController.listProductos);
router.get("/products/:id",       authorize("inventario:ver"),       inventoryController.getProducto);
router.post("/products",          authorize("inventario:crear"),     inventoryController.createProducto);
router.patch("/products/:id",     authorize("inventario:editar"),    inventoryController.updateProducto);
router.delete("/products/:id",    authorize("inventario:eliminar"),  inventoryController.deleteProducto);
router.get("/product-types",      authorize("inventario:ver"),       inventoryController.listTiposProducto);

// Sucursales
router.get("/sucursales",         authorize("inventario:ver"),          inventoryController.listSucursales);
router.get("/sucursales/:id",     authorize("inventario:ver"),          inventoryController.getSucursal);
router.post("/sucursales",        authorize("sucursales:gestionar"),    inventoryController.createSucursal);
router.patch("/sucursales/:id",   authorize("sucursales:gestionar"),    inventoryController.updateSucursal);

// Proveedores
router.get("/proveedores",        authorize("compras:ver"),              inventoryController.listProveedores);
router.post("/proveedores",       authorize("proveedores:gestionar"),   inventoryController.createProveedor);
router.patch("/proveedores/:id",  authorize("proveedores:gestionar"),   inventoryController.updateProveedor);

// Localidades (lookup)
router.get("/localidades",        authorize("inventario:ver"),          inventoryController.listLocalidades);

// Compras
router.post("/compras",           authorize("compras:crear"),            inventoryController.registrarCompra);
router.get("/compras",            authorize("compras:ver"),              inventoryController.listCompras);

// Ventas
router.post("/ventas",            authorize("ventas:crear"),             inventoryController.registrarVenta);
router.get("/ventas",             authorize("ventas:ver"),               inventoryController.listVentas);

// Stock
router.get("/stock",                   authorize("inventario:ver"),       inventoryController.getStockLevels);
router.post("/stock/transferir",       authorize("inventario:editar"),    inventoryController.transferirStock);

export { router as inventoryRoutes };
