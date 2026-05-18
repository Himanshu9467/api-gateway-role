import { create } from "zustand";

interface ChatbotStoreState {
  suggestions: string[];
  draftMessage: string;
  setSuggestions: (suggestions: string[]) => void;
  setDraftMessage: (message: string) => void;
  clearDraftMessage: () => void;
}

export const useChatbotStore = create<ChatbotStoreState>((set) => ({
  suggestions: [],
  draftMessage: "",
  setSuggestions: (suggestions) => set({ suggestions }),
  setDraftMessage: (message) => set({ draftMessage: message }),
  clearDraftMessage: () => set({ draftMessage: "" }),
}));
