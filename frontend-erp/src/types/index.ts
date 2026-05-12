// ─── Auth ────────────────────────────────────────────────────

export interface Empleado {
  id: number;
  nombre: string | null;
  apellido: string | null;
  idSucursal?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  /** Nombre del rol dinámico: SUPER_ADMIN, GERENTE, VENDEDOR, etc. */
  rol: string;
  permisos: string[];
  empleado?: Empleado | null;
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

// ─── Geografía ───────────────────────────────────────────────

export interface Localidad {
  id: number;
  nombre: string;
  idProvincia: number;
}

// ─── Inventario ──────────────────────────────────────────────

export interface TipoProducto {
  id: number;
  nombre: string;
}

export interface Product {
  id: number;
  nombre: string;
  precio: number;
  idTipoProducto: number;
  activo: boolean;
  tipoProducto: TipoProducto;
}

export interface Sucursal {
  id: number;
  nombre: string;
  domicilio: string | null;
  idLocalidad: number;
  latitud: number;
  longitud: number;
  activa: boolean;
  localidad: Localidad;
}

export interface Proveedor {
  id: number;
  nombre: string | null;
  domicilio: string | null;
  idLocalidad: number;
  localidad: Localidad;
}

export interface StockLevel {
  id: number;
  idProducto: number;
  idSucursal: number;
  cantidad: number;
  updatedAt: string;
  producto: Product;
  sucursal: Sucursal;
}

export interface Compra {
  id: number;
  fecha: string;
  idProducto: number;
  cantidad: number;
  precio: number;
  idProveedor: number;
  producto: Product;
  proveedor: Proveedor;
}

export interface Venta {
  id: number;
  fecha: string;
  fechaEntrega: string;
  idCanal: number | null;
  idCliente: number | null;
  idSucursal: number | null;
  idEmpleado: number | null;
  idProducto: number | null;
  precio: number;
  cantidad: number;
  producto: Product | null;
  sucursal: Sucursal | null;
  canal: { id: number; canal: string | null } | null;
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

// ─── Usuarios / Roles / Permisos ─────────────────────────────

export interface RolSimple {
  id: number;
  nombre: string;
}

export interface UsuarioListItem {
  id: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
  rol: RolSimple;
  empleado: { id: number; nombre: string | null; apellido: string | null } | null;
}

export interface Permiso {
  id: number;
  codigo: string;
  modulo: string;
  accion: string;
  descripcion: string | null;
}

export interface RolConPermisos {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  permisos: { permiso: Permiso }[];
}

