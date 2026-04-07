import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

import { UPLOAD_DIR, UPLOAD_PUBLIC_PATH } from "../config/storage.js";
import { REPORT_CATEGORIES } from "../data/reportCategories.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const VALID_CODES = new Set(REPORT_CATEGORIES.map((category) => category.code));
const CATEGORY_DINAS_MAP = new Map(
  REPORT_CATEGORIES.map((category) => [category.code, category.dinasCode]),
);
const MAX_IMAGES = 5;
const LOCAL_UPLOAD_PREFIX = `${UPLOAD_PUBLIC_PATH}/`;
const PUBLIC_LIGHT_HINTS = ["lampu jalan", "pju", "tiang lampu", "jalan", "fasilitas umum"];

export interface ClassificationResult {
  categoryCode: string;
  confidence: number;
  reasoning: string;
}

export interface ReportAnalysisResult {
  accepted: boolean;
  rejectionCode: string | null;
  rejectionReason: string | null;
  suggestedRewrite: string | null;
  categoryCode: string | null;
  confidence: number;
  clarityScore: number;
  seriousnessScore: number;
  reasoning: string;
  acceptedImagePaths: string[];
  ignoredImagePaths: string[];
}

export function getDinasTypeForCategory(categoryCode: string): string | undefined {
  return CATEGORY_DINAS_MAP.get(categoryCode);
}

function buildPrompt(title: string, description: string) {
  const categoryList = REPORT_CATEGORIES.map(
    (category) => `- ${category.code}: ${category.name} - ${category.description}`,
  ).join("\n");

  return `Anda adalah AI wrapper untuk aplikasi pengaduan warga Indonesia bernama LaporPak.

Tugas Anda:
1. Menilai apakah laporan warga cukup jelas, serius, dan layak diproses.
2. Menolak laporan yang terlalu samar, bercanda, spam, atau tidak terkait masalah publik.
3. Jika laporan layak diproses, klasifikasikan ke tepat satu kategori resmi.

Tolak laporan jika:
- terlalu pendek atau terlalu samar
- terdengar tidak serius, bercanda, spam, atau menghina
- ambigu antara masalah pribadi dan masalah fasilitas umum/publik
- tidak jelas menggambarkan layanan publik, fasilitas umum, infrastruktur kota, atau kondisi darurat
- tidak punya detail yang cukup untuk dipetakan ke satu kategori

Aturan penting:
- "mati lampu" itu ambigu dan harus ditolak kecuali jelas maksudnya lampu jalan, PJU, atau fasilitas umum lain
- jangan memaksa memilih kategori kalau laporannya tidak jelas

Daftar kategori resmi:
${categoryList}

Judul laporan warga: ${title}
Deskripsi laporan warga: ${description}

Balas HANYA dengan JSON valid. Semua isi teks wajib dalam bahasa Indonesia:
{"accepted": true, "rejectionCode": null, "rejectionReason": null, "suggestedRewrite": null, "categoryCode": "<one of the category codes above or null>", "confidence": 0.0, "clarityScore": 0, "seriousnessScore": 0, "reasoning": "<short explanation in Indonesian>"}`;
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  return map[ext.toLowerCase()] || "image/jpeg";
}

function isAcceptedImagePath(imagePath: string) {
  return (
    imagePath.startsWith(LOCAL_UPLOAD_PREFIX) ||
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://")
  );
}

function sanitizeReportImagePaths(imagePaths?: string[]) {
  const accepted: string[] = [];
  const ignored: string[] = [];
  const localUploadPaths: string[] = [];

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

    if (trimmed.startsWith(LOCAL_UPLOAD_PREFIX)) {
      localUploadPaths.push(trimmed);
    }
  }

  return {
    accepted,
    ignored,
    localUploadPaths,
  };
}

