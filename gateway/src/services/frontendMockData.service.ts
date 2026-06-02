import { randomUUID } from "crypto";
import { appMetrics } from "../observability/appMetrics";
import { prisma } from "./database.service";
import { getStorageProvider } from "./storage";

export type OnboardingStatus = "pending" | "in_progress" | "blocked" | "completed";
export type ServiceTier = "Starter" | "Professional" | "Enterprise";
export type ClientType = "Corporate" | "SME" | "Startup" | "Individual";
export type WorkflowStepKey =
  | "identity"
  | "company_documents"
  | "financial_documents"
  | "compliance"
  | "review";

export interface DashboardSummary {
  totalClients: number;
  completedOnboarding: number;
  inProgressOnboarding: number;
  blockedOnboarding: number;
}

export interface ClientSummary {
  id: string;
  name: string;
  contactPerson: string;
  contactEmail: string;
  jurisdiction: string;
  serviceTier: ServiceTier;
  clientType: ClientType;
  status: OnboardingStatus;
  progressPercent: number;
  updatedAt: string;
}

export interface CreateClientInput {
  companyName: string;
  contactPerson: string;
  email: string;
  jurisdiction: string;
  serviceTier: ServiceTier;
  clientType: ClientType;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  type: "upload" | "status_change" | "ai_suggestion" | "note";
}

export interface WorkflowStep {
  key: WorkflowStepKey;
  label: string;
  description: string;
  status: "pending" | "current" | "completed" | "blocked";
}

export interface OnboardingProgress {
  clientId: string;
  progressPercent: number;
  currentStep: WorkflowStepKey;
  overallStatus: OnboardingStatus;
  steps: WorkflowStep[];
}

export interface OnboardingDocument {
  id: string;
  clientId: string;
  stepKey: WorkflowStepKey;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: "uploading" | "uploaded" | "rejected";
  uploadedAt: string;
  rejectionReason?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [totalClients, completedOnboarding, inProgressOnboarding, blockedOnboarding] =
    await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { status: "completed" } }),
      prisma.client.count({ where: { status: "in_progress" } }),
      prisma.client.count({ where: { status: "blocked" } })
    ]);

  return {
    totalClients,
    completedOnboarding,
    inProgressOnboarding,
    blockedOnboarding
  };
}

export async function listClients(): Promise<ClientSummary[]> {
  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" }
  });
  return clients.map(toClientSummary);
}

export async function listActivity(): Promise<ActivityItem[]> {
  const activities = await prisma.activity.findMany({
    orderBy: { createdAt: "desc" }
  });
  return activities.map((activity: {
    id: string;
    title: string;
    description: string;
    createdAt: Date;
    type: string;
  }) => ({
    id: activity.id,
    title: activity.title,
    description: activity.description,
    createdAt: activity.createdAt.toISOString(),
    type: activity.type as ActivityItem["type"]
  }));
}

export async function getClient(clientId: string): Promise<ClientSummary | undefined> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  return client ? toClientSummary(client) : undefined;
}

export async function updateClientOnboardingState(
  clientId: string,
  updates: {
    status?: OnboardingStatus;
    progressPercent?: number;
    updatedAt?: string;
  }
): Promise<ClientSummary | undefined> {
  const existing = await prisma.client.findUnique({ where: { id: clientId } });
  if (!existing) return undefined;

  const client = await prisma.client.update({
    where: { id: clientId },
    data: {
      status: updates.status ?? existing.status,
      progressPercent: updates.progressPercent ?? existing.progressPercent,
      updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : new Date()
    }
  });

  return toClientSummary(client);
}

export async function createClient(input: CreateClientInput): Promise<ClientSummary> {
  const timestamp = new Date();
  const client = await prisma.client.create({
    data: {
      id: `client-${randomUUID().slice(0, 8)}`,
      name: input.companyName,
      contactPerson: input.contactPerson,
      contactEmail: input.email,
      jurisdiction: input.jurisdiction,
      serviceTier: input.serviceTier,
      clientType: input.clientType,
      status: "pending",
      progressPercent: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      activities: {
        create: {
          id: `act-${randomUUID().slice(0, 8)}`,
          title: "Client created",
          description: `${input.companyName} was added to onboarding.`,
          createdAt: timestamp,
          type: "note"
        }
      }
    }
  });

  return toClientSummary(client);
}

export async function getOnboardingProgress(
  clientId: string
): Promise<OnboardingProgress | undefined> {
  const client = await getClient(clientId);
  if (!client) return undefined;

  const currentStep = progressToCurrentStep(client.progressPercent, client.status);
  const currentStepIndex = workflowStepOrder.indexOf(currentStep);

  return {
    clientId,
    progressPercent: client.progressPercent,
    currentStep,
    overallStatus: client.status,
    steps: workflowStepOrder.map((key, index) => ({
      key,
      label: workflowStepLabels[key],
      description: workflowStepDescriptions[key],
      status:
        client.status === "blocked" && key === currentStep
          ? "blocked"
          : index < currentStepIndex || client.status === "completed"
            ? "completed"
            : index === currentStepIndex
              ? "current"
              : "pending"
    }))
  };
}

export async function listDocuments(
  clientId: string,
  stepKey?: WorkflowStepKey
): Promise<OnboardingDocument[]> {
  const documents = await prisma.document.findMany({
    where: {
      clientId,
      ...(stepKey ? { stepKey } : {})
    },
    orderBy: { uploadedAt: "desc" }
  });
  return documents.map(toOnboardingDocument);
}

