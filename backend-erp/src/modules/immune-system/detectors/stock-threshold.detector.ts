import { Severity } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import type { AnomalyDetector, AnomalyDetectorResult } from "./base-detector.js";

/**
 * Umbral operativo de stock bajo (unidades).
 * Configurable sin necesidad de campo minStock en el esquema.
 */
const LOW_STOCK_THRESHOLD = 10;

/**
 * Detector de umbral de stock.
 *
 * Analogía inmunológica (PRR — Pattern Recognition Receptor):
 * Actúa como receptor innato que reconoce "patrones de peligro" conocidos
 * en los niveles de stock. No requiere aprendizaje previo: sabe exactamente
 * qué constituye una señal de alarma (stock cero, stock crítico bajo).
 *
 * Señales de peligro detectadas:
 * - Stock = 0 en sucursal activa  → CRITICAL
 * - Stock ≤ LOW_STOCK_THRESHOLD   → HIGH
 */
export class StockThresholdDetector implements AnomalyDetector {
  readonly type = "STOCK_THRESHOLD";
  readonly description =
    "Detecta productos activos con stock agotado o en nivel crítico por sucursal";

  async scan(): Promise<AnomalyDetectorResult[]> {
    const results: AnomalyDetectorResult[] = [];

    const stockLevels = await prisma.stockLevel.findMany({
      include: { producto: true, sucursal: true },
      where: { producto: { activo: true } },
      orderBy: { cantidad: "asc" },
    });

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

      // Stock crítico bajo — HIGH
      if (cantidad <= LOW_STOCK_THRESHOLD) {
        results.push({
          detected: true,
          detectorType: this.type,
          severity: "HIGH" as Severity,
          description: `Stock crítico: "${producto.nombre}" tiene ${cantidad} unidades en "${sucursal.nombre}" (umbral mínimo: ${LOW_STOCK_THRESHOLD})`,
          metadata: {
            productoId: producto.id,
            sucursalId: sucursal.id,
            nombreProducto: producto.nombre,
            nombreSucursal: sucursal.nombre,
            cantidad,
            umbralMinimo: LOW_STOCK_THRESHOLD,
          },
        });
      }
    }

    return results;
  }
}
