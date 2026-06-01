import { randomUUID } from "crypto";

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

const now = () => new Date().toISOString();

const clients: ClientSummary[] = [
  {
    id: "client-001",
    name: "Acme Holdings",
    contactPerson: "Anita Rao",
    contactEmail: "anita.rao@acmeholdings.com",
    jurisdiction: "Singapore",
    serviceTier: "Enterprise",
    clientType: "Corporate",
    status: "in_progress",
    progressPercent: 48,
    updatedAt: now()
  },
  {
    id: "client-002",
    name: "BluePeak Capital",
    contactPerson: "Omar Khan",
    contactEmail: "omar.khan@bluepeakcapital.com",
    jurisdiction: "UAE",
    serviceTier: "Professional",
    clientType: "SME",
    status: "blocked",
    progressPercent: 62,
    updatedAt: now()
  },
  {
    id: "client-003",
    name: "Nexa Labs",
    contactPerson: "Priya Menon",
    contactEmail: "priya.menon@nexalabs.com",
    jurisdiction: "India",
    serviceTier: "Starter",
    clientType: "Startup",
    status: "completed",
    progressPercent: 100,
    updatedAt: now()
  }
];

const activities: ActivityItem[] = [
  {
    id: "act-1",
    title: "Document uploaded",
    description: "Acme Holdings uploaded passport verification.",
    createdAt: now(),
    type: "upload"
  },
  {
    id: "act-2",
    title: "Workflow blocked",
    description: "BluePeak Capital is missing compliance declaration.",
    createdAt: now(),
    type: "status_change"
  }
];

const documentsByClient = new Map<string, OnboardingDocument[]>([
  [
    "client-001",
    [
      {
        id: "doc-1",
        clientId: "client-001",
        stepKey: "identity",
        fileName: "passport.pdf",
        fileSize: 1_200_000,
        mimeType: "application/pdf",
        status: "uploaded",
        uploadedAt: now()
      }
    ]
  ]
]);

const chatByClientStep = new Map<string, ChatMessage[]>();

export function getDashboardSummary(): DashboardSummary {
  return {
    totalClients: clients.length,
    completedOnboarding: clients.filter((client) => client.status === "completed").length,
    inProgressOnboarding: clients.filter((client) => client.status === "in_progress").length,
    blockedOnboarding: clients.filter((client) => client.status === "blocked").length
  };
}

export function listClients(): ClientSummary[] {
  return clients;
}

export function listActivity(): ActivityItem[] {
  return activities;
}

export function getClient(clientId: string): ClientSummary | undefined {
  return clients.find((client) => client.id === clientId);
}

export function updateClientOnboardingState(
  clientId: string,
  updates: {
    status?: OnboardingStatus;
    progressPercent?: number;
    updatedAt?: string;
  }
): ClientSummary | undefined {
  const client = getClient(clientId);
  if (!client) return undefined;

  client.status = updates.status ?? client.status;
  client.progressPercent = updates.progressPercent ?? client.progressPercent;
  client.updatedAt = updates.updatedAt ?? now();

  return client;
}

export function createClient(input: CreateClientInput): ClientSummary {
  const client: ClientSummary = {
    id: `client-${randomUUID().slice(0, 8)}`,
    name: input.companyName,
    contactPerson: input.contactPerson,
    contactEmail: input.email,
    jurisdiction: input.jurisdiction,
    serviceTier: input.serviceTier,
    clientType: input.clientType,
    status: "pending",
    progressPercent: 0,
    updatedAt: now()
  };

  clients.unshift(client);
  activities.unshift({
    id: `act-${randomUUID().slice(0, 8)}`,
    title: "Client created",
    description: `${client.name} was added to onboarding.`,
    createdAt: client.updatedAt,
    type: "note"
  });

  return client;
}

export function getOnboardingProgress(clientId: string): OnboardingProgress | undefined {
  const client = getClient(clientId);
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

export function listDocuments(clientId: string, stepKey?: WorkflowStepKey): OnboardingDocument[] {
  const documents = documentsByClient.get(clientId) ?? [];
  if (!stepKey) return documents;
  return documents.filter((document) => document.stepKey === stepKey);
}

export function addDocument(
  clientId: string,
  stepKey: WorkflowStepKey,
  fileName = "uploaded-document.pdf"
): OnboardingDocument {
  const document: OnboardingDocument = {
    id: `doc-${randomUUID().slice(0, 8)}`,
    clientId,
    stepKey,
    fileName,
    fileSize: 0,
    mimeType: "application/octet-stream",
    status: "uploaded",
    uploadedAt: now()
  };

  documentsByClient.set(clientId, [...(documentsByClient.get(clientId) ?? []), document]);
  activities.unshift({
    id: `act-${randomUUID().slice(0, 8)}`,
    title: "Document uploaded",
    description: `${getClient(clientId)?.name ?? clientId} uploaded ${fileName}.`,
    createdAt: document.uploadedAt,
    type: "upload"
  });

  return document;
}

export function listChatMessages(clientId: string, stepKey: string): ChatMessage[] {
  return chatByClientStep.get(chatKey(clientId, stepKey)) ?? [];
}

export function addChatExchange(clientId: string, stepKey: string, content: string): ChatMessage {
  const key = chatKey(clientId, stepKey);
  const existing = chatByClientStep.get(key) ?? [];
  const userMessage: ChatMessage = {
    id: `m-user-${randomUUID().slice(0, 8)}`,
    role: "user",
    content,
    createdAt: now()
  };
  const assistantMessage: ChatMessage = {
    id: `m-ai-${randomUUID().slice(0, 8)}`,
    role: "assistant",
    content:
      "Please upload the required documents listed in this step. If a file was rejected, check file format and expiration details.",
    createdAt: now()
  };

  chatByClientStep.set(key, [...existing, userMessage, assistantMessage]);
  return assistantMessage;
}

export const workflowStepOrder: WorkflowStepKey[] = [
  "identity",
  "company_documents",
  "financial_documents",
  "compliance",
  "review"
];

function progressToCurrentStep(progressPercent: number, status: OnboardingStatus): WorkflowStepKey {
  if (status === "completed") return "review";
  if (progressPercent >= 80) return "review";
  if (progressPercent >= 60) return "compliance";
  if (progressPercent >= 40) return "financial_documents";
  if (progressPercent >= 20) return "company_documents";
  return "identity";
}

function chatKey(clientId: string, stepKey: string): string {
  return `${clientId}:${stepKey}`;
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
