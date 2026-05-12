import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.js";
import * as usersController from "./users.controller.js";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// ─── Usuarios ────────────────────────────────────────────────
router.get("/", authorize("usuarios:ver"), usersController.listUsers);
router.post("/", authorize("usuarios:gestionar"), usersController.createUser);
router.put("/:id", authorize("usuarios:gestionar"), usersController.updateUser);
router.patch("/:id/toggle-active", authorize("usuarios:gestionar"), usersController.toggleUserActive);

// ─── Roles y permisos ─────────────────────────────────────────
router.get("/roles", authorize("usuarios:ver"), usersController.listRoles);
router.get("/permisos", authorize("usuarios:ver"), usersController.listPermisos);
router.put("/roles/:rolId/permisos", authorize("sistema:configurar"), usersController.updateRolPermisos);

export { router as usersRoutes };
