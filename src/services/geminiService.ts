import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { REPORT_CATEGORIES } from "../data/reportCategories.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const CATEGORIES = REPORT_CATEGORIES.map((category) => ({
  code: category.code,
  name: category.name,
  dinas: category.dinasCode,
  desc: category.description,
}));

const VALID_CODES = new Set(REPORT_CATEGORIES.map((category) => category.code));
const CATEGORY_DINAS_MAP = new Map(
  REPORT_CATEGORIES.map((category) => [category.code, category.dinasCode]),
);

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
    model: "gemini-3.1-flash-lite-preview",
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
