import type { ClientType, OnboardingStatus, ServiceTier } from "./dashboard";

export type WorkflowStepKey =
  | "identity"
  | "company_documents"
  | "financial_documents"
  | "compliance"
  | "review";

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

export interface ClientDetail {
  id: string;
  name: string;
  contactPerson: string;
  contactEmail: string;
  jurisdiction: string;
  serviceTier: ServiceTier;
  clientType: ClientType;
  status: OnboardingStatus;
  progressPercent: number;
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

export interface UploadDocumentResponse {
  document: OnboardingDocument;
}

export interface UploadProgressState {
  progressPercent: number;
  fileName: string;
}
