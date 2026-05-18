import api from "../../api/axios";
import type { ChatRequest, ChatResponse, ChatMessage } from "../../types/chatbot";
import { shouldUseMockApi } from "../apiMode";
import { mockGetChatMessages, mockSendChatMessage } from "../mock/mockApi";

export const getChatMessages = async (clientId: string, stepKey: string) => {
  try {
    const response = await api.get<ChatMessage[]>(`/api/ai/chat/messages`, {
      params: { clientId, stepKey },
    });
    return response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) return mockGetChatMessages(clientId, stepKey);
    throw error;
  }
};

export const sendChatMessage = async (payload: ChatRequest) => {
  try {
    const response = await api.post<ChatResponse>("/api/ai/chat", payload);
    return response.data;
  } catch (error) {
    if (shouldUseMockApi(error)) return mockSendChatMessage(payload);
    throw error;
  }
};
