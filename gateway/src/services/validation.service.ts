import { appMetrics } from "../observability/appMetrics";
import { writeAuditLog } from "./audit.service";

export interface ValidationResult {
  documentId: string;
  valid: boolean;
  score: number;
  issues: string;
}

export async function validateDocument(
  documentId: string,
  extractedText: string,
  confidence: number
): Promise<ValidationResult> {
  const issueList: string[] = [];
  let score = 100;

  const requiredFieldResult = validateRequiredFields(extractedText);
  if (!requiredFieldResult.valid) {
    score -= requiredFieldResult.penalty;
    issueList.push(...requiredFieldResult.issues);
  }

  const formatResult = validateDocumentFormat(extractedText);
  if (!formatResult.valid) {
    score -= formatResult.penalty;
    issueList.push(...formatResult.issues);
  }

  const confidenceResult = validateConfidenceThreshold(confidence);
  if (!confidenceResult.valid) {
    score -= confidenceResult.penalty;
    issueList.push(...confidenceResult.issues);
  }

  score = Math.max(0, Math.min(100, score));
  const valid = score >= 80 && issueList.length === 0;
  const issues = issueList.length > 0 ? issueList.join("; ") : "none";

  appMetrics.increment("gateway_validation_total", {
    status: valid ? "valid" : "invalid"
  });

  await writeAuditLog({
    action: "validation.completed",
    actorType: "service",
    actorId: "validation-service",
    documentId,
    metadata: { score, valid, issueCount: issueList.length, confidence }
  });

  return { documentId, valid, score, issues };
}

interface FieldValidation {
  valid: boolean;
  penalty: number;
  issues: string[];
}

function validateRequiredFields(extractedText: string): FieldValidation {
  const issues: string[] = [];
  let penalty = 0;

  const namePattern = /(?:Full name|Name|Company|Account Holder):\s*.+/i;
  if (!namePattern.test(extractedText)) {
    issues.push("Missing name or entity identifier");
    penalty += 15;
  }

  const idPattern = /(?:ID Number|Registration|Account):\s*.+/i;
  if (!idPattern.test(extractedText)) {
    issues.push("Missing identification number");
    penalty += 10;
  }

  const datePattern = /\d{4}-\d{2}-\d{2}/;
  if (!datePattern.test(extractedText)) {
    issues.push("Missing date fields");
    penalty += 10;
  }

  return { valid: issues.length === 0, penalty, issues };
}

function validateDocumentFormat(extractedText: string): FieldValidation {
  const issues: string[] = [];
  let penalty = 0;

  if (extractedText.length < 20) {
    issues.push("Document content too short");
    penalty += 20;
  }

  const wordCount = extractedText.split(/\s+/).length;
  if (wordCount < 5) {
    issues.push("Insufficient word count");
    penalty += 15;
  }

  return { valid: issues.length === 0, penalty, issues };
}

function validateConfidenceThreshold(confidence: number): FieldValidation {
  const issues: string[] = [];
  let penalty = 0;

  if (confidence < 0.6) {
    issues.push("OCR confidence below acceptable threshold (< 0.6)");
    penalty += 30;
  } else if (confidence < 0.75) {
    issues.push("OCR confidence marginal (< 0.75)");
    penalty += 10;
  }

  return { valid: issues.length === 0, penalty, issues };
}
