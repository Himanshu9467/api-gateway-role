import { create } from "zustand";
import type { UploadProgressState } from "../types/onboarding";
import type { WorkflowStepKey } from "../types/onboarding";

interface OnboardingStoreState {
  selectedClientId: string | null;
  activeStep: WorkflowStepKey | null;
  uploadProgress: UploadProgressState | null;
  validationError: string | null;
  setSelectedClient: (clientId: string | null) => void;
  setActiveStep: (step: WorkflowStepKey | null) => void;
  setUploadProgress: (progress: UploadProgressState) => void;
  clearUploadProgress: () => void;
  setValidationError: (message: string | null) => void;
}

export const useOnboardingStore = create<OnboardingStoreState>((set) => ({
  selectedClientId: null,
  activeStep: null,
  uploadProgress: null,
  validationError: null,
  setSelectedClient: (clientId) => set({ selectedClientId: clientId }),
  setActiveStep: (step) => set({ activeStep: step }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  clearUploadProgress: () => set({ uploadProgress: null }),
  setValidationError: (message) => set({ validationError: message }),
}));
