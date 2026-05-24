import { GoogleGenAI } from "@google/genai";
import path from "path";

import { REPORT_CATEGORIES } from "./data/reportCategories.js";
import type {
  ClassificationResult,
  ReportAiImage,
  ReportAnalysisResult,
} from "../../types/reportAi.js";

export type {
  ClassificationResult,
  ReportAiImage,
  ReportAnalysisResult,
} from "../../types/reportAi.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const VALID_CODES = new Set(REPORT_CATEGORIES.map((category) => category.code));
const CATEGORY_DINAS_MAP = new Map(
  REPORT_CATEGORIES.map((category) => [category.code, category.dinasCode]),
);
const MAX_IMAGES = 5;
const MAX_AI_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DIRECT_IMAGE_URL = /^https?:\/\//i;

type GeminiContentPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

export function getDinasTypeForCategory(categoryCode: string): string | undefined {
  return CATEGORY_DINAS_MAP.get(categoryCode);
}

function buildPrompt(title: string, description: string, imageCount: number) {
  const categoryList = REPORT_CATEGORIES.map(
    (category) => `- ${category.code}: ${category.name} - ${category.description}`,
  ).join("\n");

  return `Anda adalah AI wrapper untuk aplikasi pengaduan warga Indonesia bernama LaporPak.

Tugas Anda:
1. Menilai teks laporan DAN ${imageCount} foto bukti yang dilampirkan.
2. Menolak laporan yang terlalu samar, bercanda, spam, atau tidak terkait masalah publik.
3. Menolak laporan jika foto tidak menunjukkan masalah fasilitas publik/infrastruktur/lingkungan yang relevan.
4. Jika teks dan foto sama-sama layak diproses, klasifikasikan ke tepat satu kategori resmi.

Tolak laporan jika:
- terlalu pendek atau terlalu samar
- terdengar tidak serius, bercanda, spam, atau menghina
- ambigu antara masalah pribadi dan masalah fasilitas umum/publik
- tidak jelas menggambarkan layanan publik, fasilitas umum, infrastruktur kota, atau kondisi darurat
- tidak punya detail yang cukup untuk dipetakan ke satu kategori
- foto tidak ada, tidak bisa dinilai, buram/gelap total, screenshot/meme/selfie, atau tidak memperlihatkan masalah publik
- isi foto bertentangan dengan judul/deskripsi, misalnya teks melapor jalan rusak tetapi foto tidak menunjukkan jalan/kerusakan

Aturan penting:
- "mati lampu" itu ambigu dan harus ditolak kecuali jelas maksudnya lampu jalan, PJU, atau fasilitas umum lain
- jangan memaksa memilih kategori kalau laporannya tidak jelas
- jangan menerima laporan hanya dari teks; minimal satu foto harus mendukung objek masalah dan kategori yang dipilih
- sebutkan di reasoning bukti visual apa yang terlihat atau kenapa foto tidak mendukung

Daftar kategori resmi:
${categoryList}

Judul laporan warga: ${title}
Deskripsi laporan warga: ${description}

Balas HANYA dengan JSON valid. Semua isi teks wajib dalam bahasa Indonesia:
{"accepted": true, "rejectionCode": null, "rejectionReason": null, "suggestedRewrite": null, "categoryCode": "<one of the category codes above or null>", "confidence": 0.0, "clarityScore": 0, "seriousnessScore": 0, "reasoning": "<short explanation in Indonesian>"}`;
}

function getMimeType(ext: string): string | null {
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  return map[ext.toLowerCase()] ?? null;
}

function getSupportedMimeTypeFromPath(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = getMimeType(ext);
  return mimeType && SUPPORTED_IMAGE_MIME_TYPES.has(mimeType) ? mimeType : null;
}

function isAcceptedImagePath(imagePath: string) {
  return DIRECT_IMAGE_URL.test(imagePath);
}

