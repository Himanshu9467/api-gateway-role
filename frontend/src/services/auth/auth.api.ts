import api from "../../api/axios";
import { isAxiosError } from "axios";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from "../../types/auth";
import { getErrorMessage } from "../../utils/httpError";
import { shouldUseMockApi } from "../apiMode";
import { mockLogin, mockRegister } from "../mock/mockApi";

export const login = async (payload: LoginRequest) => {
  try {
    const response = await api.post<AuthResponse>("/api/auth/login", payload);
    return response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) {
      return mockLogin(payload);
    }
    throw new Error(getErrorMessage(error, "Login failed"), { cause: error });
  }
};

export const register = async (payload: RegisterRequest) => {
  if (shouldUseMockApi()) {
    return mockRegister(payload);
  }

  try {
    const response = await api.post<AuthResponse | Record<string, never>>(
      "/api/auth/register",
      payload,
    );
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      const fallbackResponse = await api.post<AuthResponse | Record<string, never>>(
        "/api/auth/signup",
        payload,
      );
      return fallbackResponse.data;
    }

    if (shouldUseMockApi(error)) {
      return mockRegister(payload);
    }

    throw new Error(getErrorMessage(error, "Registration failed"), { cause: error });
  }
};
