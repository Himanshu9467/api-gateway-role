import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getChatMessages, sendChatMessage } from "../../../services/chatbot/chatbot.api";
import { useChatbotStore } from "../../../store/chatbot.store";

export const useChatMessagesQuery = (clientId: string, stepKey: string) =>
  useQuery({
    queryKey: ["chatbot", "messages", clientId, stepKey],
    queryFn: () => getChatMessages(clientId, stepKey),
    enabled: Boolean(clientId && stepKey),
  });

export const useSendChatMessageMutation = (clientId: string, stepKey: string) => {
  const queryClient = useQueryClient();
  const setSuggestions = useChatbotStore((state) => state.setSuggestions);

  return useMutation({
    mutationFn: (message: string) => sendChatMessage({ clientId, stepKey, message }),
    onSuccess: (response) => {
      setSuggestions(response.suggestions);
      queryClient.invalidateQueries({ queryKey: ["chatbot", "messages", clientId, stepKey] });
    },
  });
};
