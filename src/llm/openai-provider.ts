import OpenAI from "openai";
import { env } from "../config/env";
import { LlmError } from "../errors/llm-error";
import { logger } from "../utils/logger";
import { CHAT_SYSTEM_PROMPT } from "../prompts/chat.prompt";
import { chatResponseSchema, CHAT_RESPONSE_JSON_SCHEMA, type ChatResponse } from "./chat-response.schema";
import type { LlmProvider } from "./llm-provider";
import type { LlmMessage, LlmTurnResult } from "./llm-message.types";
import type { ToolDescriptor } from "../tools/tool.types";

function buildDefaultClient(): OpenAI {
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function toOpenAiTools(tools: ToolDescriptor[]): OpenAI.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Traduz o histórico próprio da aplicação (LlmMessage) para o formato de
 * mensagens da OpenAI. É a única direção em que este módulo conhece o
 * formato da OpenAI — ChatService nunca constrói uma mensagem no formato
 * da OpenAI diretamente (ver ADR-003 no PROJECT_SPEC.md).
 *
 * O resultado de uma tool sempre vira uma mensagem role "tool": é a
 * própria API da OpenAI que garante a separação estrutural entre dado
 * (resultado da tool) e instrução (system/user) — defesa primária contra
 * prompt injection indireta.
 */
function toOpenAiMessages(messages: LlmMessage[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((message): OpenAI.ChatCompletionMessageParam => {
    switch (message.role) {
      case "user":
        return { role: "user", content: message.content };
      case "assistantToolCall":
        return {
          role: "assistant",
          tool_calls: [
            {
              id: message.id,
              type: "function",
              function: { name: message.toolName, arguments: JSON.stringify(message.arguments) },
            },
          ],
        };
      case "toolResult":
        return {
          role: "tool",
          tool_call_id: message.id,
          content: JSON.stringify(message.result),
        };
    }
  });
}

/**
 * Implementação concreta de LlmProvider usando a OpenAI API.
 *
 * Único arquivo do projeto que importa o SDK da OpenAI e lê
 * OPENAI_API_KEY — nenhum outro módulo deve fazer isso (ver
 * PROJECT_SPEC.md, Seção 10 — Segurança).
 *
 * Responsabilidade estritamente de tradução/comunicação (ver ADR-004 e
 * ADR-019): nunca executa uma tool, nunca conhece ToolRegistry, nunca
 * decide quando o loop de tool calling deve parar — isso é de
 * ChatService.
 *
 * O client é injetável (ver ADR-016): por padrão usa a OpenAI real, mas
 * testes podem passar um client fake para exercitar o parsing/validação
 * sem rede.
 */
export class OpenAiProvider implements LlmProvider {
  private readonly client: Pick<OpenAI, "chat">;

  constructor(client: Pick<OpenAI, "chat"> = buildDefaultClient()) {
    this.client = client;
  }

  async converse(messages: LlmMessage[], tools: ToolDescriptor[]): Promise<LlmTurnResult> {
    const completion = await this.callOpenAi(messages, tools);
    const choice = completion.choices[0];

    if (choice?.message?.refusal) {
      logger.error("OpenAI recusou-se a responder (refusal)", {
        refusal: choice.message.refusal,
      });
      throw new LlmError();
    }

    const toolCall = choice?.message?.tool_calls?.[0];

    if (toolCall) {
      return this.parseToolCall(toolCall);
    }

    const rawContent = choice?.message?.content;

    if (!rawContent) {
      logger.error("Resposta da OpenAI sem conteúdo utilizável", {
        finishReason: choice?.finish_reason,
      });
      throw new LlmError();
    }

    const parsedJson = this.parseJson(rawContent);
    return { type: "final", response: this.validateContract(parsedJson) };
  }

  private async callOpenAi(messages: LlmMessage[], tools: ToolDescriptor[]) {
    try {
      return await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: "system", content: CHAT_SYSTEM_PROMPT },
          ...toOpenAiMessages(messages),
        ],
        tools: toOpenAiTools(tools),
        tool_choice: "auto",
        // Uma tool call por turno: simplifica o loop de orquestração em
        // ChatService, que nunca precisa lidar com múltiplas tool calls
        // simultâneas (ver ADR-021 no PROJECT_SPEC.md).
        parallel_tool_calls: false,
        response_format: CHAT_RESPONSE_JSON_SCHEMA,
      });
    } catch (err) {
      // Log de diagnóstico seguro: nunca inclui a API key, headers de
      // request ou o objeto de erro cru do SDK — só status/tipo.
      logger.error("Falha ao chamar a OpenAI API", {
        status: err instanceof OpenAI.APIError ? err.status : undefined,
        type: err instanceof OpenAI.APIError ? err.type : undefined,
      });
      throw new LlmError();
    }
  }

  private parseToolCall(toolCall: OpenAI.ChatCompletionMessageToolCall): LlmTurnResult {
    if (toolCall.type !== "function") {
      logger.error("OpenAI pediu um tipo de tool call não suportado", { type: toolCall.type });
      throw new LlmError();
    }

    let parsedArguments: unknown;
    try {
      parsedArguments = JSON.parse(toolCall.function.arguments);
    } catch {
      // Não logamos os argumentos crus: podem conter texto arbitrário do modelo.
      logger.error("Argumentos de tool call da OpenAI não são um JSON válido");
      throw new LlmError();
    }

    return {
      type: "toolCall",
      id: toolCall.id,
      name: toolCall.function.name,
      arguments: parsedArguments,
    };
  }

  private parseJson(rawContent: string): unknown {
    try {
      return JSON.parse(rawContent);
    } catch {
      // Não logamos rawContent: pode conter texto arbitrário do modelo.
      logger.error("Resposta da OpenAI não é um JSON válido");
      throw new LlmError();
    }
  }

  private validateContract(parsedJson: unknown): ChatResponse {
    const result = chatResponseSchema.safeParse(parsedJson);

    if (!result.success) {
      logger.error("Resposta da OpenAI não segue o contrato esperado (ChatResponse)", {
        issues: result.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
      });
      throw new LlmError();
    }

    return result.data;
  }
}
