import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const CATEGORIES = [
  { code: "jalan_rusak", name: "Jalan Rusak", dinas: "dinas_pu", desc: "Damaged roads, potholes, cracked pavement" },
  { code: "jembatan_rusak", name: "Jembatan Rusak", dinas: "dinas_pu", desc: "Damaged bridges, broken railings" },
  { code: "drainase_tersumbat", name: "Drainase Tersumbat", dinas: "dinas_pu", desc: "Clogged drains, blocked waterways" },
  { code: "trotoar_rusak", name: "Trotoar Rusak", dinas: "dinas_pu", desc: "Damaged sidewalks, pedestrian paths" },
  { code: "bangunan_publik_rusak", name: "Bangunan Publik Rusak", dinas: "dinas_pu", desc: "Damaged public buildings" },
  { code: "sampah_menumpuk", name: "Sampah Menumpuk", dinas: "dlhk", desc: "Accumulated garbage, overflowing bins" },
  { code: "pencemaran_air", name: "Pencemaran Air", dinas: "dlhk", desc: "Water pollution, contaminated water" },
  { code: "pencemaran_udara", name: "Pencemaran Udara", dinas: "dlhk", desc: "Air pollution, smog, burning waste" },
  { code: "pohon_tumbang", name: "Pohon Tumbang", dinas: "dlhk", desc: "Fallen trees blocking roads or areas" },
  { code: "sampah_sungai", name: "Sampah Sungai", dinas: "dlhk", desc: "River trash, waste in waterways" },
  { code: "banjir", name: "Banjir", dinas: "bpbd", desc: "Flooding, submerged roads or areas" },
  { code: "tanah_longsor", name: "Tanah Longsor", dinas: "bpbd", desc: "Landslides, earth movement" },
  { code: "kebakaran", name: "Kebakaran", dinas: "bpbd", desc: "Fires, burning buildings or areas" },
  { code: "bencana_lain", name: "Bencana Lain", dinas: "bpbd", desc: "Other disasters not listed above" },
  { code: "lampu_jalan_mati", name: "Lampu Jalan Mati", dinas: "dishub", desc: "Broken or non-functioning street lights" },
  { code: "rambu_lalulintas", name: "Rambu Lalu Lintas", dinas: "dishub", desc: "Damaged or missing traffic signs" },
  { code: "kemacetan", name: "Kemacetan", dinas: "dishub", desc: "Traffic congestion, road blockages" },
  { code: "listrik_padam", name: "Listrik Padam", dinas: "pln", desc: "Power outages, electricity failure" },
  { code: "kabel_bahaya", name: "Kabel Bahaya", dinas: "pln", desc: "Dangerous exposed electrical cables" },
] as const;

const VALID_CODES = new Set(CATEGORIES.map((c) => c.code));
const CATEGORY_DINAS_MAP = new Map<string, string>(CATEGORIES.map((c) => [c.code, c.dinas]));

export function getDinasTypeForCategory(categoryCode: string): string | undefined {
  return CATEGORY_DINAS_MAP.get(categoryCode);
}

const UPLOAD_DIR = path.resolve("uploads");
const MAX_IMAGES = 3;

function buildPrompt(title: string, description: string): string {
  const categoryList = CATEGORIES.map((c) => `- ${c.code}: ${c.name} — ${c.desc}`).join("\n");

  return `You are a civic infrastructure report classifier for an Indonesian city government platform called LaporPak. Classify the following citizen report into exactly ONE of these categories:

${categoryList}

Report title: ${title}
Report description: ${description}

Respond with ONLY valid JSON (no markdown fencing, no extra text):
{"categoryCode": "<one of the codes above>", "confidence": <number between 0.0 and 1.0>, "reasoning": "<one sentence explanation in Indonesian>"}`;
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

function loadImageParts(imagePaths: string[]) {
  const parts: Array<{ inlineData: { data: string; mimeType: string } }> = [];

  for (const imgPath of imagePaths.slice(0, MAX_IMAGES)) {
    try {
      const filename = path.basename(imgPath);
      const absPath = path.join(UPLOAD_DIR, filename);

      if (!fs.existsSync(absPath)) continue;

      const data = fs.readFileSync(absPath).toString("base64");
      const ext = path.extname(filename);
      parts.push({ inlineData: { data, mimeType: getMimeType(ext) } });
    } catch {
      // Skip unreadable images silently
    }
  }

  return parts;
}

export interface ClassificationResult {
  categoryCode: string;
  confidence: number;
  reasoning: string;
}

export async function classifyReport(input: {
  title: string;
  description: string;
  imagePaths?: string[];
}): Promise<ClassificationResult> {
  const prompt = buildPrompt(input.title, input.description);
  const imageParts = input.imagePaths?.length ? loadImageParts(input.imagePaths) : [];

  const contents: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: prompt },
    ...imageParts,
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: contents,
  });

  const text = response.text ?? "";
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${cleaned.slice(0, 200)}`);
  }

  if (!parsed.categoryCode || !VALID_CODES.has(parsed.categoryCode)) {
    throw new Error(`Gemini returned unknown category: ${parsed.categoryCode}`);
  }

  return {
    categoryCode: parsed.categoryCode,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    reasoning: String(parsed.reasoning || ""),
  };
}

export { CATEGORIES };
