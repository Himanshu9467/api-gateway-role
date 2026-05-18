import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClientDetail,
  getOnboardingDocuments,
  getOnboardingProgress,
  uploadOnboardingDocument,
} from "../../../services/onboarding/onboarding.api";
import type { WorkflowStepKey } from "../../../types/onboarding";
import { useOnboardingStore } from "../../../store/onboarding.store";

export const useClientDetailQuery = (clientId: string) =>
  useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientDetail(clientId),
    enabled: Boolean(clientId),
  });

export const useOnboardingProgressQuery = (clientId: string) =>
  useQuery({
    queryKey: ["onboarding", clientId, "progress"],
    queryFn: () => getOnboardingProgress(clientId),
    enabled: Boolean(clientId),
  });

export const useOnboardingDocumentsQuery = (clientId: string, stepKey: WorkflowStepKey) =>
  useQuery({
    queryKey: ["onboarding", clientId, "documents", stepKey],
    queryFn: () => getOnboardingDocuments(clientId, stepKey),
    enabled: Boolean(clientId && stepKey),
  });

export const useUploadOnboardingDocumentMutation = () => {
  const queryClient = useQueryClient();
  const setUploadProgress = useOnboardingStore((state) => state.setUploadProgress);
  const clearUploadProgress = useOnboardingStore((state) => state.clearUploadProgress);

  return useMutation({
    mutationFn: ({
      clientId,
      stepKey,
      file,
    }: {
      clientId: string;
      stepKey: WorkflowStepKey;
      file: File;
    }) =>
      uploadOnboardingDocument(clientId, stepKey, file, (progressPercent) => {
        setUploadProgress({ progressPercent, fileName: file.name });
      }),
    onSuccess: (_, variables) => {
      clearUploadProgress();
      queryClient.invalidateQueries({
        queryKey: ["onboarding", variables.clientId, "documents", variables.stepKey],
      });
      queryClient.invalidateQueries({
        queryKey: ["onboarding", variables.clientId, "progress"],
      });
    },
    onError: () => {
      clearUploadProgress();
    },
  });
};
