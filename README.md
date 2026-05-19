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
Módulo que emula conceptos del sistema inmunológico biológico para detectar y registrar anomalías en las operaciones de inventario. Opera en dos modos:

- **Escaneo completo** (`POST /api/immune/scan`): recorre todo el stock y el historial de movimientos recientes. Solo roles con `anomalias:gestionar`.
- **Escaneos reactivos**: se disparan automáticamente al crear un producto, registrar una compra o registrar una venta, sin bloquear la respuesta principal.

Detectores activos:

| Detector | Qué detecta | Por qué se usa | Analogía biológica | Se activa en | Severidades |
|----------|-------------|----------------|--------------------|--------------|-------------|
| `STOCK_THRESHOLD` | Productos con stock en cero o estadísticamente atípico bajo según la distribución real del sistema (regla 3σ) | Evitar quiebres de stock usando un umbral dinámico que se adapta al comportamiento real del inventario: el umbral es `μ − 3σ` calculado sobre todos los niveles de stock activos, no un número fijo arbitrario | PRR — receptor de patrón innato: reacciona ante condiciones de peligro usando la distribución estadística del propio sistema como referencia | Escaneo completo + cada venta registrada | HIGH (cantidad < μ − 3σ), CRITICAL (= 0) |
| `UNUSUAL_MOVEMENT` | Compras o ventas individuales que superan `μ + 3σ` del historial de 30 días del producto, o ráfagas de más de 5 operaciones del mismo producto en 24 horas | Detectar outliers estadísticos reales: la regla 3σ garantiza que solo el 0.27% de valores normales dispararán la alerta, eliminando los falsos positivos que generaba el multiplicador fijo 3× promedio | Células T de memoria: aprenden la distribución histórica de cada producto y reaccionan cuando una operación sale del rango de normalidad estadística | Escaneo completo (últimas 24 h de actividad) | HIGH (cantidad > μ + 3σ), MEDIUM (ráfaga > 5 ops) |
| `UNUSUAL_PURCHASE` | Cantidades de compra que superan los umbrales estadísticos IQR calculados sobre los últimos 90 días del mismo producto | Prevenir ingresos masivos de stock por error o fraude. Usa IQR dinámico (no un múltiplo fijo) para adaptarse al volumen real de cada producto. Las compras extremas quedan bloqueadas hasta aprobación de un SUPER_ADMIN | Respuesta adaptativa: el sistema aprende el rango normal de cada producto y actúa de forma proporcional a la desviación detectada | Cada alta de compra (`POST /api/inventory/compras`) | HIGH (outlier moderado, compra se registra), CRITICAL (outlier extremo, compra bloqueada) |
| `PURCHASE_PRICE_ANOMALY` | Precio unitario de la compra que supera el umbral IQR del historial de precios del mismo producto en los últimos 90 días | Alertar cuando se paga un precio fuera del rango habitual por un producto. Puede indicar un error de carga (precio en centavos en lugar de pesos) o condiciones de proveedor fuera de mercado | Señal de peligro económica: detecta cuando el "costo" de algo supera lo que el sistema considera saludable, activando una señal de alerta sin bloquear la operación | Cada alta de compra (`POST /api/inventory/compras`) | MEDIUM (umbral moderado), HIGH (umbral extremo) |
| `PRICE_ANOMALY` | Productos recién creados con precio cero, o con un precio que multiplica por más de 10× el promedio de su tipo | Detectar errores de carga en el momento de la creación, antes de que el producto quede activo en el catálogo con un precio incorrecto que afecte ventas o reportes | Control de integridad de datos: verifica que cada nuevo elemento del catálogo sea consistente con el universo de datos existente | Cada alta de producto (`POST /api/inventory/products`) | HIGH (precio = 0 o ratio 10×–50×), CRITICAL (ratio > 50×) |

## Cuándo se genera una anomalía y qué hace el sistema

Esta sección describe, de forma operativa, cada situación que genera una alerta, el momento exacto en que ocurre y qué queda registrado en `anomaly_logs`.

---

### Al crear un producto — `POST /api/inventory/products`

Inmediatamente después de guardar el nuevo producto en la base de datos, el AIS ejecuta `scanNuevoProducto` en segundo plano. Compara el precio del nuevo producto con el promedio de los demás productos del mismo tipo.

**Caso 1 — Precio en cero**
> Condición: el producto se creó con `precio = 0`

```
detectorType : PRICE_ANOMALY
severity     : HIGH
description  : Nuevo producto con precio cero: "NombreProducto" (tipo: TipoProducto)
metadata     : { productoId, nombreProducto, tipoProducto, precio: 0 }
```

