import { prisma } from "../../lib/prisma.js";
import { Prisma } from "@prisma/client";
import type { AnomalyDetector, AnomalyDetectorResult } from "./detectors/base-detector.js";
import { StockThresholdDetector } from "./detectors/stock-threshold.detector.js";
import { UnusualMovementDetector } from "./detectors/unusual-movement.detector.js";
import {
  calcularEstadisticasCompra,
  calcularEstadisticasPrecioCompra,
} from "./stats.js";

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

// Umbral de stock bajo compartido entre escaneos full y reactivos
const LOW_STOCK_THRESHOLD = 10;

// Registro de detectores activos (escaneo completo)
const detectors: AnomalyDetector[] = [
  new StockThresholdDetector(),
  new UnusualMovementDetector(),
];

// ─── Helpers internos ─────────────────────────────────────────

/** Persiste un lote de resultados de anomalía en la base de datos. */
async function persistirAnomalias(resultados: AnomalyDetectorResult[]) {
  const detectados = resultados.filter((r) => r.detected);
  if (detectados.length === 0) return;
  await prisma.anomalyLog.createMany({
    data: detectados.map((r) => ({
      detectorType: r.detectorType,
      severity: r.severity,
      description: r.description,
      metadata:
        r.metadata !== undefined
          ? (r.metadata as unknown as Prisma.InputJsonValue)
          : undefined,
    })),
  });
}

// ─── Escaneo completo ─────────────────────────────────────────

/**
 * Ejecuta todos los detectores registrados y persiste las anomalías encontradas.
 */
export async function runFullScan() {
  const allResults: AnomalyDetectorResult[] = [];

  for (const detector of detectors) {
    const results = await detector.scan();
    allResults.push(...results);
  }

  await persistirAnomalias(allResults);

  return {
    scannedAt: new Date().toISOString(),
    detectorsRun: detectors.map((d) => d.type),
    anomaliesFound: allResults.filter((r) => r.detected).length,
    results: allResults,
  };
}

// ─── Escaneos reactivos (Self — defensas internas) ────────────
//
// Se disparan automáticamente desde el servicio de inventario al crear
// un producto, registrar una compra o registrar una venta. Son
// fire-and-forget: no bloquean la respuesta principal.
//
// Analogía: el sistema inmune innato que reacciona de inmediato
// ante una señal de peligro sin esperar el escaneo programado.

/**
 * Revisa si el precio del nuevo producto es anómalo frente al promedio
 * de su tipo. Detecta precio cero (dato incompleto) o precio
 * desproporcionadamente alto (posible error de carga o fraude).
 */
export async function scanNuevoProducto(productoId: number): Promise<void> {
  try {
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      include: { tipoProducto: true },
    });
    if (!producto) return;

    const precio = Number(producto.precio);
    const anomalias: AnomalyDetectorResult[] = [];

    if (precio === 0) {
      anomalias.push({
        detected: true,
        detectorType: "PRICE_ANOMALY",
        severity: "HIGH",
        description: `Nuevo producto con precio cero: "${producto.nombre}" (tipo: ${producto.tipoProducto.nombre})`,
        metadata: {
          productoId,
          nombreProducto: producto.nombre,
          tipoProducto: producto.tipoProducto.nombre,
          precio,
        },
      });
    } else {
      const stats = await prisma.producto.aggregate({
        where: { idTipoProducto: producto.idTipoProducto, activo: true, id: { not: productoId } },
        _avg: { precio: true },
        _count: true,
      });
      const avgPrecio = Number(stats._avg.precio ?? 0);
      if (avgPrecio > 0) {
        const ratio = precio / avgPrecio;
        if (ratio > 10) {
          anomalias.push({
            detected: true,
            detectorType: "PRICE_ANOMALY",
            severity: ratio > 50 ? "CRITICAL" : "HIGH",
            description: `Precio anómalo en nuevo producto: "${producto.nombre}" tiene $${precio.toLocaleString()} vs promedio del tipo "${producto.tipoProducto.nombre}" de $${Math.round(avgPrecio).toLocaleString()} (${ratio.toFixed(1)}x)`,
            metadata: {
              productoId,
              nombreProducto: producto.nombre,
              tipoProducto: producto.tipoProducto.nombre,
              precio,
              promedioPorTipo: Math.round(avgPrecio),
              ratio: parseFloat(ratio.toFixed(2)),
            },
          });
        }
      }
    }

    await persistirAnomalias(anomalias);
  } catch {
    /* Nunca bloquear la respuesta principal */
  }
}

