import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { REPORT_CATEGORIES } from "../src/data/reportCategories.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

interface DinasSeedDefinition {
  code: string;
  name: string;
  short: string;
  description: string;
}

interface CabangSeedDefinition {
  name: string;
  type: string;
  lat: number;
  lng: number;
}

const DINAS_DEFINITIONS: DinasSeedDefinition[] = [
  {
    code: "bina_marga",
    name: "Dinas Bina Marga",
    short: "Bina Marga",
    description: "Menangani jalan, jembatan, dan trotoar.",
  },
  {
    code: "sda",
    name: "Dinas Sumber Daya Air",
    short: "SDA",
    description: "Menangani saluran air, drainase, dan infrastruktur pengendalian air.",
  },
  {
    code: "lingkungan_hidup",
    name: "Dinas Lingkungan Hidup",
    short: "Lingkungan Hidup",
    description: "Menangani sampah, kebersihan, dan pencemaran lingkungan.",
  },
  {
    code: "perhubungan",
    name: "Dinas Perhubungan",
    short: "Perhubungan",
    description: "Menangani lampu jalan, rambu, dan operasional lalu lintas.",
  },
  {
    code: "cipta_karya",
    name: "Dinas Cipta Karya",
    short: "Cipta Karya",
    description: "Menangani bangunan publik dan infrastruktur perkotaan.",
  },
  {
    code: "pupr",
    name: "Dinas PUPR",
    short: "PUPR",
    description: "Menangani infrastruktur umum dan pekerjaan umum lintas fungsi.",
  },
  {
    code: "perumahan",
    name: "Dinas Perumahan",
    short: "Perumahan",
    description: "Menangani isu perumahan dan kawasan permukiman.",
  },
  {
    code: "satpol_pp",
    name: "Satpol PP",
    short: "Satpol PP",
    description: "Menangani ketertiban umum dan penegakan perda.",
  },
  {
    code: "bpbd",
    name: "BPBD",
    short: "BPBD",
    description: "Menangani kesiapsiagaan dan respon kebencanaan.",
  },
  {
    code: "ptsp",
    name: "Dinas PTSP",
    short: "PTSP",
    description: "Menangani layanan perizinan dan administrasi terpadu.",
  },
  {
    code: "pemadam_kebakaran",
    name: "Dinas Pemadam Kebakaran",
    short: "Damkar",
    description: "Menangani kejadian kebakaran dan respon darurat kebakaran.",
  },
  {
    code: "kesehatan",
    name: "Dinas Kesehatan",
    short: "Kesehatan",
    description: "Menangani fasilitas dan layanan kesehatan publik.",
  },
];