Indica un producto cargado incompleto o un error de formulario. No debe estar activo en el catálogo con ese precio.

**Caso 2 — Precio desproporcionadamente alto**
> Condición: `precio > 10 × promedio de productos del mismo tipo`

```
detectorType : PRICE_ANOMALY
severity     : HIGH    (si ratio entre 10x y 50x)
             : CRITICAL (si ratio > 50x)
description  : Precio anómalo en nuevo producto: "X" tiene $Y vs promedio del tipo "Z" de $W (Rx)
metadata     : { productoId, nombreProducto, tipoProducto, precio, promedioPorTipo, ratio }
```

Puede indicar un error de carga (ej. se ingresó precio en centavos en lugar de pesos) o un precio fraudulento.

> Si es el primer producto de un tipo, no hay promedio de referencia y no se genera anomalía.

---

### Al registrar una compra — `POST /api/inventory/compras`

El AIS analiza la compra **sincrónicamente, antes de confirmar el stock**, usando umbrales estadísticos dinámicos calculados con el método IQR (Rango Intercuartílico) sobre el historial real de los últimos 90 días.

---

#### Umbrales dinámicos — Método IQR

En lugar de umbrales fijos (ej. "3× promedio"), el sistema aprende del comportamiento histórico de cada producto:

```
IQR = Q3 − Q1                                  (rango intercuartílico)
Umbral moderado = Q3 + 1.5 × IQR               → outlier leve (HIGH)
Umbral extremo  = Q3 + 3.0 × IQR               → outlier severo (CRITICAL)
```

- Se requieren **al menos 5 compras históricas** en los últimos 90 días para calcular los umbrales.
- Si hay menos de 5 observaciones, el sistema usa un fallback de **5× el promedio disponible**.
- El mismo método se aplica al **precio unitario** (precio / cantidad) de la compra.

**Analogía inmunológica:** Esto es la *memoria estadística* del sistema. El AIS aprende qué es "normal" para cada producto y reacciona cuando algo se sale del rango esperado — sin reglas fijas hardcodeadas.

---

**Caso 1 — Cantidad outlier moderado (alerta sin bloqueo)**
> Condición: `cantidad > Q3 + 1.5 × IQR`

```
detectorType : UNUSUAL_PURCHASE
severity     : HIGH
description  : Compra inusual: N unidades de "X" supera umbral moderado (Q3+1.5×IQR = M) calculado sobre K compras de los últimos 90d
metadata     : { productoId, cantidadSolicitada, q3, iqr, umbralModerado, umbralExtremo, observaciones, ventanaDias }
```

La compra **se registra normalmente** y el stock se incrementa. Se genera una alerta para revisión.

**Caso 2 — Cantidad outlier extremo (compra bloqueada, requiere aprobación)**
> Condición: `cantidad > Q3 + 3.0 × IQR`

```
detectorType : UNUSUAL_PURCHASE
severity     : CRITICAL
description  : Compra bloqueada: N unidades de "X" supera umbral extremo (Q3+3×IQR = M) calculado sobre K compras de los últimos 90d
metadata     : { productoId, cantidadSolicitada, q3, iqr, umbralModerado, umbralExtremo,
                 observaciones, ventanaDias, requiresApproval: true }
```

La compra queda en estado `PENDING_APPROVAL`. **El stock no se incrementa** hasta que un SUPER_ADMIN la apruebe o rechace.

**Caso 3 — Precio unitario anómalo**
> Misma lógica IQR aplicada al precio por unidad vs. historial del producto.

```
detectorType : PURCHASE_PRICE_ANOMALY
severity     : MEDIUM (umbral moderado) / HIGH (umbral extremo)
metadata     : { precioUnitarioIngresado, umbralModerado, umbralExtremo, medianaHistorica, observaciones }
```

---

### Flujo de aprobación para compras bloqueadas

Cuando una compra queda en `PENDING_APPROVAL`, el stock **no se mueve**. Se requiere la intervención de un usuario con permiso `sistema:configurar` (SUPER_ADMIN).

```
                 POST /api/inventory/compras
                          │
                          ▼
              AIS analiza con IQR dinámico
                          │
          ┌───────────────┴───────────────┐
          │ NORMAL / HIGH                 │ CRITICAL
          ▼                               ▼
  Compra status=NORMAL           Compra status=PENDING_APPROVAL
  Stock incrementa               Stock NO incrementa
  Anomalía HIGH → alerta         Anomalía CRITICAL → alerta bloqueante
          │                               │
          │               GET /api/immune/compras-pendientes
          │                               │
          │           ┌──────────────────┤
          │           ▼ APPROVE           ▼ REJECT
          │   status=APPROVED       status=REJECTED
          │   Stock incrementa      Stock sin cambio
          │   AnomalyLog cerrado    AnomalyLog cerrado
          └───────────────────────────────┘
```

