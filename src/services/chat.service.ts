import type { LlmProvider } from "../llm/llm-provider";
import type { LlmMessage } from "../llm/llm-message.types";
import type { ChatResponse } from "../llm/chat-response.schema";
import type { ToolRegistry } from "../tools/tool-registry";
import { ToolError } from "../errors/tool-error";
import { logger } from "../utils/logger";

/**
 * Número máximo de idas e voltas de tool calling permitidas em uma única
 * mensagem do usuário, antes de desistir (ver ADR-021 no PROJECT_SPEC.md).
 * Protege contra a LLM entrar em um ciclo de chamadas de tool sem nunca
 * convergir para uma resposta final.
 */
export const MAX_TOOL_ITERATIONS = 5;

export interface ChatService {
  sendMessage(message: string): Promise<ChatResponse>;
}

/**
 * Orquestra a conversa com a LLM, incluindo o loop de tool calling (ver
 * ADR-004, ADR-019, ADR-020 e ADR-021 no PROJECT_SPEC.md).
 *
 * Depende apenas de LlmProvider (nunca do SDK da OpenAI diretamente) e de
 * ToolRegistry (nunca de uma tool ou do AtlasErpClient diretamente) — é o
 * único lugar da aplicação que decide QUANDO chamar uma tool e QUANDO
 * parar de tentar.
 */
export function createChatService(llmProvider: LlmProvider, toolRegistry: ToolRegistry): ChatService {
  const toolDescriptors = toolRegistry.list();

  return {
    async sendMessage(message: string): Promise<ChatResponse> {
      const messages: LlmMessage[] = [{ role: "user", content: message }];
      const toolsAttempted: string[] = [];

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const turn = await llmProvider.converse(messages, toolDescriptors);

        if (turn.type === "final") {
          return turn.response;
        }

        toolsAttempted.push(turn.name);

        // O resultado da tool nunca é tratado como instrução: vira uma
        // mensagem role "tool" separada estruturalmente do restante da
        // conversa (ver toOpenAiMessages em openai-provider.ts).
        const result = await toolRegistry.invoke(turn.name, turn.arguments);

        messages.push({
          role: "assistantToolCall",
          id: turn.id,
          toolName: turn.name,
          arguments: turn.arguments,
        });
        messages.push({ role: "toolResult", id: turn.id, toolName: turn.name, result });
      }

      // Esgotou MAX_TOOL_ITERATIONS sem chegar a uma resposta final: isto
      // é uma falha de orquestração do servidor, não uma resposta normal
      // da LLM — nunca vira um ChatResponse "aparentemente válido" (ver
      // ADR-021). Log de diagnóstico seguro: só nomes de tool e
      // contagem, nunca argumentos ou conteúdo da conversa.
      logger.error("Limite de iterações de tool calling atingido", {
        iterations: MAX_TOOL_ITERATIONS,
        toolsAttempted,
      });
      throw new ToolError();
    },
  };
}
