import { randomUUID } from "crypto";
import { appMetrics } from "../observability/appMetrics";
import { writeAuditLog } from "./audit.service";

export interface OcrResult {
  documentId: string;
  extractedText: string;
  confidence: number;
}

export async function extractDocumentText(
  documentId: string,
  fileContent?: string
): Promise<OcrResult> {
  const startedAt = process.hrtime.bigint();

  const extractedText = fileContent
    ? simulateOcrExtraction(fileContent)
    : generateMockExtractedText(documentId);

  const confidence = calculateConfidence(extractedText);

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  appMetrics.increment("gateway_ocr_extractions_total", { status: "completed" });
  appMetrics.increment("gateway_ocr_duration_ms_sum", {}, Math.round(durationMs));

  await writeAuditLog({
    action: "ocr.completed",
    actorType: "service",
    actorId: "ocr-service",
    documentId,
    metadata: {
      confidence,
      extractedLength: extractedText.length,
      durationMs: Math.round(durationMs)
    }
  });

  return { documentId, extractedText, confidence };
}

function simulateOcrExtraction(fileContent: string): string {
  const lines = fileContent.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return "No readable content found.";
  return lines.join(" ").trim();
}

function generateMockExtractedText(documentId: string): string {
  const templates = [
    `Document ${documentId}: Full name: John Doe. Date of Birth: 1990-01-15. ID Number: ${randomUUID().slice(0, 10)}. Issued: 2020-03-01. Expiry: 2030-03-01.`,
    `Document ${documentId}: Company: Acme Corp. Registration: REG-${randomUUID().slice(0, 8)}. Jurisdiction: Singapore. Date: 2023-06-15. Directors: Jane Smith, Bob Chen.`,
    `Document ${documentId}: Account Holder: Global Partners Ltd. Bank: National Bank. Account: ${randomUUID().slice(0, 12)}. Balance verified on: 2024-01-01.`
  ];
  return templates[Math.floor(Math.random() * templates.length)]!;
}

function calculateConfidence(extractedText: string): number {
  const wordCount = extractedText.split(/\s+/).length;
  const hasNumbers = /\d/.test(extractedText);
  const hasDates = /\d{4}-\d{2}-\d{2}/.test(extractedText);

  let confidence = 0.5;
  if (wordCount > 10) confidence += 0.15;
  if (wordCount > 20) confidence += 0.1;
  if (hasNumbers) confidence += 0.1;
  if (hasDates) confidence += 0.1;
  if (extractedText.length > 100) confidence += 0.05;

  return Math.min(1, Math.round(confidence * 100) / 100);
}
