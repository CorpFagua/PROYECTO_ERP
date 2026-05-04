-- CreateEnum
CREATE TYPE "CompraStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NORMAL');

-- AlterTable: agrega columnas de flujo de aprobación a compra
ALTER TABLE "compra"
  ADD COLUMN "status"          "CompraStatus" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "anomaly_log_id"  TEXT,
  ADD COLUMN "approved_by"     TEXT,
  ADD COLUMN "resolved_at"     TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "compra_status_idx" ON "compra"("status");