const CABANG_SEED_DATA: CabangSeedDefinition[] = [
  { name: "Dinas Bina Marga Provinsi DKI Jakarta", type: "bina_marga", lat: -6.1818, lng: 106.8223 },
  { name: "Dinas Sumber Daya Air Provinsi DKI Jakarta", type: "sda", lat: -6.182, lng: 106.82 },
  { name: "Dinas Lingkungan Hidup Provinsi DKI Jakarta", type: "lingkungan_hidup", lat: -6.2625, lng: 106.877 },
  { name: "Dinas Perhubungan Provinsi DKI Jakarta", type: "perhubungan", lat: -6.177, lng: 106.8185 },
  { name: "Dinas Cipta Karya, Tata Ruang dan Pertanahan DKI", type: "cipta_karya", lat: -6.1795, lng: 106.8228 },
  { name: "Suku Dinas Bina Marga Jakarta Pusat", type: "bina_marga", lat: -6.1764, lng: 106.8322 },
  { name: "Suku Dinas Lingkungan Hidup Jakarta Pusat", type: "lingkungan_hidup", lat: -6.1685, lng: 106.8521 },
  { name: "Suku Dinas Perhubungan Jakarta Pusat", type: "perhubungan", lat: -6.165, lng: 106.839 },
  { name: "Suku Dinas Sumber Daya Air Jakarta Pusat", type: "sda", lat: -6.173, lng: 106.828 },
  { name: "Suku Dinas Bina Marga Jakarta Selatan", type: "bina_marga", lat: -6.2415, lng: 106.8045 },
  { name: "Suku Dinas Lingkungan Hidup Jakarta Selatan", type: "lingkungan_hidup", lat: -6.253, lng: 106.814 },
  { name: "Suku Dinas Perhubungan Jakarta Selatan", type: "perhubungan", lat: -6.2665, lng: 106.8055 },
  { name: "Suku Dinas Sumber Daya Air Jakarta Selatan", type: "sda", lat: -6.255, lng: 106.8 },
  { name: "Suku Dinas Bina Marga Jakarta Barat", type: "bina_marga", lat: -6.1845, lng: 106.7565 },
  { name: "Suku Dinas Lingkungan Hidup Jakarta Barat", type: "lingkungan_hidup", lat: -6.164, lng: 106.745 },
  { name: "Suku Dinas Perhubungan Jakarta Barat", type: "perhubungan", lat: -6.155, lng: 106.738 },
  { name: "Suku Dinas Sumber Daya Air Jakarta Barat", type: "sda", lat: -6.181, lng: 106.743 },
  { name: "Suku Dinas Bina Marga Jakarta Timur", type: "bina_marga", lat: -6.2145, lng: 106.885 },
  { name: "Suku Dinas Lingkungan Hidup Jakarta Timur", type: "lingkungan_hidup", lat: -6.2085, lng: 106.897 },
  { name: "Suku Dinas Perhubungan Jakarta Timur", type: "perhubungan", lat: -6.223, lng: 106.901 },
  { name: "Suku Dinas Sumber Daya Air Jakarta Timur", type: "sda", lat: -6.2105, lng: 106.879 },
  { name: "Suku Dinas Bina Marga Jakarta Utara", type: "bina_marga", lat: -6.1245, lng: 106.892 },
  { name: "Suku Dinas Lingkungan Hidup Jakarta Utara", type: "lingkungan_hidup", lat: -6.136, lng: 106.8855 },
  { name: "Suku Dinas Perhubungan Jakarta Utara", type: "perhubungan", lat: -6.128, lng: 106.902 },
  { name: "Suku Dinas Sumber Daya Air Jakarta Utara", type: "sda", lat: -6.1305, lng: 106.8845 },
  { name: "Dinas Pekerjaan Umum dan Penataan Ruang Kota Tangerang", type: "pupr", lat: -6.1705, lng: 106.6322 },
  { name: "Dinas Perhubungan Kota Tangerang", type: "perhubungan", lat: -6.185, lng: 106.643 },
  { name: "Dinas Lingkungan Hidup Kota Tangerang", type: "lingkungan_hidup", lat: -6.152, lng: 106.621 },
  { name: "Dinas Perumahan dan Permukiman Kota Tangerang", type: "perumahan", lat: -6.168, lng: 106.63 },
  { name: "Satuan Polisi Pamong Praja Kota Tangerang", type: "satpol_pp", lat: -6.172, lng: 106.6315 },
  { name: "BPBD Kota Tangerang", type: "bpbd", lat: -6.177, lng: 106.634 },
  { name: "Dinas Pekerjaan Umum Kota Tangerang Selatan", type: "pupr", lat: -6.2895, lng: 106.716 },
  { name: "Dinas Bina Marga dan SDA Tangerang Selatan", type: "bina_marga", lat: -6.291, lng: 106.7155 },
  { name: "Dinas Perhubungan Tangerang Selatan", type: "perhubungan", lat: -6.287, lng: 106.718 },
  { name: "Dinas Lingkungan Hidup Tangerang Selatan", type: "lingkungan_hidup", lat: -6.285, lng: 106.7195 },
  { name: "Satpol PP Tangerang Selatan", type: "satpol_pp", lat: -6.29, lng: 106.715 },
  { name: "BPBD Tangerang Selatan", type: "bpbd", lat: -6.288, lng: 106.72 },
  { name: "Dinas Pekerjaan Umum Kab. Tangerang", type: "pupr", lat: -6.225, lng: 106.471 },
  { name: "Dinas Bina Marga dan SDA Kab. Tangerang", type: "bina_marga", lat: -6.226, lng: 106.4705 },
  { name: "Dinas Perhubungan Kab. Tangerang", type: "perhubungan", lat: -6.223, lng: 106.472 },
  { name: "Dinas Kebersihan dan Pertamanan Kab. Tangerang", type: "lingkungan_hidup", lat: -6.2245, lng: 106.469 },
  { name: "Satpol PP Kabupaten Tangerang", type: "satpol_pp", lat: -6.227, lng: 106.473 },
  { name: "Dinas Penanaman Modal & Pelayanan Terpadu Satu Pintu Jakarta", type: "ptsp", lat: -6.183, lng: 106.829 },
  { name: "Dinas Pemadam Kebakaran DKI Jakarta", type: "pemadam_kebakaran", lat: -6.171, lng: 106.812 },
  { name: "UPT TransJakarta - Dinas Perhubungan", type: "perhubungan", lat: -6.244, lng: 106.8775 },
  { name: "UPT Suku Dinas Kebersihan Jaktim", type: "lingkungan_hidup", lat: -6.218, lng: 106.912 },
  { name: "UPT Suku Dinas Bina Marga Blok M", type: "bina_marga", lat: -6.2445, lng: 106.8001 },
  { name: "Pusat Kendali Lalu Lintas DKI Jakarta", type: "perhubungan", lat: -6.1775, lng: 106.819 },
  { name: "Balai Besar Wilayah Sungai Ciliwung Cisadane", type: "sda", lat: -6.242, lng: 106.866 },
  { name: "Dinas Kesehatan Provinsi DKI Jakarta", type: "kesehatan", lat: -6.176, lng: 106.825 },
];

