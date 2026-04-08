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
];

const CABANG_SEED_DATA: CabangSeedDefinition[] = [
  { name: "Dinas Bina Marga Provinsi DKI Jakarta", type: "bina_marga", lat: -6.1815245, lng: 106.8083873 },
  { name: "Dinas Perhubungan Provinsi DKI Jakarta", type: "perhubungan", lat: -6.180937, lng: 106.8061227 },
  { name: "Dinas Sumber Daya Air Provinsi DKI Jakarta", type: "sda", lat: -6.1818201, lng: 106.808434 },
  { name: "Dinas Lingkungan Hidup Provinsi DKI Jakarta", type: "lingkungan_hidup", lat: -6.2620057, lng: 106.8684938 },
  { name: "Dinas Cipta Karya Provinsi DKI Jakarta", type: "cipta_karya", lat: -6.1817698, lng: 106.808488 },

  { name: "Suku Dinas Bina Marga Jakarta Pusat", type: "bina_marga", lat: -6.1729767, lng: 106.8156661 },
  { name: "Suku Dinas Perhubungan Jakarta Pusat", type: "perhubungan", lat: -6.1732872, lng: 106.843113 },
  { name: "Suku Dinas Sumber Daya Air Jakarta Pusat", type: "sda", lat: -6.172831, lng: 106.8157424 },
  { name: "Suku Dinas Lingkungan Hidup Jakarta Pusat", type: "lingkungan_hidup", lat: -6.1856151, lng: 106.8714283 },
  { name: "Suku Dinas Cipta Karya Jakarta Pusat", type: "cipta_karya", lat: -6.173368, lng: 106.7418709 },

  { name: "Suku Dinas Bina Marga Jakarta Selatan", type: "bina_marga", lat: -6.2481435, lng: 106.8052141 },
  { name: "Suku Dinas Perhubungan Jakarta Selatan", type: "perhubungan", lat: -6.2435521, lng: 106.8496755 },
  { name: "Suku Dinas Sumber Daya Air Jakarta Selatan", type: "sda", lat: -6.247873, lng: 106.8054664 },
  { name: "Suku Dinas Lingkungan Hidup Jakarta Selatan", type: "lingkungan_hidup", lat: -6.2729846, lng: 106.8288313 },
  { name: "Suku Dinas Cipta Karya Jakarta Selatan", type: "cipta_karya", lat: -6.2729782, lng: 106.749004 },

  { name: "Suku Dinas Bina Marga Jakarta Barat", type: "bina_marga", lat: -6.1865033, lng: 106.7349719 },
  { name: "Suku Dinas Perhubungan Jakarta Barat", type: "perhubungan", lat: -6.1606247, lng: 106.7227033 },
  { name: "Suku Dinas Sumber Daya Air Jakarta Barat", type: "sda", lat: -6.1866909, lng: 106.7351085 },
  { name: "Suku Dinas Lingkungan Hidup Jakarta Barat", type: "lingkungan_hidup", lat: -6.1525446, lng: 106.7699173 },
  { name: "Suku Dinas Cipta Karya Jakarta Barat", type: "cipta_karya", lat: -6.186595, lng: 106.7347119 },

  { name: "Suku Dinas Bina Marga Jakarta Timur", type: "bina_marga", lat: -6.2163764, lng: 106.8751829 },
  { name: "Suku Dinas Perhubungan Jakarta Timur", type: "perhubungan", lat: -6.2203938, lng: 106.8512349 },
  { name: "Suku Dinas Sumber Daya Air Jakarta Timur", type: "sda", lat: -6.213514, lng: 106.9390526 },
  { name: "Suku Dinas Lingkungan Hidup Jakarta Timur", type: "lingkungan_hidup", lat: -6.2885158, lng: 106.8781325 },
  { name: "Suku Dinas Cipta Karya Jakarta Timur", type: "cipta_karya", lat: -6.2140259, lng: 106.9435105 },

  { name: "Suku Dinas Bina Marga Jakarta Utara", type: "bina_marga", lat: -6.1380, lng: 106.8806 },
  { name: "Suku Dinas Perhubungan Jakarta Utara", type: "perhubungan", lat: -6.1226748, lng: 106.8898127 },
  { name: "Suku Dinas Sumber Daya Air Jakarta Utara", type: "sda", lat: -6.1207899, lng: 106.889204 },
  { name: "Suku Dinas Lingkungan Hidup Jakarta Utara", type: "lingkungan_hidup", lat: -6.1259971, lng: 106.8978756 },
  { name: "Suku Dinas Cipta Karya Jakarta Utara", type: "cipta_karya", lat: -6.1202506, lng: 106.8904244 },
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
