import type { LlmProvider } from "../llm/llm-provider";

export interface ChatService {
  sendMessage(message: string): Promise<string>;
}

/**
 * Orquestra o envio de uma mensagem ao LlmProvider.
 *
 * Depende apenas da interface LlmProvider — nunca do SDK da OpenAI ou
 * de OpenAiProvider diretamente (ver ADR-003 no PROJECT_SPEC.md).
 */
export function createChatService(llmProvider: LlmProvider): ChatService {
  return {
    async sendMessage(message: string): Promise<string> {
      return llmProvider.sendMessage(message);
    },
  };
}
