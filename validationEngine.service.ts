import { prisma } from "./database.service";

export type ValidationRule =
  | "name_match"
  | "dob_match"
  | "address_match"
  | "document_expiry"
  | "recency_check"
  | "duplicate_detection";

export type ValidationStatus = "passed" | "failed" | "needs_review";

export interface ValidationCheck {
  rule: ValidationRule;
  status: ValidationStatus;
  severity: "info" | "warning" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationEngineInput {
  client: {
    id: string;
    name: string;
    contactPerson: string;
  };
  document: {
    id: string;
    clientId: string;
    stepKey: string;
    checksum: string;
    uploadedAt: Date;
  };
  fields: Record<string, string>;
  ocrResultId: string;
}

export async function validateDocument(input: ValidationEngineInput): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [
    validateName(input.client, input.fields),
    validateDob(input.fields),
    validateAddress(input.fields),
    validateExpiry(input.fields),
    validateRecency(input.document, input.fields),
    await validateDuplicate(input.document)
  ];

  await prisma.validationResult.deleteMany({ where: { documentId: input.document.id } });
  await prisma.validationResult.createMany({
    data: checks.map((check) => ({
      id: `val-${cryptoRandom()}`,
      documentId: input.document.id,
      clientId: input.document.clientId,
      ocrResultId: input.ocrResultId,
      rule: check.rule,
      status: check.status,
      severity: check.severity,
      message: check.message,
      metadata: JSON.stringify(check.metadata ?? {})
    }))
  });

  return checks;
}

export function needsHumanReview(checks: ValidationCheck[], ocrConfidence: number): boolean {
  return ocrConfidence < 0.7 || checks.some((check) => check.status !== "passed");
}

function validateName(
  client: { name: string; contactPerson: string },
  fields: Record<string, string>
): ValidationCheck {
  const extractedName = fields.name;
  if (!extractedName) {
    return needsReview("name_match", "Name was not extracted from the document");
  }
  const expected = normalizeName(client.contactPerson) || normalizeName(client.name);
  const actual = normalizeName(extractedName);
  const matched = expected && (actual.includes(expected) || expected.includes(actual));
  return matched
    ? passed("name_match", "Extracted name matches client record")
    : failed("name_match", "Extracted name does not match client record", {
        expected: client.contactPerson || client.name,
        actual: extractedName
      });
}

function validateDob(fields: Record<string, string>): ValidationCheck {
  if (!fields.dob) return needsReview("dob_match", "DOB was not extracted from the document");
  return parseDate(fields.dob)
    ? passed("dob_match", "DOB is present and parseable")
    : failed("dob_match", "DOB could not be parsed", { value: fields.dob });
}

function validateAddress(fields: Record<string, string>): ValidationCheck {
  const address = fields.address;
  if (!address) return needsReview("address_match", "Address was not extracted from the document");
  return address.replace(/\W/g, "").length >= 10
    ? passed("address_match", "Address is present")
    : failed("address_match", "Address is too short to verify", { value: address });
}

function validateExpiry(fields: Record<string, string>): ValidationCheck {
  const expiry = fields.documentExpiry;
  if (!expiry) return needsReview("document_expiry", "Document expiry date was not extracted");
  const expiryDate = parseDate(expiry);
  if (!expiryDate) return failed("document_expiry", "Document expiry date could not be parsed", { value: expiry });
  return expiryDate > new Date()
    ? passed("document_expiry", "Document is not expired")
    : failed("document_expiry", "Document is expired", { expiry });
}

function validateRecency(document: { uploadedAt: Date }, fields: Record<string, string>): ValidationCheck {
  const issuedAt = fields.issuedAt ? parseDate(fields.issuedAt) : undefined;
  const reference = issuedAt ?? document.uploadedAt;
  const ageDays = Math.floor((Date.now() - reference.getTime()) / 86400000);
  return ageDays <= 365
    ? passed("recency_check", "Document satisfies recency requirements", { ageDays })
    : failed("recency_check", "Document is older than the recency threshold", { ageDays });
}

async function validateDuplicate(document: { id: string; checksum: string }): Promise<ValidationCheck> {
  if (!document.checksum) return needsReview("duplicate_detection", "Document checksum is unavailable");
  const duplicate = await prisma.document.findFirst({
    where: {
      checksum: document.checksum,
      id: { not: document.id }
    }
  });
  return duplicate
    ? failed("duplicate_detection", "Duplicate document checksum detected", { duplicateDocumentId: duplicate.id })
    : passed("duplicate_detection", "No duplicate checksum detected");
}

function passed(rule: ValidationRule, message: string, metadata?: Record<string, unknown>): ValidationCheck {
  return { rule, status: "passed", severity: "info", message, metadata };
}

function failed(rule: ValidationRule, message: string, metadata?: Record<string, unknown>): ValidationCheck {
  return { rule, status: "failed", severity: "critical", message, metadata };
}

function needsReview(rule: ValidationRule, message: string): ValidationCheck {
  return { rule, status: "needs_review", severity: "warning", message };
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseDate(value: string): Date | undefined {
  const parts = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!parts) return undefined;
  const year = Number(parts[3].length === 2 ? `20${parts[3]}` : parts[3]);
  const date = new Date(Date.UTC(year, Number(parts[2]) - 1, Number(parts[1])));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function cryptoRandom(): string {
  return require("crypto").randomUUID();
}
