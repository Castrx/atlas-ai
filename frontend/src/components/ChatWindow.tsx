import { useEffect, useRef } from "react";
import type { ChatMessage } from "../api/chat-api.types";
import { MessageBubble } from "./MessageBubble";
import { LoadingIndicator } from "./LoadingIndicator";
import { ErrorBanner } from "./ErrorBanner";
import { CompassMark } from "./Header";

const EXAMPLE_QUESTIONS = [
  "Quais produtos temos cadastrados?",
  "Quais produtos estão com estoque baixo?",
  "Quantos clientes temos?",
  "Como foram as vendas este mês?",
];

interface ChatWindowProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onExampleClick: (question: string) => void;
}

export function ChatWindow({ messages, loading, error, onRetry, onExampleClick }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, error]);

  return (
    <div className="chat-window">
      {messages.length === 0 ? (
        <div className="welcome">
          <div className="welcome__mark">
            <CompassMark size={32} />
          </div>
          <h2 className="welcome__title">Para onde vamos?</h2>
          <p className="welcome__text">
            Pergunte sobre produtos, estoque, clientes ou vendas do Atlas ERP. Algumas ideias:
          </p>
          <div className="welcome__examples">
            {EXAMPLE_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                className="example-chip"
                onClick={() => onExampleClick(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="message-list" aria-live="polite">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {loading && <LoadingIndicator />}
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={onRetry} />}

      <div ref={bottomRef} />
    </div>
  );
}