**Endpoints de gestión:**

```bash
# Listar compras pendientes de aprobación (solo SUPER_ADMIN)
GET /api/immune/compras-pendientes

# Aprobar o rechazar una compra bloqueada (solo SUPER_ADMIN)
POST /api/immune/compras/:compraId/resolver
Body: { "accion": "APPROVE" | "REJECT" }
```

> Al aprobar: la compra pasa a `APPROVED` y el stock en depósito se incrementa.
> Al rechazar: la compra pasa a `REJECTED`, no hay movimiento de stock y la anomalía queda `acknowledged = true`.

**Campos nuevos en la tabla `compra`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | enum | `NORMAL` / `PENDING_APPROVAL` / `APPROVED` / `REJECTED` |
| `anomalyLogId` | string | ID del log de anomalía vinculado (cuando hay bloqueo) |
| `approvedBy` | string | `userId` del SUPER_ADMIN que resolvió la compra |
| `resolvedAt` | datetime | Timestamp de la resolución |

---



### Al registrar una venta — `POST /api/inventory/ventas`

Después de que la transacción descuenta el stock de la sucursal, el AIS ejecuta `scanNuevaVenta` en segundo plano. Lee el stock **real post-venta** (no el stock antes).

**Caso 1 — Stock agotado tras la venta**
> Condición: `stock en sucursal = 0` después del descuento

```
detectorType : STOCK_THRESHOLD
severity     : CRITICAL
description  : Stock agotado tras venta: "NombreProducto" en sucursal "NombreSucursal"
metadata     : { productoId, sucursalId, nombreProducto, nombreSucursal,
                 cantidadVendida, stockResultante: 0 }
```

**Caso 2 — Stock atípicamente bajo tras la venta**
> Condición: `0 < stock ≤ μ − 3σ` (umbral dinámico calculado sobre la distribución del sistema)

```
detectorType : STOCK_THRESHOLD
severity     : HIGH
description  : Stock atípico bajo: "X" en "Y" — quedan N unidades
               (umbral 3σ: T, media: μ, σ: σ)
metadata     : { productoId, sucursalId, nombreProducto, nombreSucursal,
                 cantidadVendida, stockResultante,
                 umbralEstadistico, media, desviacionEstandar }
```

> El umbral `μ − 3σ` se recalcula en cada escaneo a partir de la distribución real de todos los stocks activos del sistema, por lo que se adapta automáticamente al volumen del inventario.

> Si la venta no tiene `idSucursal` (venta sin sucursal asignada), no se ejecuta el escaneo reactivo porque no hay stock de sucursal que verificar.

---

### Al ejecutar un escaneo completo — `POST /api/immune/scan`

El escaneo completo corre todos los detectores en secuencia. Requiere autenticación y permiso `anomalias:gestionar`.

#### `StockThresholdDetector` — recorre toda la tabla `stock_levels`

Evalúa cada fila de stock de productos activos usando la **regla estadística 3σ** (tres desviaciones estándar):

1. Calcula la **media (μ)** y la **desviación estándar (σ)** de todos los stocks activos del sistema.
2. Determina el umbral dinámico inferior: `umbral = max(0, μ − 3σ)`.
3. Clasifica cada entrada según:

| Condición | `severity` | `detectorType` |
|-----------|-----------|----------------|
| `cantidad = 0` | CRITICAL | STOCK_THRESHOLD |
| `0 < cantidad ≤ μ − 3σ` | HIGH | STOCK_THRESHOLD |

El `metadata` de cada alerta HIGH incluye `umbralEstadistico`, `media` y `desviacionEstandar` para trazabilidad completa.

> Bajo distribución normal, solo el **0.15%** de los stocks caería por debajo de `μ − 3σ`. Un stock que supera ese límite inferior es estadísticamente atípico, no simplemente bajo.

> Importante: el escaneo completo puede generar duplicados si ya existe una anomalía reactiva reciente del mismo producto. El flujo de `acknowledge` es el mecanismo para cerrar esos eventos.

#### `UnusualMovementDetector` — analiza compras y ventas de las últimas 24 horas

Para cada producto con actividad en las últimas 24h, aplica la **regla 3σ** sobre su historial de 30 días:

1. Obtiene todas las cantidades históricas del producto en los últimos 30 días.
2. Calcula **media (μ)** y **desviación estándar (σ)** de esas cantidades.
3. Umbral dinámico superior: `umbral = μ + 3σ`.
4. Una operación es outlier si `cantidad > μ + 3σ`.

