import OpenAI from "openai";
import { env } from "../config/env";
import { LlmError } from "../errors/llm-error";
import { logger } from "../utils/logger";
import { CHAT_SYSTEM_PROMPT } from "../prompts/chat.prompt";
import { chatResponseSchema, CHAT_RESPONSE_JSON_SCHEMA, type ChatResponse } from "./chat-response.schema";
import type { LlmProvider } from "./llm-provider";

function buildDefaultClient(): OpenAI {
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

/**
 * Implementação concreta de LlmProvider usando a OpenAI API.
 *
 * Único arquivo do projeto que importa o SDK da OpenAI e lê
 * OPENAI_API_KEY — nenhum outro módulo deve fazer isso (ver
 * PROJECT_SPEC.md, Seção 10 — Segurança).
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

  async sendMessage(message: string): Promise<ChatResponse> {
    const completion = await this.callOpenAi(message);
    const choice = completion.choices[0];

    if (choice?.message?.refusal) {
      logger.error("OpenAI recusou-se a responder (refusal)", {
        refusal: choice.message.refusal,
      });
      throw new LlmError();
    }

    const rawContent = choice?.message?.content;

    if (!rawContent) {
      logger.error("Resposta da OpenAI sem conteúdo utilizável", {
        finishReason: choice?.finish_reason,
      });
      throw new LlmError();
    }

    const parsedJson = this.parseJson(rawContent);
    return this.validateContract(parsedJson);
  }

  private async callOpenAi(message: string) {
    try {
      return await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: "system", content: CHAT_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
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
