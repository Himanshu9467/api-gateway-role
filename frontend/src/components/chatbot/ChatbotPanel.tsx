import { ChatInput } from "./ChatInput";
import { ChatMessageList } from "./ChatMessageList";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { useChatbotStore } from "../../store/chatbot.store";
import {
  useChatMessagesQuery,
  useSendChatMessageMutation,
} from "../../features/chatbot/hooks/useChatbotQueries";
import { useTranslation } from "react-i18next";

interface ChatbotPanelProps {
  clientId: string;
  stepKey: string;
}

export const ChatbotPanel = ({ clientId, stepKey }: ChatbotPanelProps) => {
  const { t } = useTranslation();
  const suggestions = useChatbotStore((state) => state.suggestions);
  const setDraftMessage = useChatbotStore((state) => state.setDraftMessage);
  const { data: messages = [], isLoading } = useChatMessagesQuery(clientId, stepKey);
  const sendMessageMutation = useSendChatMessageMutation(clientId, stepKey);

  const handleSend = (message: string) => {
    sendMessageMutation.mutate(message);
  };

  const promptFallbacks = [t("chatbot.prompt1"), t("chatbot.prompt2"), t("chatbot.prompt3")];
  const promptList = suggestions.length > 0 ? suggestions : promptFallbacks;

  return (
    <div className="space-y-3">
      <ChatMessageList messages={messages} isTyping={sendMessageMutation.isPending} />
      <SuggestedPrompts prompts={promptList} onSelectPrompt={setDraftMessage} />
      <ChatInput onSend={handleSend} disabled={sendMessageMutation.isPending || isLoading} />
    </div>
  );
};
