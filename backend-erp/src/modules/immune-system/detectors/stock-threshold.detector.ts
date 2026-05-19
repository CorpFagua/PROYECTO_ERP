import { Severity } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import type { AnomalyDetector, AnomalyDetectorResult } from "./base-detector.js";

/**
 * Calcula media y desviación estándar poblacional de un array de valores.
 */
function computeStats(values: number[]): { mean: number; stddev: number } {
  if (values.length === 0) return { mean: 0, stddev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

/**
 * Detector de umbral de stock.
 *
 * Analogía inmunológica (PRR — Pattern Recognition Receptor):
 * Actúa como receptor innato que reconoce "patrones de peligro" en los
 * niveles de stock usando la regla estadística de 3 desviaciones estándar
 * (regla 3σ): un stock es atípicamente bajo cuando cae por debajo de
 * media − 3σ del sistema, lo que representa datos atípicos según la
 * distribución normal empírica.
 *
 * Señales de peligro detectadas:
 * - Stock = 0 en sucursal activa          → CRITICAL
 * - Stock < media − 3σ (outlier inferior) → HIGH
 */
export class StockThresholdDetector implements AnomalyDetector {
  readonly type = "STOCK_THRESHOLD";
  readonly description =
    "Detecta productos activos con stock agotado o estadísticamente atípico bajo (regla 3σ)";

  async scan(): Promise<AnomalyDetectorResult[]> {
    const results: AnomalyDetectorResult[] = [];

    const stockLevels = await prisma.stockLevel.findMany({
      include: { producto: true, sucursal: true },
      where: { producto: { activo: true } },
      orderBy: { cantidad: "asc" },
    });

    // Calcular media y desviación estándar del stock en todo el sistema
    const quantities = stockLevels.map((s) => Number(s.cantidad));
    const { mean, stddev } = computeStats(quantities);

    // Umbral estadístico inferior: media − 3σ (mínimo 0)
    const lowStockThreshold = Math.max(0, mean - 3 * stddev);

    for (const level of stockLevels) {
      const { producto, sucursal, cantidad } = level;

      // Stock en cero — CRITICAL
      if (cantidad === 0) {
        results.push({
          detected: true,
          detectorType: this.type,
          severity: "CRITICAL" as Severity,
          description: `Stock agotado: "${producto.nombre}" en sucursal "${sucursal.nombre}"`,
          metadata: {
            productoId: producto.id,
            sucursalId: sucursal.id,
            nombreProducto: producto.nombre,
            nombreSucursal: sucursal.nombre,
            cantidad,
          },
        });
        continue;
      }

      // Stock atípicamente bajo: por debajo de media − 3σ — HIGH
      if (cantidad <= lowStockThreshold) {
        results.push({
          detected: true,
          detectorType: this.type,
          severity: "HIGH" as Severity,
          description: `Stock atípico bajo: "${producto.nombre}" tiene ${cantidad} unidades en "${sucursal.nombre}" (umbral 3σ: ${Math.round(lowStockThreshold)}, media: ${Math.round(mean)}, σ: ${Math.round(stddev)})`,
          metadata: {
            productoId: producto.id,
            sucursalId: sucursal.id,
            nombreProducto: producto.nombre,
            nombreSucursal: sucursal.nombre,
            cantidad,
            umbralEstadistico: parseFloat(lowStockThreshold.toFixed(2)),
            media: parseFloat(mean.toFixed(2)),
            desviacionEstandar: parseFloat(stddev.toFixed(2)),
          },
        });
      }
    }

    return results;
  }
}
