CREATE TABLE IF NOT EXISTS "laporan_vote" (
  "id" TEXT NOT NULL,
  "laporanId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "laporan_vote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "laporan_rating" (
  "id" TEXT NOT NULL,
  "laporanId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dinasId" TEXT,
  "cabangDinasId" TEXT,
  "score" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "laporan_rating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "laporan_vote_laporanId_userId_key"
ON "laporan_vote"("laporanId", "userId");

CREATE INDEX IF NOT EXISTS "laporan_vote_userId_idx"
ON "laporan_vote"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "laporan_rating_laporanId_key"
ON "laporan_rating"("laporanId");

CREATE INDEX IF NOT EXISTS "laporan_rating_userId_idx"
ON "laporan_rating"("userId");

CREATE INDEX IF NOT EXISTS "laporan_rating_dinasId_idx"
ON "laporan_rating"("dinasId");

CREATE INDEX IF NOT EXISTS "laporan_rating_cabangDinasId_idx"
ON "laporan_rating"("cabangDinasId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'laporan_vote_laporanId_fkey'
  ) THEN
    ALTER TABLE "laporan_vote"
    ADD CONSTRAINT "laporan_vote_laporanId_fkey"
    FOREIGN KEY ("laporanId") REFERENCES "laporan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'laporan_vote_userId_fkey'
  ) THEN
    ALTER TABLE "laporan_vote"
    ADD CONSTRAINT "laporan_vote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'laporan_rating_laporanId_fkey'
  ) THEN
    ALTER TABLE "laporan_rating"
    ADD CONSTRAINT "laporan_rating_laporanId_fkey"
    FOREIGN KEY ("laporanId") REFERENCES "laporan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'laporan_rating_userId_fkey'
  ) THEN
    ALTER TABLE "laporan_rating"
    ADD CONSTRAINT "laporan_rating_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'laporan_rating_dinasId_fkey'
  ) THEN
    ALTER TABLE "laporan_rating"
    ADD CONSTRAINT "laporan_rating_dinasId_fkey"
    FOREIGN KEY ("dinasId") REFERENCES "dinas"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'laporan_rating_cabangDinasId_fkey'
  ) THEN
    ALTER TABLE "laporan_rating"
    ADD CONSTRAINT "laporan_rating_cabangDinasId_fkey"
    FOREIGN KEY ("cabangDinasId") REFERENCES "cabang_dinas"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
