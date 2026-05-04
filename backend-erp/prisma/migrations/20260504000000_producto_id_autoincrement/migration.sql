-- AlterTable: convierte "producto"."id" en columna autoincremental
-- sin perder los registros existentes del dump.

-- 1. Crear secuencia iniciando después del máximo id existente
CREATE SEQUENCE IF NOT EXISTS "producto_id_seq"
    START WITH 43044
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- 2. Asociar la secuencia como default de la columna id
ALTER TABLE "producto" ALTER COLUMN "id" SET DEFAULT nextval('"producto_id_seq"');

-- 3. Hacer que la secuencia sea "owned" por la columna (DROP en cascada)
ALTER SEQUENCE "producto_id_seq" OWNED BY "producto"."id";
