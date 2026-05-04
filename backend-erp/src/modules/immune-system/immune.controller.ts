import { Request, Response, NextFunction } from "express";
import * as immuneService from "./immune.service.js";

export async function runScan(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await immuneService.runFullScan();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAnomalies(req: Request, res: Response, next: NextFunction) {
  try {
    const anomalies = await immuneService.getAnomalyLogs({
      severity: req.query.severity as string | undefined,
      detectorType: req.query.detectorType as string | undefined,
      acknowledged: req.query.acknowledged === "true" ? true : req.query.acknowledged === "false" ? false : undefined,
    });
    res.json(anomalies);
  } catch (err) {
    next(err);
  }
}

export async function acknowledgeAnomaly(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const anomaly = await immuneService.acknowledgeAnomaly(id);
    res.json(anomaly);
  } catch (err) {
    next(err);
  }
}

export async function getStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    const status = await immuneService.getSystemStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
}

export async function getPendingCompras(_req: Request, res: Response, next: NextFunction) {
  try {
    const compras = await immuneService.listComprasPendientes();
    res.json(compras);
  } catch (err) {
    next(err);
  }
}

export async function resolverCompra(req: Request, res: Response, next: NextFunction) {
  try {
    const compraId = Number(req.params.compraId);
    const { accion } = req.body as { accion: "APPROVE" | "REJECT" };
    if (!compraId || !["APPROVE", "REJECT"].includes(accion)) {
      res.status(400).json({ error: "compraId y accion (APPROVE | REJECT) son requeridos" });
      return;
    }
    const userId = req.user!.userId;
    const result = await immuneService.resolverCompra(compraId, accion, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
