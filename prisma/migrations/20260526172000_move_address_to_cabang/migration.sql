ALTER TABLE "MsDinas"
DROP COLUMN IF EXISTS "address";

UPDATE "MsCabangDinas"
SET
  "address" = CASE "name"
    WHEN 'Dinas Bina Marga Provinsi DKI Jakarta' THEN 'Jl. Taman Jati Baru No. 1, Tanah Abang, Jakarta Pusat'
    WHEN 'Dinas Perhubungan Provinsi DKI Jakarta' THEN 'Jl. Taman Jatibaru No. 1, Jakarta Pusat'
    WHEN 'Dinas Sumber Daya Air Provinsi DKI Jakarta' THEN 'Jl. Taman Jati Baru No. 1, Tanah Abang, Jakarta Pusat'
    WHEN 'Dinas Lingkungan Hidup Provinsi DKI Jakarta' THEN 'Jl. Mandala V No. 67, Cililitan Besar, Jakarta Timur'
    WHEN 'Dinas Cipta Karya Provinsi DKI Jakarta' THEN 'Jl. Abdul Muis No. 66 Lt. 4, Jakarta Pusat'
    WHEN 'Suku Dinas Bina Marga Jakarta Pusat' THEN 'Jl. Tanah Abang I No. 1, Jakarta Pusat'
    WHEN 'Suku Dinas Perhubungan Jakarta Pusat' THEN 'Jl. Stasiun Senen No. 5, Jakarta Pusat'
    WHEN 'Suku Dinas Sumber Daya Air Jakarta Pusat' THEN 'Kantor Walikota Jakarta Pusat, Jl. Tanah Abang I No. 1, Jakarta Pusat'
    WHEN 'Suku Dinas Lingkungan Hidup Jakarta Pusat' THEN 'Komp. Perkantoran Rawa Kerbau Rawasari, Jakarta Pusat 10573'
    WHEN 'Suku Dinas Cipta Karya Jakarta Pusat' THEN 'Jl. Tanah Abang I Blok C, Jakarta Pusat'
    WHEN 'Suku Dinas Bina Marga Jakarta Selatan' THEN 'Jl. Prapanca, Jakarta Selatan'
    WHEN 'Suku Dinas Perhubungan Jakarta Selatan' THEN 'Gedung BPKMP Lt. LV, Jl. Mayjen MT Haryono Kav. 45-46, Jakarta Selatan'
    WHEN 'Suku Dinas Sumber Daya Air Jakarta Selatan' THEN 'Jl. Prapanca, Jakarta Selatan'
    WHEN 'Suku Dinas Lingkungan Hidup Jakarta Selatan' THEN 'Jl. Buncit Raya No. 41, Mampang Prapatan, Jakarta Selatan'
    WHEN 'Suku Dinas Cipta Karya Jakarta Selatan' THEN 'Jl. Prapanca Raya No. 9 Lantai 9, Kebayoran Baru, Jakarta Selatan'
    WHEN 'Suku Dinas Bina Marga Jakarta Barat' THEN 'Jl. Kembangan Raya, Jakarta Barat'
    WHEN 'Suku Dinas Perhubungan Jakarta Barat' THEN 'Komp. Terminal Bus Rawa Buaya, Jl. Lingkar Luar, Jakarta Barat'
    WHEN 'Suku Dinas Sumber Daya Air Jakarta Barat' THEN 'Jl. Kembangan Raya, Jakarta Barat'
    WHEN 'Suku Dinas Lingkungan Hidup Jakarta Barat' THEN 'Jl. Perdana No. 2, Kel. Wijaya Kusuma, Jakarta Barat 11460'
    WHEN 'Suku Dinas Cipta Karya Jakarta Barat' THEN 'Jl. Raya Kembangan No. 2, Jakarta Barat'
    WHEN 'Suku Dinas Bina Marga Jakarta Timur' THEN 'Jl. Sentra Primer Pulo Gebang, Jakarta Timur'
    WHEN 'Suku Dinas Perhubungan Jakarta Timur' THEN 'Jl. Perserikatan Rawamangun, Jakarta Timur'
    WHEN 'Suku Dinas Sumber Daya Air Jakarta Timur' THEN 'Jl. Sentra Primer Pulo Gebang, Jakarta Timur'
    WHEN 'Suku Dinas Lingkungan Hidup Jakarta Timur' THEN 'Jl. SMA 48 Pinang Ranti, Jakarta Timur'
    WHEN 'Suku Dinas Cipta Karya Jakarta Timur' THEN 'Jl. DR. Sumarno, Jakarta Timur'
    WHEN 'Suku Dinas Bina Marga Jakarta Utara' THEN 'Jl. Yos Sudarso No. 27-29, Jakarta Utara'
    WHEN 'Suku Dinas Perhubungan Jakarta Utara' THEN 'Jl. Yos Sudarso No. 12, Tanjung Priok, Jakarta Utara'
    WHEN 'Suku Dinas Sumber Daya Air Jakarta Utara' THEN 'Jl. Yos Sudarso No. 27-29, Jakarta Utara'
    WHEN 'Suku Dinas Lingkungan Hidup Jakarta Utara' THEN 'Jl. Alur Laut No. 2, Plumpang, Jakarta Utara'
    WHEN 'Suku Dinas Cipta Karya Jakarta Utara' THEN 'Jl. Laksda Yos Sudarso No. 27-29, Tanjung Priok, Jakarta Utara'
    ELSE "address"
  END,
  "phone" = CASE "name"
    WHEN 'Dinas Bina Marga Provinsi DKI Jakarta' THEN '021 3848672'
    WHEN 'Dinas Perhubungan Provinsi DKI Jakarta' THEN '021 3501349'
    WHEN 'Dinas Sumber Daya Air Provinsi DKI Jakarta' THEN '021 3846608, 021 3849626, 021 3803302'
    WHEN 'Dinas Lingkungan Hidup Provinsi DKI Jakarta' THEN '021 8092744'
    WHEN 'Dinas Cipta Karya Provinsi DKI Jakarta' THEN '021 3510266, 021 3865919, 021 3865917'
    WHEN 'Suku Dinas Bina Marga Jakarta Pusat' THEN '021 3440290'
    WHEN 'Suku Dinas Perhubungan Jakarta Pusat' THEN '021 42887286'
    WHEN 'Suku Dinas Sumber Daya Air Jakarta Pusat' THEN '021 3522420'
    WHEN 'Suku Dinas Lingkungan Hidup Jakarta Pusat' THEN '021 4208743'
    WHEN 'Suku Dinas Cipta Karya Jakarta Pusat' THEN '021 3459938'
    WHEN 'Suku Dinas Bina Marga Jakarta Selatan' THEN '021 7251311'
    WHEN 'Suku Dinas Perhubungan Jakarta Selatan' THEN NULL
    WHEN 'Suku Dinas Sumber Daya Air Jakarta Selatan' THEN '021 7205682'
    WHEN 'Suku Dinas Lingkungan Hidup Jakarta Selatan' THEN '021 7949309'
    WHEN 'Suku Dinas Cipta Karya Jakarta Selatan' THEN '021 7220911'
    WHEN 'Suku Dinas Bina Marga Jakarta Barat' THEN '021 58357691'
    WHEN 'Suku Dinas Perhubungan Jakarta Barat' THEN '021 5459548'
    WHEN 'Suku Dinas Sumber Daya Air Jakarta Barat' THEN '021 5682422'
    WHEN 'Suku Dinas Lingkungan Hidup Jakarta Barat' THEN '021 5663524'
    WHEN 'Suku Dinas Cipta Karya Jakarta Barat' THEN '021 5821759'
    WHEN 'Suku Dinas Bina Marga Jakarta Timur' THEN '021 48703465'
    WHEN 'Suku Dinas Perhubungan Jakarta Timur' THEN '021 4893764'
    WHEN 'Suku Dinas Sumber Daya Air Jakarta Timur' THEN '021 48703464'
    WHEN 'Suku Dinas Lingkungan Hidup Jakarta Timur' THEN '021 80886971'
    WHEN 'Suku Dinas Cipta Karya Jakarta Timur' THEN '021 4802043'
    WHEN 'Suku Dinas Bina Marga Jakarta Utara' THEN '021 43902028'
    WHEN 'Suku Dinas Perhubungan Jakarta Utara' THEN '021 43900664'
    WHEN 'Suku Dinas Sumber Daya Air Jakarta Utara' THEN '021 43907023'
    WHEN 'Suku Dinas Lingkungan Hidup Jakarta Utara' THEN '021 43934663'
    WHEN 'Suku Dinas Cipta Karya Jakarta Utara' THEN '021 43933580, 021 4304427'
    ELSE "phone"
  END
