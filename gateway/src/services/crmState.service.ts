import { randomUUID } from "crypto";
import type { EventEnvelope } from "@ai-platform/events";
import { prisma } from "./database.service";

export interface CrmRecord {
  crmId: string;
  clientId: string;
  companyName: string;
  plan: string;
  createdBy: string;
  createdAt: string;
  documents: CrmDocumentAssociation[];
}

export interface CrmDocumentAssociation {
  documentId: string;
  fileName: string;
  uploadedBy: string;
  associatedAt: string;
}

export async function createCrmRecord(
  event: EventEnvelope<"client.created">
): Promise<CrmRecord> {
  await ensureEventClient(event);
  const record = await prisma.cRMRecord.upsert({
    where: { clientId: event.payload.clientId },
    create: {
      crmId: `crm-${event.payload.clientId}`,
      clientId: event.payload.clientId,
      companyName: event.payload.companyName,
      plan: event.payload.plan,
      createdBy: event.payload.createdBy,
      createdAt: new Date()
    },
    update: {},
    include: { documents: true }
  });

  return toCrmRecord(record);
}

async function ensureEventClient(event: EventEnvelope<"client.created">): Promise<void> {
  await prisma.client.upsert({
    where: { id: event.payload.clientId },
    create: {
      id: event.payload.clientId,
      name: event.payload.companyName,
      contactPerson: "Unknown",
      contactEmail: "unknown@example.com",
      jurisdiction: "Unknown",
      serviceTier: planToServiceTier(event.payload.plan),
      clientType: "Corporate",
      status: "pending",
      progressPercent: 0,
      updatedAt: new Date()
    },
    update: {}
  });
}

function planToServiceTier(plan: string): string {
  if (plan === "starter") return "Starter";
  if (plan === "enterprise") return "Enterprise";
  return "Professional";
}

export async function associateCrmDocument(
  event: EventEnvelope<"document.uploaded">
): Promise<CrmRecord | undefined> {
  const record = await prisma.cRMRecord.findUnique({
    where: { clientId: event.payload.clientId }
  });
  if (!record) return undefined;

  await prisma.cRMDocumentAssociation.upsert({
    where: {
      crmId_documentId: {
        crmId: record.crmId,
        documentId: event.payload.documentId
      }
    },
    create: {
      id: `crm-doc-${randomUUID().slice(0, 8)}`,
      crmId: record.crmId,
      documentId: event.payload.documentId,
      fileName: event.payload.fileName,
      uploadedBy: event.payload.uploadedBy,
      associatedAt: new Date()
    },
    update: {
      fileName: event.payload.fileName,
      uploadedBy: event.payload.uploadedBy
    }
  });

  return getCrmRecord(event.payload.clientId);
}

export async function getCrmRecord(clientId: string): Promise<CrmRecord | undefined> {
  const record = await prisma.cRMRecord.findUnique({
    where: { clientId },
    include: { documents: true }
  });
  return record ? toCrmRecord(record) : undefined;
}

export async function syncCrmRecord(
  customerId: string
): Promise<{ customerId: string; crmReference: string }> {
  const crmReference = `crm-ref-${customerId}-${Date.now()}`;

  const existing = await prisma.cRMRecord.findUnique({
    where: { clientId: customerId }
  });

  if (existing) {
    await prisma.cRMRecord.update({
      where: { crmId: existing.crmId },
      data: { plan: existing.plan }
    });
  }

  return { customerId, crmReference };
}

function toCrmRecord(record: {
  crmId: string;
  clientId: string;
  companyName: string;
  plan: string;
  createdBy: string;
  createdAt: Date;
  documents: Array<{
    documentId: string;
    fileName: string;
    uploadedBy: string;
    associatedAt: Date;
  }>;
}): CrmRecord {
  return {
    crmId: record.crmId,
    clientId: record.clientId,
    companyName: record.companyName,
    plan: record.plan,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    documents: record.documents.map((document) => ({
      documentId: document.documentId,
      fileName: document.fileName,
      uploadedBy: document.uploadedBy,
      associatedAt: document.associatedAt.toISOString()
    }))
  };
}
