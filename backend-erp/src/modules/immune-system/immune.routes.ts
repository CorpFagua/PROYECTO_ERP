import { Router } from "express";
import * as immuneController from "./immune.controller.js";
import { authenticate, authorize } from "../../middleware/auth.js";

const router = Router();

// Todas las rutas del sistema inmunológico requieren autenticación
router.use(authenticate);

// Ejecutar escaneo completo (solo ADMIN y MANAGER)
router.post("/scan", authorize("ADMIN", "MANAGER"), immuneController.runScan);

// Consultar anomalías
router.get("/anomalies", immuneController.getAnomalies);

// Marcar anomalía como atendida
router.patch("/anomalies/:id/acknowledge", immuneController.acknowledgeAnomaly);

// Estado general del sistema
router.get("/status", immuneController.getStatus);

export { router as immuneRoutes };
