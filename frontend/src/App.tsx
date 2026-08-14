import { useCallback, useRef, useState } from "react";
import { Header } from "./components/Header";
import { ChatWindow } from "./components/ChatWindow";
import { ChatInput } from "./components/ChatInput";
import { createMockChatApi } from "./api/mock-chat-api";
import { createRealChatApi } from "./api/chat-api";
import type { ChatApi, ChatMessage } from "./api/chat-api.types";

// Composition root do frontend: único lugar que decide qual ChatApi usar.
// Controlado por VITE_USE_MOCK_API (ver .env.example): "true" (padrão em
// dev) usa MockChatApi, "false" usa RealChatApi. Nenhum componente sabe
// qual implementação está ativa — todos dependem só de ChatApi.
const useMockApi = import.meta.env.VITE_USE_MOCK_API !== "false";
const chatApi: ChatApi = useMockApi ? createMockChatApi() : createRealChatApi();

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSentRef = useRef<string | null>(null);

  const send = useCallback(async (text: string) => {
    lastSentRef.current = text;
    setError(null);
    setMessages((prev) => [...prev, { id: createId(), role: "user", content: text, createdAt: Date.now() }]);
    setLoading(true);

    try {
      const response = await chatApi.sendMessage(text);
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: response.answer,
          createdAt: Date.now(),
          intent: response.intent,
          confidence: response.confidence,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível obter resposta do Atlas AI no momento.");
    } finally {
      setLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    if (lastSentRef.current) {
      void send(lastSentRef.current);
    }
  }, [send]);

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <ChatWindow messages={messages} loading={loading} error={error} onRetry={retry} onExampleClick={send} />
        <ChatInput disabled={loading} onSend={send} />
      </main>
    </div>
  );
}
