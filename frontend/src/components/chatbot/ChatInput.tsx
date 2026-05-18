import { Send } from "lucide-react";
import { useChatbotStore } from "../../store/chatbot.store";
import { useTranslation } from "react-i18next";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const { t } = useTranslation();
  const draftMessage = useChatbotStore((state) => state.draftMessage);
  const setDraftMessage = useChatbotStore((state) => state.setDraftMessage);
  const clearDraftMessage = useChatbotStore((state) => state.clearDraftMessage);

  const handleSend = () => {
    if (!draftMessage.trim()) return;
    onSend(draftMessage.trim());
    clearDraftMessage();
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={draftMessage}
        onChange={(event) => setDraftMessage(event.target.value)}
        placeholder={t("chatbot.placeholder")}
        className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleSend();
          }
        }}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
};
