import { useEffect } from "react";
import { useAuthStore } from "../store/auth.store";

export const useAuthBootstrap = () => {
  const hydrateAuth = useAuthStore((state) => state.hydrateAuth);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);
};
