ALTER TYPE "LaporanStatus" ADD VALUE IF NOT EXISTS 'clarification_requested';

ALTER TABLE "laporan"
ADD COLUMN IF NOT EXISTS "resolutionImages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "laporan_timeline" (
  "id" TEXT NOT NULL,
  "laporanId" TEXT NOT NULL,
  "status" "LaporanStatus" NOT NULL,
  "note" TEXT,
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "actorId" TEXT,
  "actorRole" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "laporan_timeline_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "laporan_timeline_laporanId_createdAt_idx"
ON "laporan_timeline"("laporanId", "createdAt");

ALTER TABLE "laporan_timeline"
ADD CONSTRAINT "laporan_timeline_laporanId_fkey"
FOREIGN KEY ("laporanId") REFERENCES "laporan"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
