import { Severity } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import type { AnomalyDetector, AnomalyDetectorResult } from "./base-detector.js";

/**
 * Detector de movimientos inusuales.
 *
 * Analogía inmunológica: funciona como células T de memoria que aprenden
 * el comportamiento "normal" del sistema y disparan alertas cuando
 * un movimiento se desvía significativamente del patrón habitual.
 *
 * Señales de peligro detectadas:
 * - Movimiento de cantidad anormalmente alta (> 3x promedio histórico)
 * - Ráfaga de movimientos del mismo producto en un periodo corto
 */
export class UnusualMovementDetector implements AnomalyDetector {
  readonly type = "UNUSUAL_MOVEMENT";
  readonly description =
    "Detecta movimientos de inventario que se desvían del patrón histórico";

  async scan(): Promise<AnomalyDetectorResult[]> {
    const results: AnomalyDetectorResult[] = [];

    // Analizar movimientos de las últimas 24 horas
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentMovements = await prisma.inventoryMovement.findMany({
      where: { createdAt: { gte: since } },
      include: { product: true, warehouse: true, user: { select: { name: true, email: true } } },
    });

    // Agrupar por producto para analizar patrones
    const byProduct = new Map<string, typeof recentMovements>();
    for (const mov of recentMovements) {
      const existing = byProduct.get(mov.productId) || [];
      existing.push(mov);
      byProduct.set(mov.productId, existing);
    }

    for (const [productId, movements] of byProduct) {
      // Calcular promedio histórico de cantidad para este producto (últimos 30 días)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const historicalStats = await prisma.inventoryMovement.aggregate({
        where: { productId, createdAt: { gte: thirtyDaysAgo } },
        _avg: { quantity: true },
        _count: true,
      });

      const avgQuantity = historicalStats._avg.quantity || 0;
      const product = movements[0].product;

      // Detectar cantidades anormalmente altas (> 3x promedio)
      for (const mov of movements) {
        if (avgQuantity > 0 && mov.quantity > avgQuantity * 3) {
          results.push({
            detected: true,
            detectorType: this.type,
            severity: "HIGH" as Severity,
            description: `Movimiento inusual: ${mov.type} de ${mov.quantity} unidades de "${product.name}" (promedio: ${Math.round(avgQuantity)}) por ${mov.user.name}`,
            metadata: {
              movementId: mov.id,
              productId: product.id,
              type: mov.type,
              quantity: mov.quantity,
              averageQuantity: Math.round(avgQuantity),
              ratio: Math.round(mov.quantity / avgQuantity),
              userId: mov.userId,
            },
          });
        }
      }

      // Detectar ráfagas: > 5 movimientos del mismo producto en 24h
      if (movements.length > 5) {
        results.push({
          detected: true,
          detectorType: this.type,
          severity: "MEDIUM" as Severity,
          description: `Ráfaga de movimientos: ${movements.length} operaciones sobre "${product.name}" en las últimas 24h`,
          metadata: {
            productId: product.id,
            movementCount: movements.length,
            types: movements.map((m) => m.type),
          },
        });
      }
    }

    return results;
  }
}
