import api from "../../api/axios";
import type {
  ClientDetail,
  OnboardingDocument,
  OnboardingProgress,
  UploadDocumentResponse,
} from "../../types/onboarding";
import type { WorkflowStepKey } from "../../types/onboarding";
import { shouldUseMockApi } from "../apiMode";
import {
  mockGetClientDetail,
  mockGetOnboardingDocuments,
  mockGetOnboardingProgress,
  mockUploadOnboardingDocument,
} from "../mock/mockApi";

export const getClientDetail = async (clientId: string) => {
  try {
    const response = await api.get<ClientDetail>(`/api/clients/${clientId}`);
    return response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) return mockGetClientDetail(clientId);
    throw error;
  }
};

export const getOnboardingProgress = async (clientId: string) => {
  try {
    const response = await api.get<OnboardingProgress>(`/api/onboarding/${clientId}/progress`);
    return response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) return mockGetOnboardingProgress(clientId);
    throw error;
  }
};

export const getOnboardingDocuments = async (clientId: string, stepKey: WorkflowStepKey) => {
  try {
    const response = await api.get<OnboardingDocument[]>(
      `/api/onboarding/${clientId}/documents`,
      { params: { step: stepKey } },
    );
    return response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) return mockGetOnboardingDocuments(clientId, stepKey);
    throw error;
  }
};

export const uploadOnboardingDocument = async (
  clientId: string,
  stepKey: WorkflowStepKey,
  file: File,
  onProgress?: (progressPercent: number) => void,
) => {
  if (shouldUseMockApi()) {
    return mockUploadOnboardingDocument(clientId, stepKey, file, onProgress);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("stepKey", stepKey);

  try {
    const response = await api.post<UploadDocumentResponse>(
      `/api/onboarding/${clientId}/documents/upload`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          const progressPercent = Math.round((event.loaded * 100) / event.total);
          onProgress?.(progressPercent);
        },
      },
    );

    return response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) {
      return mockUploadOnboardingDocument(clientId, stepKey, file, onProgress);
    }
    throw error;
  }
};
