import type { ChatIntent, ChatMessage } from "../api/chat-api.types";
import { CompassMark } from "./Header";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Rótulos de exibição para o intent classificado pelo backend (ChatResponse.intent). */
const INTENT_LABELS: Record<ChatIntent, string> = {
  product_query: "Produtos",
  sales_query: "Vendas",
  customer_query: "Clientes",
  general: "Geral",
  unsupported: "Não suportado",
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`message-row message-row--${message.role}`}>
      {!isUser && (
        <div className="message-avatar" aria-hidden="true">
          <CompassMark size={16} />
        </div>
      )}
      <div className="message-bubble">
        {message.role === "assistant" && (
          <span className="message-bubble__intent">{INTENT_LABELS[message.intent]}</span>
        )}
        <p className="message-bubble__text">{message.content}</p>
        <span className="message-bubble__time">{timeFormatter.format(message.createdAt)}</span>
      </div>
    </div>
  );
}
