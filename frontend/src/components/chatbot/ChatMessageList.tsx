import type { ChatMessage } from "../../types/chatbot";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../common/EmptyState";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
}

export const ChatMessageList = ({ messages, isTyping }: ChatMessageListProps) => {
  const { t } = useTranslation();
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{t("chatbot.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <EmptyState message={t("chatbot.empty")} />
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-md px-3 py-2 text-sm ${
                  message.role === "assistant"
                    ? "bg-slate-100 text-slate-800"
                    : "bg-blue-600 text-white"
                }`}
              >
                {message.content}
              </div>
            ))
          )}
        </div>
        {isTyping ? <p className="text-xs text-slate-500">{t("chatbot.typing")}</p> : null}
      </CardContent>
    </Card>
  );
};
