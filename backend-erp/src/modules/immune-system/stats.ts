import { prisma } from "../../lib/prisma.js";

/**
 * Estadísticas dinámicas calculadas desde los datos reales de compras.
 *
 * Usa el método IQR (Rango Intercuartílico) para definir umbrales de anomalía
 * de forma adaptativa, sin valores hardcodeados.
 *
 * IQR = Q3 - Q1
 * Límite superior = Q3 + 1.5 × IQR   → outlier moderado (HIGH)
 * Límite superior = Q3 + 3.0 × IQR   → outlier extremo (CRITICAL)
 *
 * Analogía inmunológica: esto es la "memoria estadística" del sistema.
 * El sistema inmune aprende qué es "normal" observando el comportamiento
 * histórico y reacciona cuando algo se sale del rango esperado.
 */
export interface PurchaseStats {
  n: number;           // cantidad de observaciones usadas
  median: number;      // mediana de cantidades históricas
  q1: number;          // percentil 25
  q3: number;          // percentil 75
  iqr: number;         // rango intercuartílico
  upperModerate: number; // Q3 + 1.5×IQR  → umbral HIGH
  upperExtreme: number;  // Q3 + 3.0×IQR  → umbral CRITICAL
  windowDays: number;  // ventana de tiempo usada para el cálculo
}

/**
 * Calcula estadísticas IQR para las compras históricas de un producto.
 * Usa una ventana de 90 días. Si hay menos de 5 observaciones, devuelve null
 * (sin historial suficiente para calcular umbrales confiables).
 */
export async function calcularEstadisticasCompra(
  idProducto: number,
): Promise<PurchaseStats | null> {
  const WINDOW_DAYS = 90;
  const MIN_OBSERVATIONS = 5;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const compras = await prisma.compra.findMany({
    where: { idProducto, fecha: { gte: since } },
    select: { cantidad: true },
    orderBy: { cantidad: "asc" },
  });

  if (compras.length < MIN_OBSERVATIONS) return null;

  const values = compras.map((c: { cantidad: number }) => c.cantidad).sort((a: number, b: number) => a - b);
  const n = values.length;

  const median = percentile(values, 50);
  const q1 = percentile(values, 25);
  const q3 = percentile(values, 75);
  const iqr = q3 - q1;

  return {
    n,
    median,
    q1,
    q3,
    iqr,
    upperModerate: q3 + 1.5 * iqr,
    upperExtreme: q3 + 3.0 * iqr,
    windowDays: WINDOW_DAYS,
  };
}

/**
 * Calcula el percentil p (0-100) de un array de números ya ordenado ascendentemente.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/**
 * Estadísticas para precio de compra vs histórico de precios del mismo producto.
 * Mismo método IQR aplicado al precio unitario (precio / cantidad).
 */
export interface PriceStats {
  n: number;
  medianPrecioUnit: number;
  upperModerate: number; // Q3 + 1.5×IQR → MEDIUM
  upperExtreme: number;  // Q3 + 3.0×IQR → HIGH
  windowDays: number;
}

export async function calcularEstadisticasPrecioCompra(
  idProducto: number,
): Promise<PriceStats | null> {
  const WINDOW_DAYS = 90;
  const MIN_OBSERVATIONS = 5;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const compras = await prisma.compra.findMany({
    where: { idProducto, fecha: { gte: since }, cantidad: { gt: 0 } },
    select: { cantidad: true, precio: true },
  });

  if (compras.length < MIN_OBSERVATIONS) return null;

  const preciosUnit = compras
    .map((c: { cantidad: number; precio: unknown }) => Number(c.precio) / c.cantidad)
    .sort((a: number, b: number) => a - b);

  const q1 = percentile(preciosUnit, 25);
  const q3 = percentile(preciosUnit, 75);
  const iqr = q3 - q1;

  return {
    n: preciosUnit.length,
    medianPrecioUnit: percentile(preciosUnit, 50),
    upperModerate: q3 + 1.5 * iqr,
    upperExtreme: q3 + 3.0 * iqr,
    windowDays: WINDOW_DAYS,
  };
}
