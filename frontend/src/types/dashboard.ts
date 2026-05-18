export type OnboardingStatus = "pending" | "in_progress" | "blocked" | "completed";
export type ServiceTier = "Starter" | "Professional" | "Enterprise";
export type ClientType = "Corporate" | "SME" | "Startup" | "Individual";

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

export interface CreateClientRequest {
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
