import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  getDashboardActivity,
  getDashboardClients,
  getDashboardSummary,
} from "../../../services/dashboard/dashboard.api";
import type { CreateClientRequest } from "../../../types/dashboard";

export const useDashboardSummaryQuery = () =>
  useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: getDashboardSummary,
  });

export const useDashboardClientsQuery = () =>
  useQuery({
    queryKey: ["dashboard", "clients"],
    queryFn: getDashboardClients,
  });

export const useDashboardActivityQuery = () =>
  useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: getDashboardActivity,
  });

export const useCreateClientMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateClientRequest) => createClient(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard", "clients"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] }),
      ]);
    },
  });
};
