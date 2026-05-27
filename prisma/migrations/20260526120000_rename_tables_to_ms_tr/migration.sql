DO $$
BEGIN
  IF to_regclass('public."MsUser"') IS NULL AND to_regclass('public."user"') IS NOT NULL THEN
    ALTER TABLE public."user" RENAME TO "MsUser";
  END IF;

  IF to_regclass('public."TrSession"') IS NULL AND to_regclass('public."session"') IS NOT NULL THEN
    ALTER TABLE public."session" RENAME TO "TrSession";
  END IF;

  IF to_regclass('public."MsAccount"') IS NULL AND to_regclass('public."account"') IS NOT NULL THEN
    ALTER TABLE public."account" RENAME TO "MsAccount";
  END IF;

  IF to_regclass('public."TrVerification"') IS NULL AND to_regclass('public."verification"') IS NOT NULL THEN
    ALTER TABLE public."verification" RENAME TO "TrVerification";
  END IF;

  IF to_regclass('public."MsDinas"') IS NULL AND to_regclass('public."dinas"') IS NOT NULL THEN
    ALTER TABLE public."dinas" RENAME TO "MsDinas";
  END IF;

  IF to_regclass('public."MsCabangDinas"') IS NULL AND to_regclass('public."cabang_dinas"') IS NOT NULL THEN
    ALTER TABLE public."cabang_dinas" RENAME TO "MsCabangDinas";
  END IF;

  IF to_regclass('public."MsKategoriLaporan"') IS NULL AND to_regclass('public."kategori_laporan"') IS NOT NULL THEN
    ALTER TABLE public."kategori_laporan" RENAME TO "MsKategoriLaporan";
  END IF;

  IF to_regclass('public."TrLaporan"') IS NULL AND to_regclass('public."laporan"') IS NOT NULL THEN
    ALTER TABLE public."laporan" RENAME TO "TrLaporan";
  END IF;

  IF to_regclass('public."TrLaporanVote"') IS NULL AND to_regclass('public."laporan_vote"') IS NOT NULL THEN
    ALTER TABLE public."laporan_vote" RENAME TO "TrLaporanVote";
  END IF;

  IF to_regclass('public."TrLaporanRating"') IS NULL AND to_regclass('public."laporan_rating"') IS NOT NULL THEN
    ALTER TABLE public."laporan_rating" RENAME TO "TrLaporanRating";
  END IF;

  IF to_regclass('public."TrLaporanTimeline"') IS NULL AND to_regclass('public."laporan_timeline"') IS NOT NULL THEN
    ALTER TABLE public."laporan_timeline" RENAME TO "TrLaporanTimeline";
  END IF;

  IF to_regclass('public."TrLaporanRoutingDecision"') IS NULL AND to_regclass('public."laporan_routing_decision"') IS NOT NULL THEN
    ALTER TABLE public."laporan_routing_decision" RENAME TO "TrLaporanRoutingDecision";
  END IF;

  IF to_regclass('public."TrNotification"') IS NULL AND to_regclass('public."notification"') IS NOT NULL THEN
    ALTER TABLE public."notification" RENAME TO "TrNotification";
  END IF;

  IF to_regclass('public."MsPetugasDinas"') IS NULL AND to_regclass('public."petugas_dinas"') IS NOT NULL THEN
    ALTER TABLE public."petugas_dinas" RENAME TO "MsPetugasDinas";
  END IF;
END $$;