| Condición | `severity` | `detectorType` |
|-----------|-----------|----------------|
| Compra/venta individual > μ + 3σ (historial 30d) | HIGH | UNUSUAL_MOVEMENT |
| > 5 compras del mismo producto en 24h | MEDIUM | UNUSUAL_MOVEMENT |

El `metadata` incluye `media30d`, `desviacionEstandar`, `umbralEstadistico` y `ratio` (cantidad / media).

**Por qué `μ + 3σ` es mejor que `3 × media`:**

| Criterio | `3 × media` (anterior) | `μ + 3σ` (actual) |
|----------|------------------------|--------------------|
| Considera dispersión histórica | No | Sí |
| Falsos positivos con productos variables | Alto | Muy bajo (< 0.27%) |
| Se adapta a cada producto | Parcialmente | Completamente |
| Base estadística formal | No | Regla empírica / 3σ |

---

### Qué queda guardado en `anomaly_logs`

Cada anomalía genera un registro con esta estructura:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `cuid` | Identificador único del evento |
| `detectorType` | texto | Tipo de detector que la generó |
| `severity` | enum | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| `description` | texto | Descripción legible del evento |
| `metadata` | JSON | Contexto completo: IDs, valores, promedios, ratios |
| `acknowledged` | boolean | `false` = pendiente / `true` = atendida |
| `createdAt` | timestamp | Fecha y hora exacta del evento |

El campo `metadata` varía según el detector pero siempre incluye los IDs de las entidades involucradas para poder trazar el origen del evento.

---

### Cómo ver y atender las anomalías

```bash
# Ver todas las anomalías pendientes
GET /api/immune/anomalies?acknowledged=false

# Filtrar por severidad
GET /api/immune/anomalies?severity=CRITICAL

# Filtrar por tipo de detector
GET /api/immune/anomalies?detectorType=STOCK_THRESHOLD

# Estado general del sistema inmune (contadores por severidad)
GET /api/immune/status

# Marcar una anomalía como atendida (cerrar el evento)
PATCH /api/immune/anomalies/:id/acknowledge
```

Una vez atendida, la anomalía sale de los contadores pendientes pero permanece en el historial para auditoría.

---



Este proyecto aplica un modelo de cuatro capas inspirado en inmunología. A continuación se documenta exactamente dónde y cómo se implementa cada principio en el código.

---

### 1) Self — Defensas internas del sistema

> El "Self" representa lo que el propio sistema protege desde adentro: validación de datos, identidad, autorización y manejo de errores. Cualquier cosa que ingrese al sistema debe pasar estas barreras antes de afectar la lógica de negocio.

#### Validación de entradas con Zod
**Archivo:** `backend-erp/src/modules/inventory/inventory.controller.ts`

Cada operación de inventario tiene su propio schema Zod que se valida antes de llamar al servicio. Si el payload no cumple, Zod lanza un error estructurado que el `errorHandler` captura y devuelve sin exponer detalles internos.

```ts
// Crear producto — se valida nombre, precio y tipo antes de tocar la BD
const productoCreateSchema = z.object({
  nombre: z.string().min(1).max(255).trim(),  // .trim() previene padding malicioso
  precio: z.number().positive().max(999_999_999_999.999),
  idTipoProducto: z.number().int().positive(),
});

// Registrar compra — todos los campos requeridos con tipos exactos
const compraSchema = z.object({
  fecha: z.string().datetime({ offset: true }).or(z.string().date()),
  idProducto: z.number().int().positive(),
  cantidad: z.number().int().positive(),
  precio: z.number().positive(),
  idProveedor: z.number().int().positive(),
});
```

Lo mismo aplica para `ventaSchema`, `sucursalCreateSchema` y `proveedorCreateSchema`. **Ningún dato externo llega al ORM sin pasar primero por Zod.**

#### Autenticación JWT
**Archivo:** `backend-erp/src/middleware/auth.ts`
**Aplicado en:** `backend-erp/src/modules/immune-system/immune.routes.ts`

Todas las rutas del sistema inmunológico requieren un token válido. El middleware `authenticate` verifica la firma del JWT y adjunta el payload (`userId`, `role`, `permisos[]`) al objeto `req.user`:

```ts
// immune.routes.ts — todas las rutas del AIS están detrás de authenticate
router.use(authenticate);
```

Si el token está ausente, expirado o manipulado, la respuesta es `401` sin exponer información interna.

#### Autorización por permiso explícito
**Archivo:** `backend-erp/src/modules/immune-system/immune.routes.ts`