export async function addDocument(
  clientId: string,
  stepKey: WorkflowStepKey,
  fileName = "uploaded-document.pdf",
  file?: { buffer: Buffer; mimeType: string; size: number }
): Promise<OnboardingDocument> {
  const timestamp = new Date();
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  const documentId = `doc-${randomUUID().slice(0, 8)}`;
  const mimeType = file?.mimeType ?? mimeTypeForFile(fileName);
  const bytes = file?.buffer ?? Buffer.alloc(0);
  const stored = await getStorageProvider().storeDocument({
    clientId,
    documentId,
    fileName,
    mimeType,
    bytes,
    metadata: { stepKey }
  });
  appMetrics.increment("gateway_storage_uploads_total", {
    provider: stored.provider,
    status: "success"
  });
  const document = await prisma.document.create({
    data: {
      id: documentId,
      clientId,
      stepKey,
      fileName,
      fileSize: stored.size,
      mimeType: stored.contentType,
      storageProvider: stored.provider,
      storagePath: stored.path,
      documentUrl: stored.url,
      bucket: stored.bucket,
      storageKey: stored.key,
      checksum: stored.checksum,
      storageMetadata: JSON.stringify(stored.metadata),
      status: "uploaded",
      uploadedAt: timestamp
    }
  });

  await prisma.activity.create({
    data: {
      id: `act-${randomUUID().slice(0, 8)}`,
      clientId,
      title: "Document uploaded",
      description: `${client?.name ?? clientId} uploaded ${fileName}.`,
      createdAt: timestamp,
      type: "upload"
    }
  });

  return toOnboardingDocument(document);
}

export async function getDocumentDownload(
  clientId: string,
  documentId: string,
  expiresInSeconds: number
): Promise<{ url: string; document: OnboardingDocument } | undefined> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, clientId }
  });
  if (!document) return undefined;
  const provider = getStorageProvider();
  const url =
    (await provider.getDownloadUrl?.({
      bucket: document.bucket,
      key: document.storageKey ?? document.storagePath,
      path: document.storagePath,
      expiresInSeconds
    })) ?? document.documentUrl;
  return { url, document: toOnboardingDocument(document) };
}

export async function listChatMessages(
  clientId: string,
  stepKey: string
): Promise<ChatMessage[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { clientId, stepKey },
    orderBy: { createdAt: "asc" }
  });
  return messages.map(toChatMessage);
}

export async function addChatExchange(
  clientId: string,
  stepKey: string,
  content: string
): Promise<ChatMessage> {
  const timestamp = new Date();
  const assistantTimestamp = new Date(timestamp.getTime() + 1);
  const assistantMessage = await prisma.$transaction(async (tx: typeof prisma) => {
    await tx.chatMessage.create({
      data: {
        id: `m-user-${randomUUID().slice(0, 8)}`,
        clientId,
        stepKey,
        role: "user",
        content,
        createdAt: timestamp
      }
    });

    return tx.chatMessage.create({
      data: {
        id: `m-ai-${randomUUID().slice(0, 8)}`,
        clientId,
        stepKey,
        role: "assistant",
        content:
          "Please upload the required documents listed in this step. If a file was rejected, check file format and expiration details.",
        createdAt: assistantTimestamp
      }
    });
  });

  return toChatMessage(assistantMessage);
}

export const workflowStepOrder: WorkflowStepKey[] = [
  "identity",
  "company_documents",
  "financial_documents",
  "compliance",
  "review"
];

function toClientSummary(client: {
  id: string;
  name: string;
  contactPerson: string;
  contactEmail: string;
  jurisdiction: string;
  serviceTier: string;
  clientType: string;
  status: string;
  progressPercent: number;
  updatedAt: Date;
}): ClientSummary {
  return {
    id: client.id,
    name: client.name,
    contactPerson: client.contactPerson,
    contactEmail: client.contactEmail,
    jurisdiction: client.jurisdiction,
    serviceTier: client.serviceTier as ServiceTier,
    clientType: client.clientType as ClientType,
    status: client.status as OnboardingStatus,
    progressPercent: client.progressPercent,
    updatedAt: client.updatedAt.toISOString()
  };
}

function toOnboardingDocument(document: {
  id: string;
  clientId: string;
  stepKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: string;
  uploadedAt: Date;
  rejectionReason: string | null;
}): OnboardingDocument {
  return {
    id: document.id,
    clientId: document.clientId,
    stepKey: document.stepKey as WorkflowStepKey,
    fileName: document.fileName,
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    status: document.status as OnboardingDocument["status"],
    uploadedAt: document.uploadedAt.toISOString(),
    rejectionReason: document.rejectionReason ?? undefined
  };
}

function toChatMessage(message: {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}): ChatMessage {
  return {
    id: message.id,
    role: message.role as ChatMessage["role"],
    content: message.content,
    createdAt: message.createdAt.toISOString()
  };
}

function mimeTypeForFile(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function progressToCurrentStep(progressPercent: number, status: OnboardingStatus): WorkflowStepKey {
  if (status === "completed") return "review";
  if (progressPercent >= 80) return "review";
  if (progressPercent >= 60) return "compliance";
  if (progressPercent >= 40) return "financial_documents";
  if (progressPercent >= 20) return "company_documents";
  return "identity";
}

const workflowStepLabels: Record<WorkflowStepKey, string> = {
  identity: "Identity",
  company_documents: "Company Documents",
  financial_documents: "Financial Documents",
  compliance: "Compliance",
  review: "Review"
};

const workflowStepDescriptions: Record<WorkflowStepKey, string> = {
  identity: "Verify primary identity documents",
  company_documents: "Collect incorporation and ownership records",
  financial_documents: "Review bank and financial statements",
  compliance: "Complete compliance declarations",
  review: "Final onboarding review"
};