function inferProvince(name: string) {
  if (name.includes("Tangerang")) {
    return "Banten";
  }

  return "DKI Jakarta";
}

function inferCityRegency(name: string) {
  if (name.includes("Jakarta Pusat")) return "Jakarta Pusat";
  if (name.includes("Jakarta Selatan") || name.includes("Blok M")) return "Jakarta Selatan";
  if (name.includes("Jakarta Barat")) return "Jakarta Barat";
  if (name.includes("Jakarta Timur") || name.includes("Jaktim")) return "Jakarta Timur";
  if (name.includes("Jakarta Utara")) return "Jakarta Utara";
  if (name.includes("Kota Tangerang Selatan") || name.includes("Tangerang Selatan")) return "Tangerang Selatan";
  if (name.includes("Kota Tangerang")) return "Kota Tangerang";
  if (name.includes("Kab. Tangerang") || name.includes("Kabupaten Tangerang")) return "Kabupaten Tangerang";
  if (name.includes("DKI Jakarta") || name.includes("Jakarta")) return "DKI Jakarta";
  return "Jabodetabek";
}

function inferWilayah(name: string) {
  if (name.includes("Jakarta Pusat")) return "jakarta_pusat";
  if (name.includes("Jakarta Selatan") || name.includes("Blok M")) return "jakarta_selatan";
  if (name.includes("Jakarta Barat")) return "jakarta_barat";
  if (name.includes("Jakarta Timur") || name.includes("Jaktim")) return "jakarta_timur";
  if (name.includes("Jakarta Utara")) return "jakarta_utara";
  if (name.includes("Kota Tangerang Selatan") || name.includes("Tangerang Selatan")) return "kota_tangerang_selatan";
  if (name.includes("Kota Tangerang")) return "kota_tangerang";
  if (name.includes("Kab. Tangerang") || name.includes("Kabupaten Tangerang")) return "kabupaten_tangerang";
  if (name.includes("Balai Besar")) return "jabodetabek";
  if (name.includes("DKI Jakarta") || name.includes("Jakarta")) return "dki_jakarta";
  return "jabodetabek";
}

