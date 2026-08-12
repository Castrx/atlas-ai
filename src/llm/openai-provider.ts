import OpenAI from "openai";
import { env } from "../config/env";
import { LlmError } from "../errors/llm-error";
import { logger } from "../utils/logger";
import type { LlmProvider } from "./llm-provider";

/**
 * Implementação concreta de LlmProvider usando a OpenAI API.
 *
 * Único arquivo do projeto que importa o SDK da OpenAI e lê
 * OPENAI_API_KEY — nenhum outro módulo deve fazer isso (ver
 * PROJECT_SPEC.md, Seção 10 — Segurança).
 */
export class OpenAiProvider implements LlmProvider {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async sendMessage(message: string): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [{ role: "user", content: message }],
      });

      const reply = completion.choices[0]?.message?.content;

      if (!reply) {
        logger.error("Resposta da OpenAI sem conteúdo utilizável", {
          finishReason: completion.choices[0]?.finish_reason,
        });
        throw new LlmError();
      }

      return reply;
    } catch (err) {
      if (err instanceof LlmError) {
        throw err;
      }

      // Log de diagnóstico seguro: nunca inclui a API key, headers de
      // request ou o objeto de erro cru do SDK — só status/tipo.
      logger.error("Falha ao chamar a OpenAI API", {
        status: err instanceof OpenAI.APIError ? err.status : undefined,
        type: err instanceof OpenAI.APIError ? err.type : undefined,
      });

      throw new LlmError();
    }
  }
}