function sanitizeReportImagePaths(imagePaths?: string[]) {
  const accepted: string[] = [];
  const ignored: string[] = [];

  for (const imagePath of imagePaths ?? []) {
    if (typeof imagePath !== "string") {
      continue;
    }

    const trimmed = imagePath.trim();
    if (!trimmed) {
      continue;
    }

    if (!isAcceptedImagePath(trimmed)) {
      ignored.push(trimmed);
      continue;
    }

    accepted.push(trimmed);
  }

  return {
    accepted,
    ignored,
    localUploadPaths: [],
  };
}

function loadBufferedImageParts(images: ReportAiImage[] = []) {
  const parts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
  const loadedImagePaths: string[] = [];
  const ignoredImagePaths: string[] = images.slice(MAX_IMAGES).map((image) => image.path);

  for (const image of images.slice(0, MAX_IMAGES)) {
    if (!image.path || !SUPPORTED_IMAGE_MIME_TYPES.has(image.mimeType) || image.size > MAX_AI_IMAGE_BYTES) {
      ignoredImagePaths.push(image.path);
      continue;
    }

    parts.push({
      inlineData: {
        data: image.buffer.toString("base64"),
        mimeType: image.mimeType,
      },
    });
    loadedImagePaths.push(image.path);
  }

  return {
    parts,
    loadedImagePaths,
    ignoredImagePaths,
  };
}

async function loadImageParts(imagePaths: string[], bufferedImages: ReportAiImage[] = []) {
  const buffered = loadBufferedImageParts(bufferedImages);
  const remainingSlots = Math.max(0, MAX_IMAGES - buffered.parts.length);
  const pathsLoadedFromBuffer = new Set(buffered.loadedImagePaths);
  const parts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
  const loadedImagePaths: string[] = [];
  const fetchCandidates = imagePaths.filter((imagePath) => !pathsLoadedFromBuffer.has(imagePath));
  const ignoredImagePaths: string[] = [
    ...buffered.ignoredImagePaths,
    ...fetchCandidates.slice(remainingSlots),
  ];

  for (const imgPath of fetchCandidates.slice(0, remainingSlots)) {
    try {
      const response = await fetch(imgPath);
      if (!response.ok) {
        ignoredImagePaths.push(imgPath);
        continue;
      }

      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
      const mimeType =
        contentType && SUPPORTED_IMAGE_MIME_TYPES.has(contentType)
          ? contentType
          : getSupportedMimeTypeFromPath(new URL(imgPath).pathname);
      if (!mimeType) {
        ignoredImagePaths.push(imgPath);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_AI_IMAGE_BYTES) {
        ignoredImagePaths.push(imgPath);
        continue;
      }

      parts.push({
        inlineData: {
          data: Buffer.from(arrayBuffer).toString("base64"),
          mimeType,
        },
      });
      loadedImagePaths.push(imgPath);
    } catch {
      ignoredImagePaths.push(imgPath);
    }
  }

  return {
    parts: [...buffered.parts, ...parts],
    loadedImagePaths: [...buffered.loadedImagePaths, ...loadedImagePaths],
    ignoredImagePaths,
  };
}

function normalizeBoundedNumber(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }

  return Math.max(min, Math.min(max, parsed));
}

function toNullableString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
}

function parseGeminiJson(rawText: string) {
  const cleaned = rawText
    .replace(/```json?\n?/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Failed to parse Gemini response as JSON: ${cleaned.slice(0, 200)}`,
    );
  }
}

function buildFallbackRejectedAnalysis(input: {
  sanitizedImages: ReturnType<typeof sanitizeReportImagePaths>;
  rejectionCode: string;
  rejectionReason: string;
  suggestedRewrite: string;
  clarityScore: number;
  seriousnessScore: number;
  reasoning: string;
}): ReportAnalysisResult {
  return {
    accepted: false,
    rejectionCode: input.rejectionCode,
    rejectionReason: input.rejectionReason,
    suggestedRewrite: input.suggestedRewrite,
    categoryCode: null,
    confidence: 0.25,
    clarityScore: input.clarityScore,
    seriousnessScore: input.seriousnessScore,
    reasoning: input.reasoning,
    acceptedImagePaths: input.sanitizedImages.accepted,
    ignoredImagePaths: input.sanitizedImages.ignored,
  };
}

