/**
 * Contrato de resposta do chat, espelhando ChatResponse do backend
 * (src/llm/chat-response.schema.ts no Atlas AI). Mantido em sincronia
 * manualmente — o frontend não importa código do backend.
 */
export type ChatIntent = "product_query" | "sales_query" | "customer_query" | "general" | "unsupported";

export interface ChatResponse {
  answer: string;
  intent: ChatIntent;
  confidence: number;
}

/**
 * Mensagem exibida na UI. Uma mensagem "user" é sempre só texto; uma
 * mensagem "assistant" carrega a resposta estruturada completa do
 * ChatApi, para permitir uso futuro de intent/confidence na interface
 * sem precisar mudar o contrato de novo.
 */
export type ChatMessage =
  | { id: string; role: "user"; content: string; createdAt: number }
  | { id: string; role: "assistant"; content: string; createdAt: number; intent: ChatIntent; confidence: number };

/**
 * Abstração sobre "conversar com o Atlas AI" (ver ADR de LlmProvider no
 * backend — mesmo princípio aplicado aqui). Componentes de UI dependem
 * somente desta interface, nunca de fetch ou de uma URL diretamente:
 * trocar MockChatApi por RealChatApi nunca exige mudar um componente.
 */
export interface ChatApi {
  sendMessage(message: string): Promise<ChatResponse>;
}
