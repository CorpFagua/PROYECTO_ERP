import { Severity } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import type { AnomalyDetector, AnomalyDetectorResult } from "./base-detector.js";

/**
 * Detector de umbral de stock.
 *
 * Analogía inmunológica: actúa como un receptor de patrón de reconocimiento (PRR)
 * que detecta "patógenos" conocidos — en este caso, niveles de stock fuera
 * de los umbrales definidos (minStock / maxStock).
 *
 * Señales de peligro detectadas:
 * - Stock por debajo del mínimo → severidad HIGH
 * - Stock en cero → severidad CRITICAL
 * - Stock por encima del máximo → severidad MEDIUM
 */
export class StockThresholdDetector implements AnomalyDetector {
  readonly type = "STOCK_THRESHOLD";
  readonly description = "Detecta productos con stock fuera de umbrales definidos (min/max)";

  async scan(): Promise<AnomalyDetectorResult[]> {
    const results: AnomalyDetectorResult[] = [];

    // Obtener todos los niveles de stock con info del producto
    const stockLevels = await prisma.stockLevel.findMany({
      include: {
        product: true,
        warehouse: true,
      },
    });

    for (const level of stockLevels) {
      const { product, warehouse, quantity } = level;

      // Stock en cero — CRITICAL
      if (quantity <= 0) {
        results.push({
          detected: true,
          detectorType: this.type,
          severity: "CRITICAL" as Severity,
          description: `Stock agotado: "${product.name}" (SKU: ${product.sku}) en bodega "${warehouse.name}"`,
          metadata: {
            productId: product.id,
            warehouseId: warehouse.id,
            sku: product.sku,
            currentStock: quantity,
            minStock: product.minStock,
          },
        });
        continue;
      }

      // Stock bajo mínimo — HIGH
      if (quantity < product.minStock) {
        results.push({
          detected: true,
          detectorType: this.type,
          severity: "HIGH" as Severity,
          description: `Stock bajo mínimo: "${product.name}" (SKU: ${product.sku}) tiene ${quantity} unidades (mín: ${product.minStock}) en bodega "${warehouse.name}"`,
          metadata: {
            productId: product.id,
            warehouseId: warehouse.id,
            sku: product.sku,
            currentStock: quantity,
            minStock: product.minStock,
            deficit: product.minStock - quantity,
          },
        });
        continue;
      }

      // Stock sobre máximo — MEDIUM
      if (product.maxStock && quantity > product.maxStock) {
        results.push({
          detected: true,
          detectorType: this.type,
          severity: "MEDIUM" as Severity,
          description: `Sobrestock: "${product.name}" (SKU: ${product.sku}) tiene ${quantity} unidades (máx: ${product.maxStock}) en bodega "${warehouse.name}"`,
          metadata: {
            productId: product.id,
            warehouseId: warehouse.id,
            sku: product.sku,
            currentStock: quantity,
            maxStock: product.maxStock,
            excess: quantity - product.maxStock,
          },
        });
      }
    }

    return results;
  }
}
