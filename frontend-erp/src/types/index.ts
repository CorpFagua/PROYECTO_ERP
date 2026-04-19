// ─── Auth ────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

// ─── Inventario ──────────────────────────────────────────────

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  minStock: number;
  maxStock?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  active: boolean;
}

export type MovementType = "IN" | "OUT" | "ADJUSTMENT";

export interface InventoryMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  reason?: string;
  userId: string;
  createdAt: string;
  product?: Product;
  warehouse?: Warehouse;
  user?: { name: string; email: string };
}

export interface StockLevel {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  product?: Product;
  warehouse?: Warehouse;
}

// ─── Sistema Inmunológico ────────────────────────────────────

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AnomalyLog {
  id: string;
  detectorType: string;
  severity: Severity;
  description: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  createdAt: string;
}

export interface ImmuneStatus {
  totalAnomalies: number;
  pendingAnomalies: number;
  bySeverity: Record<string, number>;
  detectors: { type: string; description: string }[];
}

export interface ScanResult {
  scannedAt: string;
  detectorsRun: string[];
  anomaliesFound: number;
  results: {
    detected: boolean;
    detectorType: string;
    severity: Severity;
    description: string;
    metadata?: Record<string, unknown>;
  }[];
}
