import type { EventEnvelope } from "@ai-platform/events";

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

const recordsByClient = new Map<string, CrmRecord>();

export function createCrmRecord(event: EventEnvelope<"client.created">): CrmRecord {
  const existing = recordsByClient.get(event.payload.clientId);
  if (existing) return existing;

  const record: CrmRecord = {
    crmId: `crm-${event.payload.clientId}`,
    clientId: event.payload.clientId,
    companyName: event.payload.companyName,
    plan: event.payload.plan,
    createdBy: event.payload.createdBy,
    createdAt: new Date().toISOString(),
    documents: []
  };

  recordsByClient.set(record.clientId, record);
  return record;
}

export function associateCrmDocument(
  event: EventEnvelope<"document.uploaded">
): CrmRecord | undefined {
  const record = recordsByClient.get(event.payload.clientId);
  if (!record) return undefined;

  if (!record.documents.some((document) => document.documentId === event.payload.documentId)) {
    record.documents.push({
      documentId: event.payload.documentId,
      fileName: event.payload.fileName,
      uploadedBy: event.payload.uploadedBy,
      associatedAt: new Date().toISOString()
    });
  }

  return record;
}

export function getCrmRecord(clientId: string): CrmRecord | undefined {
  return recordsByClient.get(clientId);
}
