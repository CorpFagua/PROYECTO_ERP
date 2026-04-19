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
    const anomaly = await immuneService.acknowledgeAnomaly(req.params.id);
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
