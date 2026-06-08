export type ExtractedFieldName =
  | "name"
  | "dob"
  | "address"
  | "documentNumber"
  | "documentExpiry"
  | "issuedAt";

export interface OcrField {
  name: ExtractedFieldName;
  value: string;
  confidence: number;
  source: string;
}

export interface OcrExtraction {
  engine: string;
  status: "completed" | "requires_review";
  rawText: string;
  confidence: number;
  fields: OcrField[];
  metadata: Record<string, unknown>;
}

export interface OcrInput {
  fileName: string;
  mimeType: string;
  bytes?: Buffer;
}

export class OcrService {
  async extract(input: OcrInput): Promise<OcrExtraction> {
    const rawText = normalizeText(extractReadableText(input));
    const fields = extractFields(rawText);
    const confidence = fields.length ? average(fields.map((field) => field.confidence)) : 0.35;

    return {
      engine: "gateway-regex-ocr-v1",
      status: confidence >= 0.7 ? "completed" : "requires_review",
      rawText,
      confidence,
      fields,
      metadata: {
        fileName: input.fileName,
        mimeType: input.mimeType,
        bytesInspected: input.bytes?.length ?? 0,
        parser: "text-pattern"
      }
    };
  }
}

export const ocrService = new OcrService();

function extractReadableText(input: OcrInput): string {
  const bytes = input.bytes ?? Buffer.alloc(0);
  const text = bytes.toString("utf8");
  const printableRatio = text.length ? text.replace(/[^\x20-\x7E\r\n\t]/g, "").length / text.length : 0;
  if (printableRatio > 0.55) return text;

  return input.fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ");
}

function extractFields(rawText: string): OcrField[] {
  const candidates: OcrField[] = [];
  addMatch(candidates, "name", rawText, /\b(?:name|full name|applicant)\s*[:\-]\s*([A-Z][A-Za-z .'-]{2,80})/i, 0.86);
  addMatch(candidates, "dob", rawText, /\b(?:dob|date of birth|birth date)\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i, 0.9);
  addMatch(candidates, "address", rawText, /\b(?:address|residence)\s*[:\-]\s*([A-Za-z0-9 ,.'#/-]{8,160})/i, 0.78);
  addMatch(candidates, "documentNumber", rawText, /\b(?:document|passport|id|licen[cs]e)\s*(?:no|number|#)\s*[:\-]?\s*([A-Z0-9-]{5,30})/i, 0.82);
  addMatch(candidates, "documentExpiry", rawText, /\b(?:expiry|expires|expiration|valid until)\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i, 0.88);
  addMatch(candidates, "issuedAt", rawText, /\b(?:issued|issue date)\s*[:\-]\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i, 0.75);
  return dedupeByName(candidates);
}

function addMatch(
  fields: OcrField[],
  name: ExtractedFieldName,
  rawText: string,
  pattern: RegExp,
  confidence: number
): void {
  const match = rawText.match(pattern);
  const value = match?.[1]?.trim();
  if (value) fields.push({ name, value, confidence, source: "regex" });
}

function dedupeByName(fields: OcrField[]): OcrField[] {
  const byName = new Map<ExtractedFieldName, OcrField>();
  for (const field of fields) {
    const existing = byName.get(field.name);
    if (!existing || field.confidence > existing.confidence) byName.set(field.name, field);
  }
  return [...byName.values()];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 20000);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
