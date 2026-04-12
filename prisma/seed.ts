import "dotenv/config";
import { randomUUID } from "node:crypto";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { REPORT_CATEGORIES } from "../src/data/reportCategories.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });
const OFFICE_PHOTO_DIR = path.resolve("fotodinas");
const OFFICE_PHOTO_PUBLIC_PATH = "/fotodinas";
const OFFICE_PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULT_DINAS_ACCOUNT_PASSWORD = process.env.SEED_DINAS_PASSWORD || "LaporPak123!";
const DEFAULT_DINAS_EMAIL_DOMAIN = process.env.SEED_DINAS_EMAIL_DOMAIN || "laporpak.test";
const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@laporpak.test";
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "AdminLaporPak123!";
const DEFAULT_ADMIN_NAME = process.env.SEED_ADMIN_NAME || "Admin LaporPak";
const DEFAULT_USER_PASSWORD = process.env.SEED_USER_PASSWORD || "UserLaporPak123!";
const DEFAULT_DKI_JAKARTA_COORDINATES = {
  lat: -6.1753924,
  lng: 106.8271528,
};

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

interface SeededDinasAccount {
  code: string;
  email: string;
  cabangName: string;
}

interface SeededUserAccount {
  email: string;
  name: string;
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
    name: "Dinas Pekerjaan Umum dan Penataan Ruang",
    short: "PUPR",
    description: "Menangani infrastruktur umum dan penataan ruang lintas sektor teknis.",
  },
  {
    code: "perumahan",
    name: "Dinas Perumahan Rakyat dan Kawasan Permukiman",
    short: "Perumahan",
    description: "Menangani kawasan permukiman, hunian, dan sarana prasarana perumahan.",
  },
  {
    code: "satpol_pp",
    name: "Satuan Polisi Pamong Praja",
    short: "Satpol PP",
    description: "Menangani ketertiban umum, penegakan perda, dan pelanggaran ruang publik.",
  },
  {
    code: "bpbd",
    name: "Badan Penanggulangan Bencana Daerah",
    short: "BPBD",
    description: "Menangani tanggap darurat bencana, banjir, longsor, dan koordinasi kebencanaan.",
  },
  {
    code: "pemadam_kebakaran",
    name: "Dinas Penanggulangan Kebakaran dan Penyelamatan",
    short: "Damkar",
    description: "Menangani kebakaran, penyelamatan, dan respons kondisi darurat kebencanaan.",
  },
  {
    code: "ptsp",
    name: "Dinas Penanaman Modal dan Pelayanan Terpadu Satu Pintu",
    short: "PTSP",
    description: "Menangani layanan perizinan, administrasi, dan pelayanan terpadu masyarakat.",
  },
  {
    code: "kesehatan",
    name: "Dinas Kesehatan",
    short: "Kesehatan",
    description: "Menangani fasilitas kesehatan publik, sanitasi dasar, dan layanan kesehatan masyarakat.",
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

function getOfficePhotoUrls(type: string) {
  const folderPath = path.join(OFFICE_PHOTO_DIR, type);

  if (!fs.existsSync(folderPath)) {
    return [];
  }

  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => OFFICE_PHOTO_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((fileName) => `${OFFICE_PHOTO_PUBLIC_PATH}/${type}/${fileName}`);
}

function buildDinasSeedEmail(code: string) {
  return `dinas.${code.replace(/_/g, "-")}@${DEFAULT_DINAS_EMAIL_DOMAIN}`;
}

function buildUserSeedEmail(index: number) {
  return `warga.${String(index + 1).padStart(3, "0")}@${DEFAULT_DINAS_EMAIL_DOMAIN}`;
}

function buildDinasSeedNip(index: number) {
  return `SEED-DINAS-${String(index + 1).padStart(3, "0")}`;
}

function buildDefaultCabangSeed(dinas: DinasSeedDefinition): CabangSeedDefinition {
  return {
    name: `${dinas.name} Provinsi DKI Jakarta`,
    type: dinas.code,
    lat: DEFAULT_DKI_JAKARTA_COORDINATES.lat,
    lng: DEFAULT_DKI_JAKARTA_COORDINATES.lng,
  };
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
    const photoUrls = getOfficePhotoUrls(office.type);

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
      photos: photoUrls,
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

  for (const dinas of DINAS_DEFINITIONS) {
    const dinasId = dinasIdByCode.get(dinas.code);
    if (!dinasId) {
      throw new Error(`Missing dinas seed for default office ${dinas.name}`);
    }

    const cabangCount = await prisma.cabangDinas.count({
      where: { dinasId },
    });

    if (cabangCount > 0) {
      continue;
    }

    const defaultOffice = buildDefaultCabangSeed(dinas);
    const photoUrls = getOfficePhotoUrls(defaultOffice.type);

    await prisma.cabangDinas.create({
      data: {
        name: defaultOffice.name,
        wilayah: inferWilayah(defaultOffice.name),
        latitude: defaultOffice.lat,
        longitude: defaultOffice.lng,
        province: inferProvince(defaultOffice.name),
        cityRegency: inferCityRegency(defaultOffice.name),
        coverageRadiusKm: inferCoverageRadiusKm(defaultOffice.name),
        isRoutingEnabled: true,
        serviceTags: inferServiceTags(defaultOffice),
        photos: photoUrls,
        metadata: {
          seedSource: "laporpak_ai_smart_routing_prd",
          generatedDefaultBranch: true,
        },
        dinasId,
      },
    });
  }
}

async function findPrimaryCabangDinasId(dinasId: string) {
  const provinceOffice = await prisma.cabangDinas.findFirst({
    where: {
      dinasId,
      name: {
        contains: "Provinsi DKI Jakarta",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  if (provinceOffice) {
    return provinceOffice;
  }

  const fallbackOffice = await prisma.cabangDinas.findFirst({
    where: { dinasId },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  if (!fallbackOffice) {
    throw new Error(`Missing cabang dinas for dinasId ${dinasId}`);
  }

  return fallbackOffice;
}

async function seedAkunDinas(dinasIdByCode: Map<string, string>) {
  const seededAccounts: SeededDinasAccount[] = [];

  for (const [index, dinas] of DINAS_DEFINITIONS.entries()) {
    const dinasId = dinasIdByCode.get(dinas.code);
    if (!dinasId) {
      throw new Error(`Missing dinas seed for account ${dinas.name}`);
    }

    const cabang = await findPrimaryCabangDinasId(dinasId);
    const email = buildDinasSeedEmail(dinas.code);
    const passwordHash = await hashPassword(DEFAULT_DINAS_ACCOUNT_PASSWORD);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: `Petugas ${dinas.short}`,
        role: dinas.code,
        emailVerified: true,
        banned: false,
        banReason: null,
        banExpires: null,
      },
      create: {
        id: randomUUID(),
        name: `Petugas ${dinas.short}`,
        email,
        role: dinas.code,
        emailVerified: true,
      },
    });

    const credentialAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
      },
      select: {
        id: true,
      },
    });

    if (credentialAccount) {
      await prisma.account.update({
        where: { id: credentialAccount.id },
        data: {
          accountId: user.id,
          password: passwordHash,
        },
      });
    } else {
      await prisma.account.create({
        data: {
          id: randomUUID(),
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });
    }

    await prisma.petugasDinas.upsert({
      where: { userId: user.id },
      update: {
        nip: buildDinasSeedNip(index),
        cabangDinasId: cabang.id,
      },
      create: {
        nip: buildDinasSeedNip(index),
        userId: user.id,
        cabangDinasId: cabang.id,
      },
    });

    seededAccounts.push({
      code: dinas.code,
      email,
      cabangName: cabang.name,
    });
  }

  return seededAccounts;
}

async function seedWargaUsers(count = 5) {
  const seededUsers: SeededUserAccount[] = [];
  const passwordHash = await hashPassword(DEFAULT_USER_PASSWORD);

  for (let i = 0; i < count; i += 1) {
    const email = buildUserSeedEmail(i);
    const name = `Warga ${String(i + 1).padStart(2, "0")}`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: "warga",
        emailVerified: true,
        banned: false,
        banReason: null,
        banExpires: null,
      },
      create: {
        id: randomUUID(),
        name,
        email,
        role: "warga",
        emailVerified: true,
      },
    });

    const credentialAccount = await prisma.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
      },
      select: {
        id: true,
      },
    });

    if (credentialAccount) {
      await prisma.account.update({
        where: { id: credentialAccount.id },
        data: {
          accountId: user.id,
          password: passwordHash,
        },
      });
    } else {
      await prisma.account.create({
        data: {
          id: randomUUID(),
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });
    }

    seededUsers.push({ email, name });
  }

  return seededUsers;
}

