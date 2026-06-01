import type { EventEnvelope } from "@ai-platform/events";
import {
  updateClientOnboardingState,
  workflowStepOrder,
  type OnboardingStatus,
  type WorkflowStepKey
} from "./frontendMockData.service";

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

const statesByClient = new Map<string, OnboardingClientState>();

export function initializeOnboardingState(
  event: EventEnvelope<"client.created">
): OnboardingClientState {
  const existing = statesByClient.get(event.payload.clientId);
  if (existing) return existing;

  const timestamp = new Date().toISOString();
  const state: OnboardingClientState = {
    clientId: event.payload.clientId,
    status: "in_progress",
    progressPercent: 0,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedSteps: [],
    documents: []
  };

  statesByClient.set(state.clientId, state);
  updateClientOnboardingState(state.clientId, {
    status: state.status,
    progressPercent: state.progressPercent,
    updatedAt: state.updatedAt
  });

  return state;
}

export function updateOnboardingProgress(
  event: EventEnvelope<"document.uploaded">
): OnboardingClientState {
  const timestamp = new Date().toISOString();
  const stepKey = metadataStepKey(event.metadata?.stepKey);
  const state =
    statesByClient.get(event.payload.clientId) ??
    createInitialState(event.payload.clientId, timestamp);

  if (!state.documents.some((document) => document.documentId === event.payload.documentId)) {
    state.documents.push({
      documentId: event.payload.documentId,
      fileName: event.payload.fileName,
      stepKey,
      uploadedAt:
        typeof event.metadata?.uploadedAt === "string" ? event.metadata.uploadedAt : timestamp
    });
  }

  if (!state.completedSteps.includes(stepKey)) {
    state.completedSteps.push(stepKey);
  }

  state.progressPercent = Math.min(
    100,
    Math.round((state.completedSteps.length / workflowStepOrder.length) * 100)
  );
  state.status = state.progressPercent >= 100 ? "completed" : "in_progress";
  state.updatedAt = timestamp;

  statesByClient.set(state.clientId, state);
  updateClientOnboardingState(state.clientId, {
    status: state.status,
    progressPercent: state.progressPercent,
    updatedAt: state.updatedAt
  });

  return state;
}

export function getOnboardingState(clientId: string): OnboardingClientState | undefined {
  return statesByClient.get(clientId);
}

function createInitialState(clientId: string, timestamp: string): OnboardingClientState {
  const state: OnboardingClientState = {
    clientId,
    status: "in_progress",
    progressPercent: 0,
    startedAt: timestamp,
    updatedAt: timestamp,
    completedSteps: [],
    documents: []
  };
  statesByClient.set(clientId, state);
  return state;
}

function metadataStepKey(value: unknown): WorkflowStepKey {
  return workflowStepOrder.includes(value as WorkflowStepKey)
    ? (value as WorkflowStepKey)
    : "identity";
}
