import { randomUUID } from "crypto";
import type { EventEnvelope } from "@ai-platform/events";
import {
  updateClientOnboardingState,
  workflowStepOrder,
  type OnboardingStatus,
  type WorkflowStepKey
} from "./frontendMockData.service";
import { prisma } from "./database.service";
import { writeAuditLog } from "./audit.service";

export interface OnboardingClientState {
  clientId: string;
  status: OnboardingStatus;
  progressPercent: number;
  startedAt: string;
  updatedAt: string;
  completedSteps: WorkflowStepKey[];
  documents: OnboardingStateDocument[];
}

export interface OnboardingStateDocument {
  documentId: string;
  fileName: string;
  stepKey: WorkflowStepKey;
  uploadedAt: string;
}

export async function initializeOnboardingState(
  event: EventEnvelope<"client.created">
): Promise<OnboardingClientState> {
  await ensureClientFromCreatedEvent(event);
  const timestamp = new Date();
  const state = await prisma.onboardingProgress.upsert({
    where: { clientId: event.payload.clientId },
    create: {
      id: `onboarding-${event.payload.clientId}`,
      clientId: event.payload.clientId,
      status: "in_progress",
      progressPercent: 0,
      currentStep: "identity",
      startedAt: timestamp,
      updatedAt: timestamp
    },
    update: {},
    include: {
      completedSteps: true,
      client: { include: { documents: true } }
    }
  });

  await updateClientOnboardingState(event.payload.clientId, {
    status: state.status as OnboardingStatus,
    progressPercent: state.progressPercent,
    updatedAt: state.updatedAt.toISOString()
  });
  await writeAuditLog({
    action: "workflow.initialize",
    actorId: event.payload.createdBy,
    actorType: "service",
    clientId: event.payload.clientId,
    metadata: { eventId: event.id, status: state.status, progressPercent: state.progressPercent }
  });

  return toOnboardingClientState(state);
}

export async function updateOnboardingProgress(
  event: EventEnvelope<"document.uploaded">
): Promise<OnboardingClientState> {
  await ensureClientFromDocumentEvent(event);
  const timestamp = new Date();
  const stepKey = metadataStepKey(event.metadata?.stepKey);
  const state = await prisma.$transaction(async (tx: typeof prisma) => {
    const progress = await tx.onboardingProgress.upsert({
      where: { clientId: event.payload.clientId },
      create: {
        id: `onboarding-${event.payload.clientId}`,
        clientId: event.payload.clientId,
        status: "in_progress",
        progressPercent: 0,
        currentStep: "identity",
        startedAt: timestamp,
        updatedAt: timestamp
      },
      update: {}
    });

    await tx.onboardingCompletedStep.upsert({
      where: {
        progressId_stepKey: {
          progressId: progress.id,
          stepKey
        }
      },
      create: {
        id: `step-${randomUUID().slice(0, 8)}`,
        progressId: progress.id,
        stepKey,
        completedAt: timestamp
      },
      update: {}
    });

    const completedSteps = await tx.onboardingCompletedStep.findMany({
      where: { progressId: progress.id }
    });
    const progressPercent = Math.min(
      100,
      Math.round((completedSteps.length / workflowStepOrder.length) * 100)
    );
    const status: OnboardingStatus = progressPercent >= 100 ? "completed" : "in_progress";
    const currentStep = progressToCurrentStep(progressPercent, status);

    return tx.onboardingProgress.update({
      where: { id: progress.id },
      data: {
        status,
        progressPercent,
        currentStep,
        updatedAt: timestamp
      },
      include: {
        completedSteps: true,
        client: { include: { documents: true } }
      }
    });
  });

  await updateClientOnboardingState(event.payload.clientId, {
    status: state.status as OnboardingStatus,
    progressPercent: state.progressPercent,
    updatedAt: state.updatedAt.toISOString()
  });
  await writeAuditLog({
    action: "workflow.transition",
    actorId: event.payload.uploadedBy,
    actorType: "service",
    clientId: event.payload.clientId,
    documentId: event.payload.documentId,
    metadata: {
      eventId: event.id,
      stepKey,
      status: state.status,
      progressPercent: state.progressPercent
    }
  });

  return toOnboardingClientState(state);
}

export async function getOnboardingState(
  clientId: string
): Promise<OnboardingClientState | undefined> {
  const state = await prisma.onboardingProgress.findUnique({
    where: { clientId },
    include: {
      completedSteps: true,
      client: { include: { documents: true } }
    }
  });
  return state ? toOnboardingClientState(state) : undefined;
}

function toOnboardingClientState(state: {
  clientId: string;
  status: string;
  progressPercent: number;
  startedAt: Date;
  updatedAt: Date;
  completedSteps: Array<{ stepKey: string }>;
  client: {
    documents: Array<{
      id: string;
      fileName: string;
      stepKey: string;
      uploadedAt: Date;
    }>;
  };
}): OnboardingClientState {
  const completedStepSet = new Set(state.completedSteps.map((step) => step.stepKey));
  return {
    clientId: state.clientId,
    status: state.status as OnboardingStatus,
    progressPercent: state.progressPercent,
    startedAt: state.startedAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
    completedSteps: state.completedSteps.map((step) => step.stepKey as WorkflowStepKey),
    documents: state.client.documents
      .filter((document) => completedStepSet.has(document.stepKey))
      .map((document) => ({
        documentId: document.id,
        fileName: document.fileName,
        stepKey: document.stepKey as WorkflowStepKey,
        uploadedAt: document.uploadedAt.toISOString()
      }))
  };
}

function metadataStepKey(value: unknown): WorkflowStepKey {
  return workflowStepOrder.includes(value as WorkflowStepKey)
    ? (value as WorkflowStepKey)
    : "identity";
}

async function ensureClientFromCreatedEvent(event: EventEnvelope<"client.created">): Promise<void> {
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

async function ensureClientFromDocumentEvent(
  event: EventEnvelope<"document.uploaded">
): Promise<void> {
  await prisma.client.upsert({
    where: { id: event.payload.clientId },
    create: {
      id: event.payload.clientId,
      name: event.payload.clientId,
      contactPerson: "Unknown",
      contactEmail: "unknown@example.com",
      jurisdiction: "Unknown",
      serviceTier: "Professional",
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

function progressToCurrentStep(progressPercent: number, status: OnboardingStatus): WorkflowStepKey {
  if (status === "completed") return "review";
  if (progressPercent >= 80) return "review";
  if (progressPercent >= 60) return "compliance";
  if (progressPercent >= 40) return "financial_documents";
  if (progressPercent >= 20) return "company_documents";
  return "identity";
}
