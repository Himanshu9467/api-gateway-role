export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatRequest {
  clientId: string;
  stepKey: string;
  message: string;
}

export interface ChatResponse {
  message: ChatMessage;
  suggestions: string[];
}
