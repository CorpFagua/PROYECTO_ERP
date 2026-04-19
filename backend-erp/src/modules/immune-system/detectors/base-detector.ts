import { Severity } from "@prisma/client";

/**
 * Interfaz base para detectores del Sistema Inmunológico Artificial (AIS).
 *
 * Cada detector actúa como un "anticuerpo" especializado en reconocer
 * un tipo específico de anomalía en los patrones de inventario.
 *
 * Inspirado en:
 * - Selección negativa: detectar lo que NO es normal
 * - Teoría del peligro: reaccionar ante señales de peligro, no solo ante lo desconocido
 */
export interface AnomalyDetectorResult {
  detected: boolean;
  detectorType: string;
  severity: Severity;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface AnomalyDetector {
  /** Identificador único del detector */
  readonly type: string;

  /** Descripción legible del propósito del detector */
  readonly description: string;

  /**
   * Ejecuta el análisis y devuelve las anomalías encontradas.
   * Cada detector puede analizar distintos aspectos del inventario.
   */
  scan(): Promise<AnomalyDetectorResult[]>;
}