function inferCoverageRadiusKm(name: string) {
  if (name.includes("Balai Besar")) return 50;
  if (name.includes("Pusat Kendali")) return 30;
  if (name.includes("UPT")) return 12;
  if (name.includes("Provinsi DKI Jakarta") || name.includes("DKI Jakarta")) return 35;
  if (name.includes("Tangerang Selatan") || name.includes("Kota Tangerang")) return 25;
  if (name.includes("Kab. Tangerang") || name.includes("Kabupaten Tangerang")) return 30;
  return 20;
}

function inferServiceTags(office: CabangSeedDefinition) {
  const tags = new Set<string>([office.type]);

  if (office.name.includes("Bina Marga dan SDA")) {
    tags.add("sda");
  }

  if (office.type === "pupr") {
    tags.add("bina_marga");
    tags.add("cipta_karya");
  }

  if (office.type === "perumahan") {
    tags.add("cipta_karya");
  }

  if (office.type === "pemadam_kebakaran") {
    tags.add("bpbd");
  }

  return Array.from(tags);
}

async function seedDinas() {
  const dinasIdByCode = new Map<string, string>();

  for (const dinas of DINAS_DEFINITIONS) {
    const saved = await prisma.dinas.upsert({
      where: { code: dinas.code },
      update: {
        type: dinas.code,
        name: dinas.name,
        short: dinas.short,
        wilayah: "jabodetabek",
        description: dinas.description,
        isActive: true,
      },
      create: {
        code: dinas.code,
        type: dinas.code,
        name: dinas.name,
        short: dinas.short,
        wilayah: "jabodetabek",
        description: dinas.description,
        isActive: true,
      },
    });

    dinasIdByCode.set(dinas.code, saved.id);
  }

  return dinasIdByCode;
}

async function seedKategori(dinasIdByCode: Map<string, string>) {
  for (const category of REPORT_CATEGORIES) {
    const dinasId = dinasIdByCode.get(category.dinasCode);
    if (!dinasId) {
      throw new Error(`Missing dinas seed for category ${category.code}`);
    }

    await prisma.kategoriLaporan.upsert({
      where: { code: category.code },
      update: {
        name: category.name,
        description: category.description,
        slaHours: category.slaHours,
        urgencyWeight: category.urgencyWeight,
        keywords: category.keywords,
        isActive: true,
        dinasId,
      },
      create: {
        code: category.code,
        name: category.name,
        description: category.description,
        slaHours: category.slaHours,
        urgencyWeight: category.urgencyWeight,
        keywords: category.keywords,
        isActive: true,
        dinasId,
      },
    });
  }
}

async function seedCabang(dinasIdByCode: Map<string, string>) {
  for (const office of CABANG_SEED_DATA) {
    const dinasId = dinasIdByCode.get(office.type);
    if (!dinasId) {
      throw new Error(`Missing dinas seed for office ${office.name}`);
    }

    const wilayah = inferWilayah(office.name);
    const cityRegency = inferCityRegency(office.name);
    const province = inferProvince(office.name);
    const coverageRadiusKm = inferCoverageRadiusKm(office.name);
    const serviceTags = inferServiceTags(office);

    const existing = await prisma.cabangDinas.findFirst({
      where: {
        dinasId,
        name: office.name,
      },
    });

    const data = {
      name: office.name,
      wilayah,
      latitude: office.lat,
      longitude: office.lng,
      province,
      cityRegency,
      coverageRadiusKm,
      isRoutingEnabled: true,
      serviceTags,
      metadata: {
        seedSource: "laporpak_ai_smart_routing_prd",
      },
      dinasId,
    };

    if (existing) {
      await prisma.cabangDinas.update({
        where: { id: existing.id },
        data,
      });
      continue;
    }

    await prisma.cabangDinas.create({ data });
  }
}

async function main() {
  const dinasIdByCode = await seedDinas();
  await seedKategori(dinasIdByCode);
  await seedCabang(dinasIdByCode);

  console.log(
    `Seed selesai: ${DINAS_DEFINITIONS.length} dinas keluarga, ${REPORT_CATEGORIES.length} kategori, ${CABANG_SEED_DATA.length} kantor/cabang.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
