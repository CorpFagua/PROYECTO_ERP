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

## Enfoque Inmunológico del Inventario

Este proyecto adopta un modelo inspirado en inmunología para la seguridad y resiliencia del módulo de inventarios. El objetivo es combinar controles técnicos y aprendizaje operativo del equipo.

### 1) Self (defensas internas del sistema)
Representa lo que el propio sistema protege desde dentro.

- Validación de entradas en backend con Zod (evita payloads malformados).
- Acceso autenticado con JWT para rutas de inventario y sistema inmune.
- Control de autorización por roles para operaciones sensibles (por ejemplo, escaneo completo).
- Uso de Prisma ORM para reducir riesgo de inyección SQL por consultas manuales.
- Manejo centralizado de errores sin exposición de detalles internos.

### 2) Non-Self (defensas externas y perímetro)
Representa medidas de protección de entorno y configuración.

- Gestión segura de variables de entorno (`DATABASE_URL`, `JWT_SECRET`, etc.).
- Configuración de seguridad HTTP con Helmet y CORS controlado por entorno.
- Separación de ambientes (desarrollo, pruebas, producción).
- Políticas de acceso a base de datos por mínimo privilegio.
- Endurecimiento de infraestructura (firewall, red privada, backups, monitoreo).

### 3) Anticuerpo (respuesta preventiva y correctiva)
Representa mecanismos que neutralizan riesgos actuales y reducen ataques futuros.

- Detectores de anomalías para stock fuera de umbrales y movimientos atípicos.
- Registro histórico de anomalías con severidad para priorización operativa.
- Flujo de atención de anomalías (`acknowledge`) para cerrar eventos y dejar trazabilidad.
- Posibilidad de extender detectores para nuevos patrones de fraude, abuso o error humano.

### 4) Memoria (aprendizaje organizacional)
Representa la capacidad del equipo para aprender de eventos pasados y adaptarse.

- Catálogo de incidentes con causa raíz y acción aplicada.
- Ajuste periódico de reglas de detección según comportamiento real del inventario.
- Capacitación al personal de bodega/operaciones sobre señales de riesgo.
- Retroalimentación continua entre operaciones y desarrollo para mejorar detectores.

### Traducción práctica al módulo de inventarios

En términos operativos, el sistema se comporta así:

1. Registra y protege cada movimiento de inventario con identidad y contexto.
2. Detecta desviaciones frente al patrón esperado (stock y movimientos).
3. Clasifica severidad para priorizar respuesta.
4. Conserva evidencia histórica para que el equipo aprenda y ajuste reglas.
5. Evoluciona detectores y controles según nuevos vectores de ataque o fraude.

## Principios de Seguridad para Evolución del Proyecto

- Todo endpoint nuevo debe definir autenticación y autorización explícitas.
- Toda entrada externa debe validarse antes de llegar a lógica de negocio.
- Toda alerta relevante debe generar trazabilidad auditable.
- Toda mejora de detector debe apoyarse en incidentes o datos observables.
- Toda decisión de seguridad debe documentar riesgo mitigado y costo operativo.

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

### 2. Crear la base de datos en PostgreSQL

Desde la terminal, ejecuta estos comandos uno a uno:

```bash
psql -U postgres -c "CREATE DATABASE erp_db;"
psql -U postgres -c "CREATE USER erp_user WITH PASSWORD 'erp_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE erp_db TO erp_user;"
```

**Permisos adicionales requeridos** (PostgreSQL 15+ restringe el schema `public` y la creación de bases de datos por defecto):

```bash
# Permite que Prisma cree la shadow database durante migraciones
psql -U postgres -c "ALTER USER erp_user CREATEDB;"

# Permite operar sobre el schema public en erp_db (requerido desde PG 15)
psql -U postgres -c "GRANT ALL ON SCHEMA public TO erp_user;" erp_db
```

> Si omites estos dos comandos, `prisma migrate dev` fallará con `P3014` o `permission denied for schema public`.

### 3. Backend

```bash
cd backend-erp
cp .env.example .env          # Editar DATABASE_URL y JWT_SECRET
npm install
```

El archivo `.env` debe contener al menos:

```env
DATABASE_URL="postgresql://erp_user:erp_password@localhost:5432/erp_db"
JWT_SECRET="cambia_esto_por_un_secreto_seguro"
PORT=3001
```

Luego ejecutar la migración, generar el cliente y poblar los datos semilla:

```bash
# Crea todas las tablas y aplica el esquema
npx prisma migrate dev --name rbac-dinamico-inventario

# Pobla la base con datos reales del dump (empleados, productos, ventas, roles)
npx prisma db seed

# Inicia el servidor
npm run dev                   # http://localhost:3001
```

Para regenerar el cliente Prisma sin correr migraciones (ej. tras un pull):

```bash
npx prisma generate
```

Para inspeccionar la base de datos en el navegador:

```bash
npx prisma studio             # http://localhost:5555
```

### Aplicar cambios de esquema (tras modificar `schema.prisma`)

Cuando se modifica el esquema o se hace pull con cambios:

```bash
cd backend-erp

# Genera y aplica la nueva migración
npx prisma migrate dev --name <descripcion-del-cambio>

# Si solo cambiaron tipos/relaciones sin nueva migración, regenera el cliente
npx prisma generate

# Reinicia el servidor de desarrollo
npm run dev
```

> **Reset completo** (borra todos los datos y vuelve a aplicar migraciones desde cero):
> ```bash
> npx prisma migrate reset    # pide confirmación antes de borrar
> npx prisma db seed          # vuelve a poblar con los datos del dump
> ```

### 4. Frontend

```bash
cd frontend-erp
npm install
npm run dev                   # http://localhost:5173
```

### 5. Verificar

```bash
# Login como administrador del sistema
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@erp.com","password":"admin2024"}'

# Login como empleado (contraseña por defecto: erp2024)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"santana.1001056@erp.com","password":"erp2024"}'
```

La respuesta incluye el JWT con el array `permisos[]` listo para usar en el frontend.

## Endpoints principales

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/login` | Login (devuelve JWT) |
| GET | `/api/auth/me` | Perfil del usuario autenticado |

### Inventario
| Método | Ruta | Descripción | Permiso requerido |
|--------|------|-------------|-------------------|
| GET | `/api/inventory/products` | Listar productos | `inventario:ver` |
| GET | `/api/inventory/products/:id` | Detalle de producto con stock | `inventario:ver` |
| GET | `/api/inventory/product-types` | Listar tipos de producto | `inventario:ver` |
| GET | `/api/inventory/sucursales` | Listar sucursales | `inventario:ver` |
| GET | `/api/inventory/sucursales/:id` | Detalle de sucursal | `inventario:ver` |
| GET | `/api/inventory/proveedores` | Listar proveedores | `compras:ver` |
| POST | `/api/inventory/compras` | Registrar compra | `compras:crear` |
| GET | `/api/inventory/compras` | Listar compras | `compras:ver` |
| POST | `/api/inventory/ventas` | Registrar venta (descuenta stock) | `ventas:crear` |
| GET | `/api/inventory/ventas` | Listar ventas | `ventas:ver` |
| GET | `/api/inventory/stock` | Niveles de stock por sucursal | `inventario:ver` |

### Sistema Inmunológico
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/immune/scan` | Ejecutar escaneo completo |
| GET | `/api/immune/anomalies` | Listar anomalías |
| PATCH | `/api/immune/anomalies/:id/acknowledge` | Marcar anomalía como atendida |
| GET | `/api/immune/status` | Estado del sistema |

## Licencia

Proyecto privado — uso interno.