El escaneo completo es una operación sensible. Solo usuarios con el permiso `anomalias:gestionar` (SUPER_ADMIN, ADMINISTRADOR) pueden ejecutarlo:

```ts
router.post("/scan", authorize("anomalias:gestionar"), immuneController.runScan);
```

Intentar acceder con un rol sin ese permiso devuelve `403`.

#### ORM Prisma — sin SQL manual
**Archivos:** todos los `*.service.ts`

Ninguna consulta usa SQL crudo (`$queryRaw` / `$executeRaw`). Prisma parametriza automáticamente todas las consultas, eliminando el riesgo de inyección SQL. Los filtros, joins e inserciones pasan siempre por el API tipado del cliente Prisma.

#### Manejo centralizado de errores
**Archivo:** `backend-erp/src/middleware/errorHandler.ts`

Todos los errores de la aplicación (incluyendo errores de Prisma y de Zod) pasan por un único middleware. En producción, el mensaje interno no se expone al cliente; solo se devuelve el código HTTP y un mensaje operativo.

#### Escaneos reactivos como barrera interna (Self activo)
**Archivo:** `backend-erp/src/modules/inventory/inventory.service.ts`

Los escaneos reactivos operan como anticuerpos internos que se activan **desde dentro del servicio**, no desde un endpoint externo. Cualquier operación de inventario que persista un dato también dispara una verificación automática del AIS:

```ts
// En createProducto — tras guardar en BD, el AIS analiza el precio
scanNuevoProducto(producto.id).catch(() => undefined);

// En registrarCompra — tras la transacción, el AIS analiza cantidad y precio
scanNuevaCompra({ idProducto, cantidad, precio }).catch(() => undefined);

// En registrarVenta — tras decrementar el stock, el AIS revisa el nivel resultante
scanNuevaVenta({ idProducto, cantidad, idSucursal }).catch(() => undefined);
```

El `.catch(() => undefined)` garantiza que un fallo del AIS nunca interrumpe la operación principal. El sistema de inventario funciona aun si el AIS falla.

---

### 2) Non-Self — Defensas externas y perímetro

> El "Non-Self" representa las medidas de protección del entorno: configuración segura, red, y acceso a infraestructura. Todo lo que rodea al sistema pero no vive en el código de la aplicación.

#### Variables de entorno
**Archivo:** `backend-erp/src/config/env.ts`

Ninguna credencial está hardcodeada. `DATABASE_URL`, `JWT_SECRET` y `PORT` se leen desde `.env` vía `dotenv`. El archivo `.env` está en `.gitignore` y nunca se sube al repositorio.

```ts
export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
} as const;
```

> **Nota:** En producción, `JWT_SECRET` debe tener al menos 32 caracteres aleatorios. El valor `dev-secret-change-me` solo es aceptable en desarrollo local.

#### Seguridad HTTP (Helmet + CORS)
**Archivo:** `backend-erp/src/app.ts`

