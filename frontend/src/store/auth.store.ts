import { create } from "zustand";
import type { AuthResponse, User } from "../types/auth";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";

interface AuthStoreState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  hydrateAuth: () => void;
  setAuth: (auth: AuthResponse) => void;
  clearAuth: () => void;
}

const persistAuth = (token: string, user: User) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

const clearPersistedAuth = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem("token");
};

const readPersistedAuth = (): Pick<AuthStoreState, "token" | "user" | "isAuthenticated"> => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const rawUser = localStorage.getItem(AUTH_USER_KEY);

  if (!token || !rawUser || !isJwtLike(token)) {
    clearPersistedAuth();
    return { token: null, user: null, isAuthenticated: false };
  }

  try {
    const user = JSON.parse(rawUser) as User;
    return { token, user, isAuthenticated: true };
  } catch {
    clearPersistedAuth();
    return { token: null, user: null, isAuthenticated: false };
  }
};

const initialAuthState = readPersistedAuth();

function isJwtLike(token: string): boolean {
  return token.split(".").length === 3;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  token: initialAuthState.token,
  user: initialAuthState.user,
  isAuthenticated: initialAuthState.isAuthenticated,
  hydrateAuth: () => {
    set(readPersistedAuth());
  },
  setAuth: ({ token, user }) => {
    persistAuth(token, user);
    set({ token, user, isAuthenticated: true });
  },
  clearAuth: () => {
    clearPersistedAuth();
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
