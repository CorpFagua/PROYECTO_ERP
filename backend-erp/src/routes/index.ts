import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { inventoryRoutes } from "../modules/inventory/inventory.routes.js";
import { immuneRoutes } from "../modules/immune-system/immune.routes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/inventory", inventoryRoutes);
apiRouter.use("/immune", immuneRoutes);

export { apiRouter };
