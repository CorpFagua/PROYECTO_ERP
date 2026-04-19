# PROYECTO ERP — Sistema de Gestión con Detección de Anomalías

Sistema ERP modular con enfoque inicial en **gestión de inventarios** e integración experimental de un **Sistema Inmunológico Artificial (AIS)** para detección y respuesta a patrones anómalos en los datos de inventario.

## Arquitectura

```
PROYECTO_ERP/
├── backend-erp/          # API REST — Node + Express + TypeScript + Prisma
├── frontend-erp/         # SPA — React + Vite + TypeScript + Tailwind CSS
└── README.md
```

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| **Backend** | Node.js, Express, TypeScript |
| **ORM / Migraciones** | Prisma |
| **Base de datos** | PostgreSQL |
| **Frontend** | React 19, Vite, TypeScript |
| **Estilos** | Tailwind CSS v4 |
| **State** | Zustand + React Query |
| **Autenticación** | JWT (jsonwebtoken + bcryptjs) |

## Módulos

### Inventario
- CRUD de productos con SKU, categoría, unidades
- Gestión de bodegas (warehouses)
- Registro de movimientos (entrada, salida, ajuste)
- Niveles de stock en tiempo real por bodega

### Sistema Inmunológico Artificial (AIS)
Módulo experimental que emula conceptos del sistema inmunológico biológico para detectar anomalías en patrones de inventario:

- **Detectores de umbral (PRR)**: identifican stock fuera de rangos definidos (mín/máx)
- **Detectores de movimientos inusuales (Células T)**: analizan desviaciones del comportamiento histórico
- **Registro de anomalías**: cada detección se persiste con severidad (LOW → CRITICAL)
- **Arquitectura extensible**: nuevos detectores implementan la interfaz `AnomalyDetector`

## Inicio rápido

### Requisitos previos
- Node.js >= 18
- PostgreSQL >= 14
- npm >= 9

### 1. Clonar y configurar

```bash
git clone <repo-url>
cd PROYECTO_ERP
```

### 2. Backend

```bash
cd backend-erp
cp .env.example .env          # Editar con datos de tu PostgreSQL
npm install
npx prisma migrate dev        # Crea las tablas en la base de datos
npx prisma generate           # Genera el cliente Prisma
npm run dev                   # Inicia en http://localhost:3001
```

### 3. Frontend

```bash
cd frontend-erp
npm install
npm run dev                   # Inicia en http://localhost:5173
```

### 4. Verificar

1. Abre `http://localhost:5173`
2. Regístrate con email y contraseña
3. Navega a Inventario y crea un producto
4. Navega a Sistema Inmune y ejecuta un escaneo

## Endpoints principales

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/login` | Login (devuelve JWT) |
| GET | `/api/auth/me` | Perfil del usuario autenticado |

### Inventario
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/inventory/products` | Listar productos |
| POST | `/api/inventory/products` | Crear producto |
| PATCH | `/api/inventory/products/:id` | Actualizar producto |
| GET | `/api/inventory/warehouses` | Listar bodegas |
| POST | `/api/inventory/warehouses` | Crear bodega |
| POST | `/api/inventory/movements` | Registrar movimiento |
| GET | `/api/inventory/movements` | Listar movimientos |
| GET | `/api/inventory/stock` | Consultar niveles de stock |

### Sistema Inmunológico
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/immune/scan` | Ejecutar escaneo completo |
| GET | `/api/immune/anomalies` | Listar anomalías |
| PATCH | `/api/immune/anomalies/:id/acknowledge` | Marcar anomalía como atendida |
| GET | `/api/immune/status` | Estado del sistema |

## Licencia

Proyecto privado — uso interno.