async function seedAdminAccount() {
  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: DEFAULT_ADMIN_EMAIL },
    update: {
      name: DEFAULT_ADMIN_NAME,
      role: "admin",
      emailVerified: true,
      banned: false,
      banReason: null,
      banExpires: null,
    },
    create: {
      id: randomUUID(),
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      role: "admin",
      emailVerified: true,
    },
  });

  const credentialAccount = await prisma.account.findFirst({
    where: {
      userId: user.id,
      providerId: "credential",
    },
    select: {
      id: true,
    },
  });

  if (credentialAccount) {
    await prisma.account.update({
      where: { id: credentialAccount.id },
      data: {
        accountId: user.id,
        password: passwordHash,
      },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });
  }

  return {
    email: DEFAULT_ADMIN_EMAIL,
  };
}

async function main() {
  const dinasIdByCode = await seedDinas();
  await seedKategori(dinasIdByCode);
  await seedCabang(dinasIdByCode);
  const seededAccounts = await seedAkunDinas(dinasIdByCode);
  const seededUsers = await seedWargaUsers(5);
  const seededAdmin = await seedAdminAccount();

  console.log(
    `Seed selesai: ${DINAS_DEFINITIONS.length} dinas, ${REPORT_CATEGORIES.length} kategori, ${await prisma.cabangDinas.count()} kantor/cabang, ${seededAccounts.length} akun dinas.`,
  );
  console.log(
    `Login akun dinas: email format ${buildDinasSeedEmail("<kode_dinas>")} dengan password ${DEFAULT_DINAS_ACCOUNT_PASSWORD}.`,
  );
  console.log(
    `Login admin: ${seededAdmin.email} dengan password ${DEFAULT_ADMIN_PASSWORD}.`,
  );
  console.log(
    `Login warga: email format ${buildUserSeedEmail(0).replace("001", "<nnn>")} dengan password ${DEFAULT_USER_PASSWORD}.`,
  );
  console.log("Daftar akun admin:", { email: seededAdmin.email, role: "admin" });
  console.log(
    "Daftar akun dinas:",
    seededAccounts.map((account) => ({
      email: account.email,
      role: account.code,
      cabang: account.cabangName,
    })),
  );
  console.log(
    "Daftar akun warga:",
    seededUsers.map((user) => ({ email: user.email, role: "warga", name: user.name })),
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
