import api from "../../api/axios";
import type {
  ActivityItem,
  ClientSummary,
  CreateClientRequest,
  DashboardSummary,
} from "../../types/dashboard";
import { getErrorMessage } from "../../utils/httpError";
import { shouldUseMockApi } from "../apiMode";
import {
  mockCreateClient,
  mockGetDashboardActivity,
  mockGetDashboardClients,
  mockGetDashboardSummary,
} from "../mock/mockApi";

export const getDashboardSummary = async () => {
  try {
    const response = await api.get<DashboardSummary>("/api/dashboard/summary");
    return response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) return mockGetDashboardSummary();
    throw error;
  }
};

export const getDashboardClients = async () => {
  try {
    const response = await api.get<ClientSummary[]>("/api/dashboard/clients");
    return response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) return mockGetDashboardClients();
    throw error;
  }
};

export const getDashboardActivity = async () => {
  try {
    const response = await api.get<ActivityItem[]>("/api/dashboard/activity");
    return response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) return mockGetDashboardActivity();
    throw error;
  }
};

export const createClient = async (payload: CreateClientRequest) => {
  if (shouldUseMockApi()) {
    return mockCreateClient(payload);
  }

  try {
    const response = await api.post<ClientSummary | { client: ClientSummary }>(
      "/api/clients",
      payload,
    );
    return "client" in response.data ? response.data.client : response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) {
      return mockCreateClient(payload);
    }
    throw new Error(getErrorMessage(error, "Unable to create client"), { cause: error });
  }
};