/**
 * Analiza si la nueva compra es anómala usando estadísticas IQR calculadas
 * dinámicamente desde el historial real de los últimos 90 días.
 *
 * Devuelve el ID del AnomalyLog creado si la compra requiere aprobación
 * (outlier extremo CRITICAL), o null si es normal o solo genera alerta.
 *
 * Analogía: Respuesta adaptativa + Memoria estadística.
 * El sistema no usa umbrales fijos — aprende del comportamiento real.
 */
export async function scanNuevaCompra(input: {
  idProducto: number;
  cantidad: number;
  precio: number;
}): Promise<{ requiresApproval: boolean; anomalyLogId: string | null }> {
  const resultado = { requiresApproval: false, anomalyLogId: null as string | null };
  try {
    const producto = await prisma.producto.findUnique({ where: { id: input.idProducto } });
    if (!producto) return resultado;

    const anomalias: AnomalyDetectorResult[] = [];

    // ── Análisis de cantidad por IQR dinámico ───────────────
    const statsQty = await calcularEstadisticasCompra(input.idProducto);

    if (statsQty) {
      const { upperModerate, upperExtreme, q3, iqr, n, windowDays } = statsQty;

      if (input.cantidad > upperExtreme) {
        // Outlier extremo: CRITICAL → requiere aprobación explícita
        resultado.requiresApproval = true;
        anomalias.push({
          detected: true,
          detectorType: "UNUSUAL_PURCHASE",
          severity: "CRITICAL",
          description: `Compra bloqueada: ${input.cantidad} unidades de "${producto.nombre}" supera el umbral extremo (Q3+3×IQR = ${upperExtreme.toFixed(1)}) calculado sobre ${n} compras de los últimos ${windowDays}d`,
          metadata: {
            productoId: input.idProducto,
            nombreProducto: producto.nombre,
            cantidadSolicitada: input.cantidad,
            q3: parseFloat(q3.toFixed(2)),
            iqr: parseFloat(iqr.toFixed(2)),
            umbralModerado: parseFloat(upperModerate.toFixed(2)),
            umbralExtremo: parseFloat(upperExtreme.toFixed(2)),
            observaciones: n,
            ventanaDias: windowDays,
            requiresApproval: true,
          },
        });
      } else if (input.cantidad > upperModerate) {
        // Outlier moderado: HIGH → alerta pero no bloquea
        anomalias.push({
          detected: true,
          detectorType: "UNUSUAL_PURCHASE",
          severity: "HIGH",
          description: `Compra inusual: ${input.cantidad} unidades de "${producto.nombre}" supera el umbral moderado (Q3+1.5×IQR = ${upperModerate.toFixed(1)}) calculado sobre ${n} compras de los últimos ${windowDays}d`,
          metadata: {
            productoId: input.idProducto,
            nombreProducto: producto.nombre,
            cantidadSolicitada: input.cantidad,
            q3: parseFloat(q3.toFixed(2)),
            iqr: parseFloat(iqr.toFixed(2)),
            umbralModerado: parseFloat(upperModerate.toFixed(2)),
            umbralExtremo: parseFloat(upperExtreme.toFixed(2)),
            observaciones: n,
            ventanaDias: windowDays,
            requiresApproval: false,
          },
        });
      }
    } else {
      // Sin historial suficiente: usar fallback de 5x promedio con ventana de 90d
      // (fallback solo para primeras compras de un producto)
      const statsBasic = await prisma.compra.aggregate({
        where: {
          idProducto: input.idProducto,
          fecha: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        _avg: { cantidad: true },
        _count: true,
      });
      const avgFallback = Number(statsBasic._avg.cantidad ?? 0);
      if (avgFallback > 0 && input.cantidad > avgFallback * 5) {
        resultado.requiresApproval = true;
        anomalias.push({
          detected: true,
          detectorType: "UNUSUAL_PURCHASE",
          severity: "CRITICAL",
          description: `Compra bloqueada: ${input.cantidad} unidades de "${producto.nombre}" supera 5x el promedio (${Math.round(avgFallback)}) — historial insuficiente para IQR`,
          metadata: {
            productoId: input.idProducto,
            nombreProducto: producto.nombre,
            cantidadSolicitada: input.cantidad,
            promedioFallback: Math.round(avgFallback),
            observaciones: statsBasic._count,
            metodo: "fallback_5x_avg",
            requiresApproval: true,
          },
        });
      }
    }

    // ── Análisis de precio por IQR dinámico ─────────────────
    const statsPrice = await calcularEstadisticasPrecioCompra(input.idProducto);
    const precioUnitario = input.precio / input.cantidad;

    if (statsPrice) {
      const { upperModerate, upperExtreme, medianPrecioUnit, n, windowDays } = statsPrice;

      if (precioUnitario > upperExtreme) {
        anomalias.push({
          detected: true,
          detectorType: "PURCHASE_PRICE_ANOMALY",
          severity: "HIGH",
          description: `Precio unitario de compra ($${precioUnitario.toFixed(2)}) supera umbral extremo ($${upperExtreme.toFixed(2)}) de "${producto.nombre}" — mediana histórica $${medianPrecioUnit.toFixed(2)}`,
          metadata: {
            productoId: input.idProducto,
            nombreProducto: producto.nombre,
            precioUnitarioIngresado: parseFloat(precioUnitario.toFixed(2)),
            umbralExtremo: parseFloat(upperExtreme.toFixed(2)),
            medianaHistorica: parseFloat(medianPrecioUnit.toFixed(2)),
            observaciones: n,
            ventanaDias: windowDays,
          },
        });
      } else if (precioUnitario > upperModerate) {
        anomalias.push({
          detected: true,
          detectorType: "PURCHASE_PRICE_ANOMALY",
          severity: "MEDIUM",
          description: `Precio unitario de compra ($${precioUnitario.toFixed(2)}) supera umbral moderado ($${upperModerate.toFixed(2)}) de "${producto.nombre}" — mediana histórica $${medianPrecioUnit.toFixed(2)}`,
          metadata: {
            productoId: input.idProducto,
            nombreProducto: producto.nombre,
            precioUnitarioIngresado: parseFloat(precioUnitario.toFixed(2)),
            umbralModerado: parseFloat(upperModerate.toFixed(2)),
            medianaHistorica: parseFloat(medianPrecioUnit.toFixed(2)),
            observaciones: n,
            ventanaDias: windowDays,
          },
        });
      }
    } else {
      // Sin historial de precios: comparar con precio de venta como referencia
      const precioVenta = Number(producto.precio);
      if (precioVenta > 0 && input.precio > precioVenta * 1.5) {
        anomalias.push({
          detected: true,
          detectorType: "PURCHASE_PRICE_ANOMALY",
          severity: "MEDIUM",
          description: `Precio de compra ($${input.precio.toLocaleString()}) supera 150% del precio de venta ($${precioVenta.toLocaleString()}) de "${producto.nombre}" — sin historial para IQR`,
          metadata: {
            productoId: input.idProducto,
            nombreProducto: producto.nombre,
            precioCompra: input.precio,
            precioVenta,
            ratio: parseFloat((input.precio / precioVenta).toFixed(2)),
            metodo: "fallback_vs_precio_venta",
          },
        });
      }
    }

    if (anomalias.length > 0) {
      const detectadas = anomalias.filter((r) => r.detected);
      if (detectadas.length > 0) {
        const registros = await prisma.anomalyLog.createManyAndReturn({
          data: detectadas.map((r) => ({
            detectorType: r.detectorType,
            severity: r.severity,
            description: r.description,
            metadata:
              r.metadata !== undefined
                ? (r.metadata as unknown as Prisma.InputJsonValue)
                : undefined,
          })),
        });
        // La anomalía CRITICAL es la que bloquea y se vincula a la compra
        const critical = registros.find((r) => r.severity === "CRITICAL");
        if (critical) resultado.anomalyLogId = critical.id;
      }
    }
  } catch {
    /* Nunca bloquear la respuesta principal por fallo del AIS */
  }
  return resultado;
}

/**
 * Revisa si el stock resultante tras la venta queda en nivel crítico
 * o agotado en la sucursal. Se ejecuta después de que la transacción
 * ya actualizó el stock_level, por lo que lee el valor real post-venta.
 */
export async function scanNuevaVenta(input: {
  idProducto: number;
  cantidad: number;
  idSucursal?: number;
}): Promise<void> {
  try {
    if (!input.idSucursal) return;

    const [producto, stockLevel] = await Promise.all([
      prisma.producto.findUnique({ where: { id: input.idProducto } }),
      prisma.stockLevel.findUnique({
        where: {
          idProducto_idSucursal: { idProducto: input.idProducto, idSucursal: input.idSucursal },
        },
        include: { sucursal: true },
      }),
    ]);

    if (!producto || !stockLevel) return;

    const anomalias: AnomalyDetectorResult[] = [];
    const cantidadPost = stockLevel.cantidad; // valor ya decrementado por la transacción

    // ── STOCK_THRESHOLD ──────────────────────────────────────
    if (cantidadPost === 0) {
      anomalias.push({
        detected: true,
        detectorType: "STOCK_THRESHOLD",
        severity: "CRITICAL",
        description: `Stock agotado tras venta: "${producto.nombre}" en sucursal "${stockLevel.sucursal.nombre}"`,
        metadata: {
          productoId: input.idProducto,
          sucursalId: input.idSucursal,
          nombreProducto: producto.nombre,
          nombreSucursal: stockLevel.sucursal.nombre,
          cantidadVendida: input.cantidad,
          stockResultante: cantidadPost,
        },
      });
    } else if (cantidadPost <= LOW_STOCK_THRESHOLD) {
      anomalias.push({
        detected: true,
        detectorType: "STOCK_THRESHOLD",
        severity: "HIGH",
        description: `Stock crítico tras venta: "${producto.nombre}" en "${stockLevel.sucursal.nombre}" — quedan ${cantidadPost} unidades`,
        metadata: {
          productoId: input.idProducto,
          sucursalId: input.idSucursal,
          nombreProducto: producto.nombre,
          nombreSucursal: stockLevel.sucursal.nombre,
          cantidadVendida: input.cantidad,
          stockResultante: cantidadPost,
          umbralMinimo: LOW_STOCK_THRESHOLD,
        },
      });
    }

    // ── UNUSUAL_MOVEMENT ─────────────────────────────────────
    // Compara la cantidad vendida contra el promedio de los últimos 30 días
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stats = await prisma.venta.aggregate({
      where: { idProducto: input.idProducto, fecha: { gte: thirtyDaysAgo } },
      _avg: { cantidad: true },
      _count: true,
    });
    const avgCantidad = Number(stats._avg.cantidad ?? 0);
    // Solo aplica si hay historial suficiente (>= 3 ventas previas) y la actual supera 3x el promedio
    if (stats._count >= 3 && avgCantidad > 0 && input.cantidad > avgCantidad * 3) {
      const ratio = input.cantidad / avgCantidad;
      anomalias.push({
        detected: true,
        detectorType: "UNUSUAL_MOVEMENT",
        severity: "HIGH",
        description: `Venta inusual: ${input.cantidad} unidades de "${producto.nombre}" (promedio 30d: ${Math.round(avgCantidad)}, ${ratio.toFixed(1)}x superior)`,
        metadata: {
          tipo: "VENTA",
          productoId: input.idProducto,
          nombreProducto: producto.nombre,
          cantidad: input.cantidad,
          promedio30d: Math.round(avgCantidad),
          ratio: parseFloat(ratio.toFixed(2)),
        },
      });
    }

    await persistirAnomalias(anomalias);
  } catch {
    /* Nunca bloquear la respuesta principal */
  }
}

// ─── Consultas ────────────────────────────────────────────────

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
 * Marca una anomalía como reconocida/atendida (flujo de "acknowledge").
 * Deja trazabilidad del evento para la fase de Memoria del AIS.
 */
export async function acknowledgeAnomaly(id: string) {
  return prisma.anomalyLog.update({
    where: { id },
    data: { acknowledged: true },
  });
}

/**
 * Aprueba o rechaza una compra que quedó en estado PENDING_APPROVAL.
 * Solo puede ser ejecutado por un usuario con permiso sistema:configurar (SUPER_ADMIN).
 *
 * Al aprobar: la compra se marca APPROVED, se actualiza el stock en depósito
 * y se cierra la anomalía asociada.
 *
 * Al rechazar: la compra se marca REJECTED y la anomalía queda acknowledged
 * con trazabilidad del responsable.
 */
export async function resolverCompra(
  compraId: number,
  accion: "APPROVE" | "REJECT",
  approvedByUserId: string,
) {
  const compra = await prisma.compra.findUnique({ where: { id: compraId } });
  if (!compra) throw new Error("Compra no encontrada");
  if (compra.status !== "PENDING_APPROVAL") {
    throw new Error(`La compra no está pendiente de aprobación (estado actual: ${compra.status})`);
  }

  const DEPOSITO_ID = 9;
  const now = new Date();

  if (accion === "APPROVE") {
    await prisma.$transaction(async (tx) => {
      // Actualizar estado de la compra
      await tx.compra.update({
        where: { id: compraId },
        data: { status: "APPROVED", approvedBy: approvedByUserId, resolvedAt: now },
      });

      // Ingresar el stock al depósito (no se hizo al crear la compra bloqueada)
      await tx.stockLevel.upsert({
        where: {
          idProducto_idSucursal: { idProducto: compra.idProducto, idSucursal: DEPOSITO_ID },
        },
        update: { cantidad: { increment: compra.cantidad } },
        create: { idProducto: compra.idProducto, idSucursal: DEPOSITO_ID, cantidad: compra.cantidad },
      });

      // Cerrar la anomalía asociada
      if (compra.anomalyLogId) {
        await tx.anomalyLog.update({
          where: { id: compra.anomalyLogId },
          data: { acknowledged: true },
        });
      }
    });
  } else {
    // Rechazar: solo actualizar estado y cerrar anomalía
    await prisma.$transaction(async (tx) => {
      await tx.compra.update({
        where: { id: compraId },
        data: { status: "REJECTED", approvedBy: approvedByUserId, resolvedAt: now },
      });

      if (compra.anomalyLogId) {
        await tx.anomalyLog.update({
          where: { id: compra.anomalyLogId },
          data: { acknowledged: true },
        });
      }
    });
  }

  return prisma.compra.findUnique({
    where: { id: compraId },
    include: { producto: true, proveedor: true },
  });
}

/**
 * Lista las compras pendientes de aprobación.
 */
export async function listComprasPendientes() {
  return prisma.compra.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: {
      producto: { include: { tipoProducto: true } },
      proveedor: true,
    },
    orderBy: { fecha: "desc" },
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
