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

export interface ReportAiImage {
  path: string;
  buffer: Buffer;
  mimeType: string;
  size: number;
}
