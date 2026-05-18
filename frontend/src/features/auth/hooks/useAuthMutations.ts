import { useMutation } from "@tanstack/react-query";
import { login, register } from "../../../services/auth/auth.api";
import { useAuthStore } from "../../../store/auth.store";
import type { LoginRequest, RegisterRequest } from "../../../types/auth";

export const useLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  return useMutation({
    mutationFn: (payload: LoginRequest) => login(payload),
    onSuccess: setAuth,
  });
};

export const useRegisterMutation = () =>
  useMutation({
    mutationFn: (payload: RegisterRequest) => register(payload),
  });
