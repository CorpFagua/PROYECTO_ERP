import { Severity } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import type { AnomalyDetector, AnomalyDetectorResult } from "./base-detector.js";

/**
 * Detector de movimientos inusuales (Compras y Ventas).
 *
 * Analogía inmunológica (Células T de Memoria):
 * Analiza el comportamiento histórico de compras y ventas para detectar
 * desviaciones estadísticas significativas. Las "células de memoria" conocen
 * el patrón normal del sistema y disparan alertas cuando algo se desvía.
 *
 * Señales de peligro detectadas:
 * - Compra/venta con cantidad > 3x promedio histórico de 30 días → HIGH
 * - Ráfaga: > 5 compras del mismo producto en 24h               → MEDIUM
 */
export class UnusualMovementDetector implements AnomalyDetector {
  readonly type = "UNUSUAL_MOVEMENT";
  readonly description =
    "Detecta compras y ventas que se desvían del patrón histórico de los últimos 30 días";

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

      const stats = await prisma.compra.aggregate({
        where: { idProducto, fecha: { gte: thirtyDaysAgo } },
        _avg: { cantidad: true },
        _count: true,
      });
      const avgCantidad = Number(stats._avg.cantidad ?? 0);

      // Detectar cantidades individuales anómalas (> 3x promedio)
      for (const c of compras) {
        const cantidad = Number(c.cantidad);
        if (avgCantidad > 0 && cantidad > avgCantidad * 3) {
          const ratio = cantidad / avgCantidad;
          results.push({
            detected: true,
            detectorType: this.type,
            severity: "HIGH" as Severity,
            description: `Compra inusual: ${cantidad} unidades de "${producto.nombre}" (promedio 30d: ${Math.round(avgCantidad)}, ${ratio.toFixed(1)}x superior)`,
            metadata: {
              tipo: "COMPRA",
              compraId: c.id,
              productoId: producto.id,
              nombreProducto: producto.nombre,
              cantidad,
              promedio30d: Math.round(avgCantidad),
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

      const stats = await prisma.venta.aggregate({
        where: { idProducto, fecha: { gte: thirtyDaysAgo } },
        _avg: { cantidad: true },
        _count: true,
      });
      const avgCantidad = Number(stats._avg.cantidad ?? 0);

      for (const v of ventas) {
        const cantidad = Number(v.cantidad);
        if (avgCantidad > 0 && cantidad > avgCantidad * 3) {
          const ratio = cantidad / avgCantidad;
          results.push({
            detected: true,
            detectorType: this.type,
            severity: "HIGH" as Severity,
            description: `Venta inusual: ${cantidad} unidades de "${producto.nombre}" (promedio 30d: ${Math.round(avgCantidad)}, ${ratio.toFixed(1)}x superior)`,
            metadata: {
              tipo: "VENTA",
              ventaId: v.id,
              productoId: producto.id,
              nombreProducto: producto.nombre,
              cantidad,
              promedio30d: Math.round(avgCantidad),
              ratio: parseFloat(ratio.toFixed(2)),
            },
          });
        }
      }
    }

    return results;
  }
}
