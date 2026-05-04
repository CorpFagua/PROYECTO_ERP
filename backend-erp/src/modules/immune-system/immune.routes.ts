import { Router } from "express";
import * as immuneController from "./immune.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";

const router = Router();

// Todas las rutas del sistema inmunológico requieren autenticación
router.use(authenticate);

// Ejecutar escaneo completo (requiere permiso anomalias:gestionar)
router.post("/scan", authorize("anomalias:gestionar"), immuneController.runScan);

// Consultar anomalías
router.get("/anomalies", authorize("anomalias:ver"), immuneController.getAnomalies);

// Marcar anomalía como atendida
router.patch("/anomalies/:id/acknowledge", authorize("anomalias:gestionar"), immuneController.acknowledgeAnomaly);

// Estado general del sistema
router.get("/status", authorize("anomalias:ver"), immuneController.getStatus);

// Compras pendientes de aprobación (solo SUPER_ADMIN — permiso sistema:configurar)
router.get("/compras-pendientes", authorize("sistema:configurar"), immuneController.getPendingCompras);

// Aprobar o rechazar una compra bloqueada (solo SUPER_ADMIN)
router.post("/compras/:compraId/resolver", authorize("sistema:configurar"), immuneController.resolverCompra);

export { router as immuneRoutes };
