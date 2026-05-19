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
 * Detector de movimientos inusuales (Compras y Ventas).
 *
 * Analogía inmunológica (Células T de Memoria):
 * Analiza el comportamiento histórico de compras y ventas para detectar
 * desviaciones estadísticas significativas usando la regla 3σ: un movimiento
 * es atípico cuando supera media + 3 desviaciones estándar del historial de
 * 30 días, criterio estadístico estándar para la detección de outliers.
 *
 * Señales de peligro detectadas:
 * - Compra/venta con cantidad > media + 3σ (outlier superior, 30 días) → HIGH
 * - Ráfaga: > 5 compras del mismo producto en 24h                      → MEDIUM
 */
export class UnusualMovementDetector implements AnomalyDetector {
  readonly type = "UNUSUAL_MOVEMENT";
  readonly description =
    "Detecta compras y ventas que superan media + 3σ del historial de los últimos 30 días";

  async scan(): Promise<AnomalyDetectorResult[]> {
    const results: AnomalyDetectorResult[] = [];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ─── Analizar compras recientes ───────────────────────────
    const recentCompras = await prisma.compra.findMany({
      where: { fecha: { gte: since } },
      include: { producto: true },
    });

    const comprasByProducto = new Map<number, typeof recentCompras>();
    for (const c of recentCompras) {
      const list = comprasByProducto.get(c.idProducto) ?? [];
      list.push(c);
      comprasByProducto.set(c.idProducto, list);
    }

    for (const [idProducto, compras] of comprasByProducto) {
      const producto = compras[0].producto;

      // Obtener historial de 30 días para calcular media y desviación estándar
      const historial = await prisma.compra.findMany({
        where: { idProducto, fecha: { gte: thirtyDaysAgo } },
        select: { cantidad: true },
      });
      const valores = historial.map((h) => Number(h.cantidad));
      const { mean, stddev } = computeStats(valores);

      // Umbral estadístico superior: media + 3σ
      const threshold = mean + 3 * stddev;

      // Detectar cantidades individuales anómalas (> media + 3σ)
      for (const c of compras) {
        const cantidad = Number(c.cantidad);
        if (mean > 0 && cantidad > threshold) {
          const ratio = cantidad / mean;
          results.push({
            detected: true,
            detectorType: this.type,
            severity: "HIGH" as Severity,
            description: `Compra inusual: ${cantidad} unidades de "${producto.nombre}" (umbral 3σ: ${Math.round(threshold)}, media: ${Math.round(mean)}, σ: ${Math.round(stddev)}, ratio: ${ratio.toFixed(1)}x)`,
            metadata: {
              tipo: "COMPRA",
              compraId: c.id,
              productoId: producto.id,
              nombreProducto: producto.nombre,
              cantidad,
              media30d: parseFloat(mean.toFixed(2)),
              desviacionEstandar: parseFloat(stddev.toFixed(2)),
              umbralEstadistico: parseFloat(threshold.toFixed(2)),
              ratio: parseFloat(ratio.toFixed(2)),
            },
          });
        }
      }

      // Detectar ráfaga: > 5 compras del mismo producto en 24h
      if (compras.length > 5) {
        results.push({
          detected: true,
          detectorType: this.type,
          severity: "MEDIUM" as Severity,
          description: `Ráfaga de compras: ${compras.length} operaciones de "${producto.nombre}" en las últimas 24h`,
          metadata: {
            tipo: "RAFAGA_COMPRA",
            productoId: producto.id,
            nombreProducto: producto.nombre,
            cantidadOperaciones: compras.length,
          },
        });
      }
    }

    // ─── Analizar ventas recientes ────────────────────────────
    const recentVentas = await prisma.venta.findMany({
      where: { fecha: { gte: since }, idProducto: { not: null } },
      include: { producto: true },
    });

    const ventasByProducto = new Map<number, typeof recentVentas>();
    for (const v of recentVentas) {
      if (!v.idProducto) continue;
      const list = ventasByProducto.get(v.idProducto) ?? [];
      list.push(v);
      ventasByProducto.set(v.idProducto, list);
    }

    for (const [idProducto, ventas] of ventasByProducto) {
      const producto = ventas[0].producto;
      if (!producto) continue;

      // Obtener historial de 30 días para calcular media y desviación estándar
      const historial = await prisma.venta.findMany({
        where: { idProducto, fecha: { gte: thirtyDaysAgo } },
        select: { cantidad: true },
      });
      const valores = historial.map((h) => Number(h.cantidad));
      const { mean, stddev } = computeStats(valores);

      // Umbral estadístico superior: media + 3σ
      const threshold = mean + 3 * stddev;

      for (const v of ventas) {
        const cantidad = Number(v.cantidad);
        if (mean > 0 && cantidad > threshold) {
          const ratio = cantidad / mean;
          results.push({
            detected: true,
            detectorType: this.type,
            severity: "HIGH" as Severity,
            description: `Venta inusual: ${cantidad} unidades de "${producto.nombre}" (umbral 3σ: ${Math.round(threshold)}, media: ${Math.round(mean)}, σ: ${Math.round(stddev)}, ratio: ${ratio.toFixed(1)}x)`,
            metadata: {
              tipo: "VENTA",
              ventaId: v.id,
              productoId: producto.id,
              nombreProducto: producto.nombre,
              cantidad,
              media30d: parseFloat(mean.toFixed(2)),
              desviacionEstandar: parseFloat(stddev.toFixed(2)),
              umbralEstadistico: parseFloat(threshold.toFixed(2)),
              ratio: parseFloat(ratio.toFixed(2)),
            },
          });
        }
      }
    }

    return results;
  }
}
