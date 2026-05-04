-- AlterTable: convierte los @id de dump a columnas autocremental
-- sin perder los registros existentes.

-- sucursal (MAX = 31)
CREATE SEQUENCE IF NOT EXISTS "sucursal_id_seq" START WITH 32 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE "sucursal" ALTER COLUMN "id" SET DEFAULT nextval('"sucursal_id_seq"');
ALTER SEQUENCE "sucursal_id_seq" OWNED BY "sucursal"."id";

-- proveedor (MAX = 14)
CREATE SEQUENCE IF NOT EXISTS "proveedor_id_seq" START WITH 15 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE "proveedor" ALTER COLUMN "id" SET DEFAULT nextval('"proveedor_id_seq"');
ALTER SEQUENCE "proveedor_id_seq" OWNED BY "proveedor"."id";

-- compra (MAX = 11539)
CREATE SEQUENCE IF NOT EXISTS "compra_id_seq" START WITH 11540 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE "compra" ALTER COLUMN "id" SET DEFAULT nextval('"compra_id_seq"');
ALTER SEQUENCE "compra_id_seq" OWNED BY "compra"."id";

-- venta (MAX = 48241)
CREATE SEQUENCE IF NOT EXISTS "venta_id_seq" START WITH 48242 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE "venta" ALTER COLUMN "id" SET DEFAULT nextval('"venta_id_seq"');
ALTER SEQUENCE "venta_id_seq" OWNED BY "venta"."id";