function loadImageParts(imagePaths: string[]) {
  const parts: Array<{ inlineData: { data: string; mimeType: string } }> = [];

  for (const imgPath of imagePaths.slice(0, MAX_IMAGES)) {
    try {
      const filename = path.basename(imgPath);
      const absPath = path.join(UPLOAD_DIR, filename);

      if (!fs.existsSync(absPath)) {
        continue;
      }

      const data = fs.readFileSync(absPath).toString("base64");
      const ext = path.extname(filename);
      parts.push({ inlineData: { data, mimeType: getMimeType(ext) } });
    } catch {
      // Ignore unreadable images and continue.
    }
  }

  return parts;
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

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\blobang\b/g, "lubang")
    .replace(/\bberlubang\b/g, "lubang")
    .replace(/\bjalanan\b/g, "jalan")
    .replace(/\bpju\b/g, "lampu jalan")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  input: { title: string; description: string; imagePaths?: string[] },
  sanitizedImages: ReturnType<typeof sanitizeReportImagePaths>,
  cause: unknown,
): ReportAnalysisResult {
  const normalizedTitle = normalizeText(input.title);
  const normalizedDescription = normalizeText(input.description);
  const normalizedCombined = `${normalizedTitle} ${normalizedDescription}`.trim();
  const wordCount = normalizedCombined.split(" ").filter(Boolean).length;
  const geminiFailedMessage =
    cause instanceof Error ? cause.message : "AI utama tidak tersedia";

  const ambiguousLampu =
    (normalizedCombined.includes("mati lampu") || normalizedCombined.includes("lampu mati")) &&
    !PUBLIC_LIGHT_HINTS.some((hint) => normalizedCombined.includes(hint));

  if (ambiguousLampu) {
    return buildFallbackRejectedAnalysis({
      sanitizedImages,
      rejectionCode: "ambiguous_private_or_public",
      rejectionReason:
        "Laporan ambigu antara listrik pribadi dan lampu jalan/fasilitas umum.",
      suggestedRewrite:
        "Jelaskan bahwa yang mati adalah lampu jalan atau PJU, lalu sebutkan lokasi yang jelas.",
      clarityScore: 30,
      seriousnessScore: 70,
      reasoning:
        "Sistem fallback lokal menolak laporan karena frasa 'mati lampu' masih ambigu.",
    });
  }

  const categoryScores = REPORT_CATEGORIES.map((category) => {
    const normalizedKeywords = Array.from(
      new Set([
        normalizeText(category.name),
        normalizeText(category.description),
        ...category.keywords.map((keyword) => normalizeText(keyword)),
      ]),
    ).filter(Boolean);

    const matchedKeywords = normalizedKeywords.filter(
      (keyword) => keyword && normalizedCombined.includes(keyword),
    );

    return {
      category,
      matchedKeywords,
      score: matchedKeywords.length,
    };
  }).sort((left, right) => right.score - left.score);

  const topMatch = categoryScores[0];

  if (!topMatch || topMatch.score === 0 || (wordCount < 4 && topMatch.score < 2)) {
    return buildFallbackRejectedAnalysis({
      sanitizedImages,
      rejectionCode: "laporan_tidak_cukup_jelas",
      rejectionReason:
        "Laporan belum cukup jelas untuk dipetakan ke kategori layanan publik tertentu.",
      suggestedRewrite:
        "Sebutkan objek yang bermasalah, jenis kerusakan, lokasi, dan dampaknya bagi warga.",
      clarityScore: Math.max(20, Math.min(45, normalizedCombined.length * 2)),
      seriousnessScore: 65,
      reasoning: `Sistem fallback lokal tidak menemukan kata kunci yang cukup kuat. Penyebab AI utama gagal: ${geminiFailedMessage}`,
    });
  }

  const confidence = Math.min(0.82, 0.42 + topMatch.score * 0.14);
  const clarityScore = Math.min(92, 45 + topMatch.score * 12 + Math.min(wordCount, 12));
  const seriousnessScore = Math.min(100, Math.max(55, topMatch.category.urgencyWeight));
  const matchedPhrase =
    topMatch.matchedKeywords.slice(0, 3).join(", ") || topMatch.category.name;

  return {
    accepted: true,
    rejectionCode: null,
    rejectionReason: null,
    suggestedRewrite: null,
    categoryCode: topMatch.category.code,
    confidence,
    clarityScore,
    seriousnessScore,
    reasoning: `AI utama tidak tersedia, sistem fallback lokal menetapkan kategori ${topMatch.category.name} berdasarkan kata kunci: ${matchedPhrase}.`,
    acceptedImagePaths: sanitizedImages.accepted,
    ignoredImagePaths: sanitizedImages.ignored,
  };
}

export async function analyzeReportSubmission(input: {
  title: string;
  description: string;
  imagePaths?: string[];
}): Promise<ReportAnalysisResult> {
  const sanitizedImages = sanitizeReportImagePaths(input.imagePaths);
  const imageParts = sanitizedImages.localUploadPaths.length
    ? loadImageParts(sanitizedImages.localUploadPaths)
    : [];

  const contents: Array<
    { text: string } | { inlineData: { data: string; mimeType: string } }
  > = [{ text: buildPrompt(input.title, input.description) }, ...imageParts];

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
      acceptedImagePaths: sanitizedImages.accepted,
      ignoredImagePaths: sanitizedImages.ignored,
    };
  } catch (error) {
    console.error("[report-ai] Gemini failed, using heuristic fallback:", error);
    return analyzeWithHeuristics(input, sanitizedImages, error);
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
