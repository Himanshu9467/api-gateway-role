import type { AuthResponse, LoginRequest, RegisterRequest } from "../../types/auth";
import type { ChatMessage, ChatRequest, ChatResponse } from "../../types/chatbot";
import type {
  ActivityItem,
  ClientSummary,
  CreateClientRequest,
  DashboardSummary,
} from "../../types/dashboard";
import type {
  ClientDetail,
  OnboardingDocument,
  OnboardingProgress,
  UploadDocumentResponse,
  WorkflowStepKey,
} from "../../types/onboarding";

const now = new Date().toISOString();

const mockUser: AuthResponse = {
  token: "demo-token",
  user: { id: "u_demo_1", name: "Demo User", email: "demo@company.com" },
};

const mockClients: ClientSummary[] = [
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
    updatedAt: now,
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
    updatedAt: now,
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
    updatedAt: now,
  },
];

const mockActivity: ActivityItem[] = [
  {
    id: "act-1",
    title: "Document uploaded",
    description: "Acme Holdings uploaded passport verification.",
    createdAt: now,
    type: "upload",
  },
  {
    id: "act-2",
    title: "Workflow blocked",
    description: "BluePeak Capital is missing compliance declaration.",
    createdAt: now,
    type: "status_change",
  },
];

const mockProgressMap: Record<string, OnboardingProgress> = {
  "client-001": {
    clientId: "client-001",
    progressPercent: 48,
    currentStep: "financial_documents",
    overallStatus: "in_progress",
    steps: [
      { key: "identity", label: "Identity", description: "Verified", status: "completed" },
      {
        key: "company_documents",
        label: "Company Documents",
        description: "Validated",
        status: "completed",
      },
      {
        key: "financial_documents",
        label: "Financial Documents",
        description: "Pending required statements",
        status: "current",
      },
      { key: "compliance", label: "Compliance", description: "Pending", status: "pending" },
      { key: "review", label: "Review", description: "Pending", status: "pending" },
    ],
  },
};

const mockDocumentsByClient: Record<string, OnboardingDocument[]> = {
  "client-001": [
    {
      id: "doc-1",
      clientId: "client-001",
      stepKey: "identity",
      fileName: "passport.pdf",
      fileSize: 1200000,
      mimeType: "application/pdf",
      status: "uploaded",
      uploadedAt: now,
    },
  ],
};

const mockChatByClientStep: Record<string, ChatMessage[]> = {};
let mockClientSequence = 4;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildDashboardSummary = (): DashboardSummary => ({
  totalClients: mockClients.length,
  completedOnboarding: mockClients.filter((client) => client.status === "completed").length,
  inProgressOnboarding: mockClients.filter((client) => client.status === "in_progress").length,
  blockedOnboarding: mockClients.filter((client) => client.status === "blocked").length,
});

export const mockLogin = async (payload: LoginRequest) => {
  void payload;
  await wait(300);
  return mockUser;
};

export const mockRegister = async (payload: RegisterRequest) => {
  void payload;
  await wait(400);
  return {};
};

export const mockGetDashboardSummary = async () => {
  await wait(250);
  return buildDashboardSummary();
};

export const mockGetDashboardClients = async () => {
  await wait(250);
  return mockClients;
};

export const mockGetDashboardActivity = async () => {
  await wait(250);
  return mockActivity;
};

export const mockGetClientDetail = async (clientId: string): Promise<ClientDetail> => {
  await wait(250);
  const client = mockClients.find((item) => item.id === clientId) || mockClients[0];
  return {
    id: client.id,
    name: client.name,
    contactPerson: client.contactPerson,
    contactEmail: client.contactEmail,
    jurisdiction: client.jurisdiction,
    serviceTier: client.serviceTier,
    clientType: client.clientType,
    status: client.status,
    progressPercent: client.progressPercent,
  };
};

export const mockGetOnboardingProgress = async (clientId: string): Promise<OnboardingProgress> => {
  await wait(250);
  return mockProgressMap[clientId] || mockProgressMap["client-001"];
};

export const mockGetOnboardingDocuments = async (
  clientId: string,
  stepKey: WorkflowStepKey,
): Promise<OnboardingDocument[]> => {
  await wait(200);
  const docs = mockDocumentsByClient[clientId] || [];
  return docs.filter((doc) => doc.stepKey === stepKey);
};

export const mockUploadOnboardingDocument = async (
  clientId: string,
  stepKey: WorkflowStepKey,
  file: File,
  onProgress?: (progressPercent: number) => void,
): Promise<UploadDocumentResponse> => {
  for (const progress of [10, 30, 60, 85, 100]) {
    onProgress?.(progress);
    await wait(120);
  }

  const uploadedDoc: OnboardingDocument = {
    id: `doc-${Math.random().toString(36).slice(2, 8)}`,
    clientId,
    stepKey,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    status: "uploaded",
    uploadedAt: new Date().toISOString(),
  };

  mockDocumentsByClient[clientId] = [...(mockDocumentsByClient[clientId] || []), uploadedDoc];
  return { document: uploadedDoc };
};

export const mockCreateClient = async (payload: CreateClientRequest): Promise<ClientSummary> => {
  await wait(350);

  const clientId = `client-${String(mockClientSequence).padStart(3, "0")}`;
  mockClientSequence += 1;

  const createdClient: ClientSummary = {
    id: clientId,
    name: payload.companyName,
    contactPerson: payload.contactPerson,
    contactEmail: payload.email,
    jurisdiction: payload.jurisdiction,
    serviceTier: payload.serviceTier,
    clientType: payload.clientType,
    status: "pending",
    progressPercent: 0,
    updatedAt: new Date().toISOString(),
  };

  mockClients.unshift(createdClient);
  mockProgressMap[clientId] = {
    clientId,
    progressPercent: 0,
    currentStep: "identity",
    overallStatus: "pending",
    steps: [
      { key: "identity", label: "Identity", description: "Pending", status: "current" },
      {
        key: "company_documents",
        label: "Company Documents",
        description: "Pending",
        status: "pending",
      },
      {
        key: "financial_documents",
        label: "Financial Documents",
        description: "Pending",
        status: "pending",
      },
      { key: "compliance", label: "Compliance", description: "Pending", status: "pending" },
      { key: "review", label: "Review", description: "Pending", status: "pending" },
    ],
  };

  return createdClient;
};

export const mockGetChatMessages = async (clientId: string, stepKey: string): Promise<ChatMessage[]> => {
  await wait(150);
  const key = `${clientId}:${stepKey}`;
  return mockChatByClientStep[key] || [];
};

export const mockSendChatMessage = async (payload: ChatRequest): Promise<ChatResponse> => {
  const key = `${payload.clientId}:${payload.stepKey}`;
  const existing = mockChatByClientStep[key] || [];

  const userMessage: ChatMessage = {
    id: `m-user-${Date.now()}`,
    role: "user",
    content: payload.message,
    createdAt: new Date().toISOString(),
  };

  const assistantMessage: ChatMessage = {
    id: `m-ai-${Date.now() + 1}`,
    role: "assistant",
    content:
      "Please upload the required documents listed in this step. If a file was rejected, check file format and expiration details.",
    createdAt: new Date().toISOString(),
  };

  mockChatByClientStep[key] = [...existing, userMessage, assistantMessage];
  await wait(350);

  return {
    message: assistantMessage,
    suggestions: [
      "What should I upload next?",
      "Can you summarize missing documents?",
      "Why is this step blocked?",
    ],
  };
};
