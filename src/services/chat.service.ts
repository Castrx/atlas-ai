import type { LlmProvider } from "../llm/llm-provider";
import type { ChatResponse } from "../llm/chat-response.schema";

export interface ChatService {
  sendMessage(message: string): Promise<ChatResponse>;
}

/**
 * Orquestra o envio de uma mensagem ao LlmProvider.
 *
 * Depende apenas da interface LlmProvider (e do tipo ChatResponse, que é
 * um contrato de dados, não o SDK da OpenAI) — nunca do SDK diretamente
 * (ver ADR-003 no PROJECT_SPEC.md).
 */
export function createChatService(llmProvider: LlmProvider): ChatService {
  return {
    async sendMessage(message: string): Promise<ChatResponse> {
      return llmProvider.sendMessage(message);
    },
  };
}
