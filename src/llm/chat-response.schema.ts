import { z } from "zod";

/**
 * Contrato estruturado da resposta da LLM (ver ADR-013 no PROJECT_SPEC.md).
 *
 * - answer: resposta em linguagem natural para o usuário.
 * - intent: classificação por domínio da pergunta. Não decide nem nomeia
 *   uma tool específica — isso é escopo da Fase 3 (Tool Calling).
 * - confidence: confiança autoavaliada pela LLM na classificação de
 *   `intent`, não na veracidade factual de `answer`. É um sinal
 *   conhecidamente imperfeito (LLMs não são bem calibradas nisso), usado
 *   aqui com propósito pedagógico (demonstrar structured output).
 */
export const chatResponseSchema = z.object({
  answer: z.string().min(1),
  intent: z.enum(["product_query", "sales_query", "customer_query", "general", "unsupported"]),
  confidence: z.number().min(0).max(1),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

/**
 * JSON Schema enviado à OpenAI via `response_format` (Structured Outputs,
 * modo strict). Escrito à mão, e não derivado de `z.toJSONSchema()`, porque
 * o modo strict da OpenAI só suporta um subconjunto de JSON Schema (type,
 * enum, required, additionalProperties) — palavras-chave de validação como
 * minLength/minimum/maximum (presentes em chatResponseSchema) não são
 * suportadas e não devem ser enviadas.
 *
 * Isto restringe apenas a FORMA da resposta. A validação semântica real
 * (confidence entre 0 e 1, answer não vazia) é feita depois, de forma
 * independente, por chatResponseSchema.parse() em OpenAiProvider — nunca
 * confiamos cegamente no que a OpenAI devolve, mesmo com Structured
 * Outputs habilitado (ver ADR-014).
 */
export const CHAT_RESPONSE_JSON_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "chat_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        answer: { type: "string" },
        intent: {
          type: "string",
          enum: ["product_query", "sales_query", "customer_query", "general", "unsupported"],
        },
        confidence: { type: "number" },
      },
      required: ["answer", "intent", "confidence"],
      additionalProperties: false,
    },
  },
} as const;