function analyzeWithHeuristics(
  _input: { title: string; description: string; imagePaths?: string[] },
  sanitizedImages: ReturnType<typeof sanitizeReportImagePaths>,
  cause: unknown,
): ReportAnalysisResult {
  const geminiFailedMessage =
    cause instanceof Error ? cause.message : "AI utama tidak tersedia";

  return buildFallbackRejectedAnalysis({
    sanitizedImages,
    rejectionCode: "ai_vision_unavailable",
    rejectionReason:
      "AI vision belum bisa memeriksa foto bukti, jadi laporan tidak disetujui hanya dari teks.",
    suggestedRewrite:
      "Coba kirim ulang beberapa saat lagi dengan foto yang jelas memperlihatkan masalah publik.",
    clarityScore: 0,
    seriousnessScore: 0,
    reasoning: `Validasi visual wajib, tetapi AI vision gagal: ${geminiFailedMessage}`,
  });
}

export async function analyzeReportSubmission(input: {
  title: string;
  description: string;
  imagePaths?: string[];
  imageFiles?: ReportAiImage[];
}): Promise<ReportAnalysisResult> {
  const sanitizedImages = sanitizeReportImagePaths(input.imagePaths);
  const loadedImages = await loadImageParts(sanitizedImages.accepted, input.imageFiles);
  const resultImages = {
    ...sanitizedImages,
    accepted: loadedImages.loadedImagePaths,
    ignored: [...sanitizedImages.ignored, ...loadedImages.ignoredImagePaths],
    localUploadPaths: [],
  };

  if (loadedImages.parts.length === 0) {
    return buildFallbackRejectedAnalysis({
      sanitizedImages: resultImages,
      rejectionCode: "foto_bukti_tidak_valid",
      rejectionReason:
        "Laporan wajib menyertakan minimal satu foto bukti yang bisa diperiksa oleh AI.",
      suggestedRewrite:
        "Upload foto JPG, PNG, atau WebP yang jelas memperlihatkan objek masalah publik yang dilaporkan.",
      clarityScore: 0,
      seriousnessScore: 0,
      reasoning:
        "Tidak ada foto bukti yang berhasil dibaca untuk validasi visual AI.",
    });
  }

  const contents: GeminiContentPart[] = [
    { text: buildPrompt(input.title, input.description, loadedImages.loadedImagePaths.length) },
    ...loadedImages.parts,
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents,
    });

    const parsed = parseGeminiJson(response.text ?? "");
    const accepted = Boolean(parsed.accepted);
    const categoryCode = toNullableString(parsed.categoryCode);

    if (accepted && (!categoryCode || !VALID_CODES.has(categoryCode))) {
      throw new Error(`Gemini returned unknown category: ${parsed.categoryCode}`);
    }

    return {
      accepted,
      rejectionCode: toNullableString(parsed.rejectionCode),
      rejectionReason: toNullableString(parsed.rejectionReason),
      suggestedRewrite: toNullableString(parsed.suggestedRewrite),
      categoryCode: accepted && categoryCode ? categoryCode : null,
      confidence: normalizeBoundedNumber(parsed.confidence, 0, 1),
      clarityScore: Math.round(normalizeBoundedNumber(parsed.clarityScore, 0, 100)),
      seriousnessScore: Math.round(normalizeBoundedNumber(parsed.seriousnessScore, 0, 100)),
      reasoning: String(parsed.reasoning || ""),
      acceptedImagePaths: resultImages.accepted,
      ignoredImagePaths: resultImages.ignored,
    };
  } catch (error) {
    console.error("[report-ai] Gemini failed, using heuristic fallback:", error);
    return analyzeWithHeuristics(input, resultImages, error);
  }
}

export async function classifyReport(input: {
  title: string;
  description: string;
  imagePaths?: string[];
}): Promise<ClassificationResult> {
  const analysis = await analyzeReportSubmission(input);

  if (!analysis.accepted || !analysis.categoryCode) {
    throw new Error(analysis.rejectionReason || "Report rejected by AI validation");
  }

  return {
    categoryCode: analysis.categoryCode,
    confidence: analysis.confidence,
    reasoning: analysis.reasoning,
  };
}
