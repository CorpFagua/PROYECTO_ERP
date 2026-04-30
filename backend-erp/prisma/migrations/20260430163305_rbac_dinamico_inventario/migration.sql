-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "rol_id" INTEGER NOT NULL,
    "permiso_id" INTEGER NOT NULL,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rol_id" INTEGER NOT NULL,
    "empleado_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provincia" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "provincia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localidad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "id_provincia" INTEGER NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "longitud" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "localidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sector" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleado" (
    "id" INTEGER NOT NULL,
    "codigo_empleado" INTEGER NOT NULL,
    "apellido" TEXT,
    "nombre" TEXT,
    "id_sucursal" INTEGER NOT NULL,
    "id_sector" INTEGER NOT NULL,
    "id_cargo" INTEGER NOT NULL,
    "salario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_producto" (
    "id" SERIAL NOT NULL,
    "tipo_producto" TEXT NOT NULL,

    CONSTRAINT "tipo_producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" INTEGER NOT NULL,
    "producto" TEXT NOT NULL,
    "precio" DECIMAL(15,3) NOT NULL,
    "id_tipo_producto" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sucursal" (
    "id" INTEGER NOT NULL,
    "sucursal" TEXT NOT NULL,
    "domicilio" TEXT,
    "id_localidad" INTEGER NOT NULL,
    "latitud" DECIMAL(13,10) NOT NULL DEFAULT 0,
    "longitud" DECIMAL(13,10) NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT,
    "domicilio" TEXT,
    "id_localidad" INTEGER NOT NULL,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canal_venta" (
    "id" INTEGER NOT NULL,
    "canal" TEXT,

    CONSTRAINT "canal_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra" (
    "id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "id_proveedor" INTEGER NOT NULL,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" INTEGER NOT NULL,
    "nombre_y_apellido" TEXT,
    "domicilio" TEXT,
    "telefono" TEXT,
    "edad" TEXT,
    "rango_etario" TEXT NOT NULL DEFAULT '-',
    "id_localidad" INTEGER NOT NULL DEFAULT 0,
    "latitud" DECIMAL(13,10) NOT NULL DEFAULT 0,
    "longitud" DECIMAL(13,10) NOT NULL DEFAULT 0,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta" (
    "id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "fecha_entrega" DATE NOT NULL,
    "id_canal" INTEGER,
    "id_cliente" INTEGER,
    "id_sucursal" INTEGER,
    "id_empleado" INTEGER,
    "id_producto" INTEGER,
    "precio" DECIMAL(15,3) NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "id_sucursal" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_logs" (
    "id" TEXT NOT NULL,
    "detector_type" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE INDEX "permisos_modulo_idx" ON "permisos"("modulo");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_empleado_id_key" ON "users"("empleado_id");

-- CreateIndex
CREATE INDEX "localidad_id_provincia_idx" ON "localidad"("id_provincia");

-- CreateIndex
CREATE INDEX "empleado_id_sucursal_idx" ON "empleado"("id_sucursal");

-- CreateIndex
CREATE INDEX "empleado_id_cargo_idx" ON "empleado"("id_cargo");

-- CreateIndex
CREATE INDEX "producto_id_tipo_producto_idx" ON "producto"("id_tipo_producto");

-- CreateIndex
CREATE INDEX "sucursal_id_localidad_idx" ON "sucursal"("id_localidad");

-- CreateIndex
CREATE INDEX "proveedor_id_localidad_idx" ON "proveedor"("id_localidad");

-- CreateIndex
CREATE INDEX "compra_id_producto_idx" ON "compra"("id_producto");

-- CreateIndex
CREATE INDEX "compra_id_proveedor_idx" ON "compra"("id_proveedor");

-- CreateIndex
CREATE INDEX "compra_fecha_idx" ON "compra"("fecha");

-- CreateIndex
CREATE INDEX "cliente_id_localidad_idx" ON "cliente"("id_localidad");

-- CreateIndex
CREATE INDEX "venta_id_producto_idx" ON "venta"("id_producto");

-- CreateIndex
CREATE INDEX "venta_id_sucursal_idx" ON "venta"("id_sucursal");

-- CreateIndex
CREATE INDEX "venta_id_empleado_idx" ON "venta"("id_empleado");

-- CreateIndex
CREATE INDEX "venta_fecha_idx" ON "venta"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_id_producto_id_sucursal_key" ON "stock_levels"("id_producto", "id_sucursal");

-- CreateIndex
CREATE INDEX "anomaly_logs_severity_idx" ON "anomaly_logs"("severity");

-- CreateIndex
CREATE INDEX "anomaly_logs_acknowledged_idx" ON "anomaly_logs"("acknowledged");

-- CreateIndex
CREATE INDEX "anomaly_logs_created_at_idx" ON "anomaly_logs"("created_at");

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localidad" ADD CONSTRAINT "localidad_id_provincia_fkey" FOREIGN KEY ("id_provincia") REFERENCES "provincia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_id_sucursal_fkey" FOREIGN KEY ("id_sucursal") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_id_sector_fkey" FOREIGN KEY ("id_sector") REFERENCES "sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_id_cargo_fkey" FOREIGN KEY ("id_cargo") REFERENCES "cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_id_tipo_producto_fkey" FOREIGN KEY ("id_tipo_producto") REFERENCES "tipo_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sucursal" ADD CONSTRAINT "sucursal_id_localidad_fkey" FOREIGN KEY ("id_localidad") REFERENCES "localidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor" ADD CONSTRAINT "proveedor_id_localidad_fkey" FOREIGN KEY ("id_localidad") REFERENCES "localidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_id_localidad_fkey" FOREIGN KEY ("id_localidad") REFERENCES "localidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_canal_fkey" FOREIGN KEY ("id_canal") REFERENCES "canal_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_sucursal_fkey" FOREIGN KEY ("id_sucursal") REFERENCES "sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_empleado_fkey" FOREIGN KEY ("id_empleado") REFERENCES "empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_id_sucursal_fkey" FOREIGN KEY ("id_sucursal") REFERENCES "sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