Helmet establece cabeceras HTTP de seguridad (`X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, etc.). CORS limita los orígenes permitidos según el entorno.

#### Usuario de base de datos con mínimo privilegio
El usuario `erp_user` tiene acceso únicamente a `erp_db`. No puede crear ni eliminar otras bases de datos en producción. Las credenciales de `postgres` (superusuario) no se usan en la aplicación.

#### Separación de ambientes
La variable `NODE_ENV` controla comportamientos distintos entre `development` y `production` (nivel de logging, mensajes de error, CORS, etc.).

---

### 3) Anticuerpo — Respuesta preventiva y correctiva

> Los "anticuerpos" son los detectores de anomalías: mecanismos concretos que identifican patrones de riesgo, los registran con severidad y permiten cerrar el ciclo de respuesta.

#### Detector de umbral de stock — `StockThresholdDetector`
**Archivo:** `backend-erp/src/modules/immune-system/detectors/stock-threshold.detector.ts`
**Analogía:** PRR (Pattern Recognition Receptor) — respuesta innata inmediata, sin aprendizaje previo.

Opera en dos modos:
- **Escaneo completo:** recorre todos los `StockLevel` de productos activos y detecta niveles en 0 o por debajo del umbral mínimo operativo (10 unidades).
- **Reactivo tras venta:** después de cada `registrarVenta`, `scanNuevaVenta` lee el stock post-transacción y genera la anomalía si el resultado es crítico.

```
Stock = 0            → detectorType: STOCK_THRESHOLD   severity: CRITICAL
Stock ≤ 10 unidades  → detectorType: STOCK_THRESHOLD   severity: HIGH
```

El umbral de 10 unidades está en la constante `LOW_STOCK_THRESHOLD` del detector y es ajustable sin modificar la lógica de detección.

#### Detector de movimientos inusuales — `UnusualMovementDetector`
**Archivo:** `backend-erp/src/modules/immune-system/detectors/unusual-movement.detector.ts`
**Analogía:** Células T de memoria — conocen el patrón "normal" y reaccionan ante desviaciones.

Analiza las compras y ventas de las últimas 24 horas comparándolas con el promedio histórico de 30 días del mismo producto:

```
Compra/venta individual ≥ 3x promedio 30d   → UNUSUAL_MOVEMENT   HIGH
                        ≥ 10x promedio 30d  → UNUSUAL_MOVEMENT   CRITICAL (por ratio)
> 5 compras del mismo producto en 24h       → UNUSUAL_MOVEMENT   MEDIUM
```

La ventana de 30 días es configurable. Cuantos más datos históricos existan, más precisa es la detección.

#### Detector reactivo de precio de producto — `scanNuevoProducto`
**Archivo:** `backend-erp/src/modules/immune-system/immune.service.ts`
**Se activa:** automáticamente al crear un producto vía `POST /api/inventory/products`.

Compara el precio del nuevo producto con el promedio de los demás productos del mismo tipo:

```
Precio = 0                → PRICE_ANOMALY   HIGH   (dato incompleto o error de carga)
Precio > 10x promedio tipo → PRICE_ANOMALY   HIGH
Precio > 50x promedio tipo → PRICE_ANOMALY   CRITICAL
```

#### Detector reactivo de compra inusual — `scanNuevaCompra`
**Archivo:** `backend-erp/src/modules/immune-system/immune.service.ts`
**Se activa:** automáticamente al registrar una compra vía `POST /api/inventory/compras`.

Dos verificaciones independientes:

```
Cantidad ≥ 3x promedio 30d           → UNUSUAL_PURCHASE        HIGH
Cantidad ≥ 10x promedio 30d          → UNUSUAL_PURCHASE        CRITICAL
Precio compra > 150% del precio venta → PURCHASE_PRICE_ANOMALY  MEDIUM
```

La verificación de precio de compra vs precio de venta actúa como señal de alerta operativa: si se paga más de 1.5x el precio de venta, puede indicar un error de carga o un proveedor con condiciones fuera de mercado.

#### Flujo de atención de anomalías — `acknowledge`
**Endpoint:** `PATCH /api/immune/anomalies/:id/acknowledge`
**Archivo:** `backend-erp/src/modules/immune-system/immune.service.ts`

Cada anomalía pasa por el ciclo: **detectada → pendiente → atendida**. Al hacer `acknowledge`, el campo `acknowledged = true` cierra el evento y lo saca del contador de anomalías pendientes en `/api/immune/status`. El registro permanece en la tabla `anomaly_logs` con todo su `metadata` para auditoría futura.

#### Escalas de severidad

| Severidad | Significado operativo | Acción sugerida |
|-----------|----------------------|-----------------|
| `CRITICAL` | Stock agotado o precio completamente fuera de rango | Acción inmediata |
| `HIGH` | Stock crítico, compra/venta inusual, precio anómalo | Revisión en el día |
| `MEDIUM` | Sobrestock, ráfaga de movimientos, precio de compra alto | Revisión en la semana |
| `LOW` | Desviación leve (reservado para detectores futuros) | Monitoreo |

---

### 4) Memoria — Aprendizaje organizacional

> La "Memoria" es la capacidad del sistema y del equipo de aprender de los eventos pasados. En el AIS biológico, los linfocitos B de memoria recuerdan patógenos previos para responder más rápido. Aquí, el equivalente es el historial auditable de anomalías y el ajuste periódico de reglas.

#### Tabla `anomaly_logs` — registro histórico persistente
**Archivo:** `backend-erp/prisma/schema.prisma`

Cada anomalía detectada se persiste con:
- `detectorType` — qué detector la encontró
- `severity` — nivel de riesgo
- `description` — descripción legible del evento
- `metadata` (JSON) — contexto completo: IDs, valores numéricos, promedios históricos, ratios
- `acknowledged` — si fue atendida
- `createdAt` — timestamp exacto del evento

Este registro es la base de datos de incidentes del sistema. Permite responder: *¿cuántas veces se agotó el stock del producto X en los últimos 6 meses?* o *¿qué proveedor genera más alertas de precio?*

#### Promedio histórico como memoria operativa
**Archivo:** `backend-erp/src/modules/immune-system/detectors/unusual-movement.detector.ts`

El `UnusualMovementDetector` y `scanNuevaCompra` usan el promedio de los últimos 30 días como línea base de comportamiento normal. Esto es memoria operativa automatizada: el sistema recuerda el patrón habitual del inventario y lo usa como referencia para detectar desviaciones. Cuanto más datos acumule la base, más precisa es esta detección.

```ts
// El sistema "recuerda" el comportamiento de los últimos 30 días
const stats = await prisma.compra.aggregate({
  where: { idProducto, fecha: { gte: thirtyDaysAgo } },
  _avg: { cantidad: true },
});
```

#### Ciclo de aprendizaje sugerido

Para que el principio de Memoria sea efectivo operativamente, el equipo debe seguir este ciclo:

1. **Revisar** anomalías pendientes en `/immune` al inicio de cada jornada.
2. **Atender** (`acknowledge`) las anomalías revisadas, registrando la causa raíz en el `metadata` si aplica.
3. **Analizar** patrones: si un detector genera demasiados falsos positivos, el umbral debe ajustarse (ej. `LOW_STOCK_THRESHOLD` en `stock-threshold.detector.ts`).
4. **Ajustar** detectores o agregar nuevos según incidentes reales observados en el historial.
5. **Documentar** en este README los cambios de reglas y los incidentes que los motivaron.

#### Cómo agregar un nuevo detector

Para extender el AIS con un nuevo tipo de anomalía (ej. detección de fraude por patrón de cliente, o alerta de precio estacional):

```ts
// 1. Crear el archivo del detector
// backend-erp/src/modules/immune-system/detectors/mi-nuevo.detector.ts

import { AnomalyDetector, AnomalyDetectorResult } from "./base-detector.js";

export class MiNuevoDetector implements AnomalyDetector {
  readonly type = "MI_TIPO";
  readonly description = "Descripción del patrón que detecta";

  async scan(): Promise<AnomalyDetectorResult[]> {
    // lógica de detección usando prisma
    return [];
  }
}

// 2. Registrarlo en immune.service.ts
import { MiNuevoDetector } from "./detectors/mi-nuevo.detector.js";

const detectors: AnomalyDetector[] = [
  new StockThresholdDetector(),
  new UnusualMovementDetector(),
  new MiNuevoDetector(),   // ← se incluye automáticamente en runFullScan
];
```

No se requiere modificar ningún otro archivo. El nuevo detector se ejecuta en cada escaneo completo y sus anomalías se registran con el mismo flujo.

---

### Mapa completo: operación → principio AIS → archivo

| Operación de inventario | Principio AIS | Mecanismo | Archivo |
|------------------------|---------------|-----------|---------|
| Cualquier endpoint | **Self** | Autenticación JWT obligatoria | `middleware/auth.ts` |
| `POST /api/inventory/products` | **Self** | Validación Zod de payload | `inventory/inventory.controller.ts` |
| `POST /api/inventory/products` | **Anticuerpo** | `scanNuevoProducto` — alerta de precio anómalo | `immune-system/immune.service.ts` |
| `POST /api/inventory/compras` | **Self** | Validación Zod de payload | `inventory/inventory.controller.ts` |
| `POST /api/inventory/compras` | **Anticuerpo** | `scanNuevaCompra` — alerta de cantidad y precio | `immune-system/immune.service.ts` |
| `POST /api/inventory/ventas` | **Self** | Validación Zod + control de stock insuficiente | `inventory/inventory.controller.ts` |
| `POST /api/inventory/ventas` | **Anticuerpo** | `scanNuevaVenta` — alerta de stock crítico post-venta | `immune-system/immune.service.ts` |
| `POST /api/immune/scan` | **Self** | Requiere permiso `anomalias:gestionar` | `immune-system/immune.routes.ts` |
| `POST /api/immune/scan` | **Anticuerpo** | `StockThresholdDetector` + `UnusualMovementDetector` | `immune-system/detectors/` |
| `PATCH /api/immune/anomalies/:id/acknowledge` | **Anticuerpo** | Cierra el ciclo de respuesta | `immune-system/immune.service.ts` |
| Historial `anomaly_logs` | **Memoria** | Promedio 30d como referencia de normalidad | `immune-system/detectors/unusual-movement.detector.ts` |
| Todas las consultas a BD | **Self** + **Non-Self** | ORM Prisma (sin SQL crudo) | Todos los `*.service.ts` |
| Credenciales y secretos | **Non-Self** | Variables de entorno vía `.env` | `config/env.ts` |



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

## Páginas del frontend

| Ruta | Componente | Descripción | Permiso |
|------|-----------|-------------|---------|
| `/dashboard` | `DashboardPage` | Estadísticas generales: productos, stock total, sucursales con stock, anomalías pendientes | `inventario:ver` |
| `/inventory` | `InventoryPage` | Catálogo de productos con **crear / editar / dar de baja** | `inventario:ver` |
| `/sucursales` | `SucursalesPage` | Listado de sucursales activas con **crear / editar** | `inventario:ver` |
| `/stock` | `StockPage` | Niveles de stock por producto y sucursal; resalta crítico en rojo | `inventario:ver` |
| `/ventas` | `VentasPage` | Historial de ventas con **registrar nueva venta** (descuenta stock) | `ventas:ver` |
| `/compras` | `ComprasPage` | Historial de compras con **registrar nueva compra** (ingresa stock) | `compras:ver` |
| `/proveedores` | `ProveedoresPage` | Listado de proveedores con **crear / editar** | `compras:ver` |
| `/immune` | `ImmunePage` | Log de anomalías detectadas y escaneo manual | `anomalias:ver` |

> Los tipos TypeScript del frontend (`src/types/index.ts`) están sincronizados con los campos reales que devuelven los endpoints: nombres en español (`nombre`, `cantidad`, `idSucursal`, `rol`, `permisos[]`).

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

---

## Usuarios del sistema

### Usuario administrador (creado manualmente)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| `admin@erp.com` | `admin2024` | SUPER_ADMIN |

### Usuarios de empleados (generados desde el dump)

Cada empleado del dump tiene un usuario con la siguiente convención:

| Campo | Valor |
|-------|-------|
| **Email** | `{apellido}.{idEmpleado}@erp.com` (sin tildes ni caracteres especiales) |
| **Contraseña** | `erp2024` |
| **Rol** | Asignado según cargo y salario (ver tabla abajo) |

**Ejemplo:**
```bash
# Empleado con apellido "Santana", ID 1001056
email: santana.1001056@erp.com
password: erp2024
```

### Asignación de roles según cargo

| Cargo (idCargo) | Condición | Rol asignado |
|-----------------|-----------|-------------|
| Administrativo (1) | Salario ≥ 40.000 | GERENTE |
| Administrativo (1) | Salario < 40.000 | ADMINISTRADOR |
| Aux. Administrativo (2) | — | OPERADOR |
| Aux. Técnico (3) / Técnico (4) | — | TECNICO |
| Vendedor (5) | — | VENDEDOR |
| Cualquier otro | — | OPERADOR |

---

## Roles y permisos

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **SUPER_ADMIN** | Acceso total al sistema | Todos |
| **ADMINISTRADOR** | Administrador de operaciones | Todos excepto `sistema:configurar` |
| **GERENTE** | Gerente de sucursal | Ver inventario/compras/ventas/reportes, aprobar compras, anular ventas, ver anomalías |
| **TECNICO** | Técnico de inventario | Ver/crear/editar inventario, ver compras/proveedores, ver anomalías |
| **VENDEDOR** | Vendedor en sucursal | Ver inventario, ver/crear ventas, ver sucursales |
| **OPERADOR** | Operador administrativo | Ver inventario/compras/ventas/proveedores/sucursales/reportes |
| **AUDITOR** | Solo lectura | Ver todos los módulos sin poder crear ni modificar |

### Catálogo de permisos disponibles

| Código | Módulo | Acción |
|--------|--------|--------|
| `inventario:ver` | Inventario | Ver productos, stock, sucursales |
| `inventario:crear` | Inventario | Crear productos y movimientos |
| `inventario:editar` | Inventario | Editar productos |
| `inventario:eliminar` | Inventario | Eliminar productos |
| `compras:ver` | Compras | Listar compras y proveedores |
| `compras:crear` | Compras | Registrar nuevas compras |
| `compras:aprobar` | Compras | Aprobar órdenes de compra |
| `ventas:ver` | Ventas | Listar ventas |
| `ventas:crear` | Ventas | Registrar ventas (descuenta stock) |
| `ventas:anular` | Ventas | Anular ventas |
| `proveedores:ver` | Proveedores | Listar proveedores |
| `proveedores:gestionar` | Proveedores | Crear/editar proveedores |
| `sucursales:ver` | Sucursales | Listar sucursales |
| `sucursales:gestionar` | Sucursales | Crear/editar sucursales |
| `usuarios:ver` | Usuarios | Listar usuarios |
| `usuarios:gestionar` | Usuarios | Crear/editar usuarios y roles |
| `reportes:ver` | Reportes | Ver reportes |
| `reportes:exportar` | Reportes | Exportar reportes |
| `anomalias:ver` | Anomalías | Ver log de anomalías |
| `anomalias:gestionar` | Anomalías | Gestionar y atender anomalías |
| `sistema:configurar` | Sistema | Configuración global (solo SUPER_ADMIN) |

