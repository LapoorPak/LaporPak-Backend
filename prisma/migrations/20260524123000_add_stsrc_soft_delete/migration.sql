-- Add soft-delete status without deleting existing data.
CREATE TYPE "Stsrc" AS ENUM ('A', 'U', 'D');

ALTER TABLE "dinas"
ADD COLUMN "stsrc" "Stsrc" NOT NULL DEFAULT 'A';

ALTER TABLE "cabang_dinas"
ADD COLUMN "stsrc" "Stsrc" NOT NULL DEFAULT 'A';

ALTER TABLE "kategori_laporan"
ADD COLUMN "stsrc" "Stsrc" NOT NULL DEFAULT 'A';

ALTER TABLE "laporan"
ADD COLUMN "stsrc" "Stsrc" NOT NULL DEFAULT 'A';

CREATE INDEX "dinas_stsrc_idx" ON "dinas"("stsrc");
CREATE INDEX "cabang_dinas_stsrc_idx" ON "cabang_dinas"("stsrc");
CREATE INDEX "kategori_laporan_stsrc_idx" ON "kategori_laporan"("stsrc");
CREATE INDEX "laporan_stsrc_idx" ON "laporan"("stsrc");