WHERE "name" IN (
  'Dinas Bina Marga Provinsi DKI Jakarta',
  'Dinas Perhubungan Provinsi DKI Jakarta',
  'Dinas Sumber Daya Air Provinsi DKI Jakarta',
  'Dinas Lingkungan Hidup Provinsi DKI Jakarta',
  'Dinas Cipta Karya Provinsi DKI Jakarta',
  'Suku Dinas Bina Marga Jakarta Pusat',
  'Suku Dinas Perhubungan Jakarta Pusat',
  'Suku Dinas Sumber Daya Air Jakarta Pusat',
  'Suku Dinas Lingkungan Hidup Jakarta Pusat',
  'Suku Dinas Cipta Karya Jakarta Pusat',
  'Suku Dinas Bina Marga Jakarta Selatan',
  'Suku Dinas Perhubungan Jakarta Selatan',
  'Suku Dinas Sumber Daya Air Jakarta Selatan',
  'Suku Dinas Lingkungan Hidup Jakarta Selatan',
  'Suku Dinas Cipta Karya Jakarta Selatan',
  'Suku Dinas Bina Marga Jakarta Barat',
  'Suku Dinas Perhubungan Jakarta Barat',
  'Suku Dinas Sumber Daya Air Jakarta Barat',
  'Suku Dinas Lingkungan Hidup Jakarta Barat',
  'Suku Dinas Cipta Karya Jakarta Barat',
  'Suku Dinas Bina Marga Jakarta Timur',
  'Suku Dinas Perhubungan Jakarta Timur',
  'Suku Dinas Sumber Daya Air Jakarta Timur',
  'Suku Dinas Lingkungan Hidup Jakarta Timur',
  'Suku Dinas Cipta Karya Jakarta Timur',
  'Suku Dinas Bina Marga Jakarta Utara',
  'Suku Dinas Perhubungan Jakarta Utara',
  'Suku Dinas Sumber Daya Air Jakarta Utara',
  'Suku Dinas Lingkungan Hidup Jakarta Utara',
  'Suku Dinas Cipta Karya Jakarta Utara'
);
