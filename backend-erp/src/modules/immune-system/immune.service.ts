import { prisma } from "../../lib/prisma.js";
import type { AnomalyDetector, AnomalyDetectorResult } from "./detectors/base-detector.js";
import { StockThresholdDetector } from "./detectors/stock-threshold.detector.js";
import { UnusualMovementDetector } from "./detectors/unusual-movement.detector.js";

/**
 * Servicio principal del Sistema Inmunológico Artificial (AIS).
 *
 * Orquesta múltiples detectores de anomalías — cada uno actuando como
 * un tipo de célula inmunológica especializada. El servicio coordina
 * los escaneos, registra las anomalías encontradas y expone el estado
 * del "sistema inmune" del inventario.
 *
 * Arquitectura extensible: para agregar un nuevo detector, basta con
 * implementar la interfaz AnomalyDetector y registrarlo aquí.
 */

// Registro de detectores activos
const detectors: AnomalyDetector[] = [
  new StockThresholdDetector(),
  new UnusualMovementDetector(),
];

/**
 * Ejecuta todos los detectores registrados y persiste las anomalías encontradas.
 */
export async function runFullScan() {
  const allResults: AnomalyDetectorResult[] = [];

  for (const detector of detectors) {
    const results = await detector.scan();
    allResults.push(...results);
  }

  // Persistir anomalías detectadas
  if (allResults.length > 0) {
    await prisma.anomalyLog.createMany({
      data: allResults
        .filter((r) => r.detected)
        .map((r) => ({
          detectorType: r.detectorType,
          severity: r.severity,
          description: r.description,
          metadata: r.metadata ?? undefined,
        })),
    });
  }

  return {
    scannedAt: new Date().toISOString(),
    detectorsRun: detectors.map((d) => d.type),
    anomaliesFound: allResults.filter((r) => r.detected).length,
    results: allResults,
  };
}

/**
 * Consulta el historial de anomalías registradas.
 */
export async function getAnomalyLogs(filters?: {
  severity?: string;
  detectorType?: string;
  acknowledged?: boolean;
  limit?: number;
}) {
  return prisma.anomalyLog.findMany({
    where: {
      ...(filters?.severity && { severity: filters.severity as any }),
      ...(filters?.detectorType && { detectorType: filters.detectorType }),
      ...(filters?.acknowledged !== undefined && { acknowledged: filters.acknowledged }),
    },
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? 50,
  });
}

/**
 * Marca una anomalía como reconocida/atendida.
 */
export async function acknowledgeAnomaly(id: string) {
  return prisma.anomalyLog.update({
    where: { id },
    data: { acknowledged: true },
  });
}

/**
 * Devuelve un resumen del estado actual del sistema inmunológico.
 */
export async function getSystemStatus() {
  const [total, unacknowledged, bySeverity] = await Promise.all([
    prisma.anomalyLog.count(),
    prisma.anomalyLog.count({ where: { acknowledged: false } }),
    prisma.anomalyLog.groupBy({
      by: ["severity"],
      where: { acknowledged: false },
      _count: true,
    }),
  ]);

  return {
    totalAnomalies: total,
    pendingAnomalies: unacknowledged,
    bySeverity: Object.fromEntries(bySeverity.map((s) => [s.severity, s._count])),
    detectors: detectors.map((d) => ({ type: d.type, description: d.description })),
  };
}
