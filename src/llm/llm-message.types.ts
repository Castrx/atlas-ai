import type { ChatResponse } from "./chat-response.schema";
import type { ToolInvocationResult } from "../tools/tool.types";

/**
 * Histórico de conversa passado a cada chamada de LlmProvider.converse
 * (ver ADR-019 no PROJECT_SPEC.md). ChatService monta e acumula este
 * array; OpenAiProvider só traduz para o formato de mensagens da OpenAI —
 * nunca decide sozinho quando parar de chamar tools.
 *
 * - user: a pergunta original do usuário.
 * - assistantToolCall: representa uma chamada de tool que a LLM pediu em
 *   um turno anterior (o "id" liga esta mensagem à resposta da tool).
 * - toolResult: o resultado (ToolInvocationResult) de uma tool, sempre
 *   role "tool" do ponto de vista da OpenAI — estruturalmente separado de
 *   instrução, nunca reinterpretado como comando (defesa primária contra
 *   prompt injection indireta, ver PROJECT_SPEC.md).
 */
export type LlmMessage =
  | { role: "user"; content: string }
  | { role: "assistantToolCall"; id: string; toolName: string; arguments: unknown }
  | { role: "toolResult"; id: string; toolName: string; result: ToolInvocationResult };

/**
 * Resultado de um turno de conversa com a LLM.
 *
 * - final: a LLM devolveu uma resposta definitiva, já validada contra
 *   chatResponseSchema (mesmo contrato da Fase 2, ver ADR-013).
 * - toolCall: a LLM pediu para executar exatamente uma tool (parallel
 *   tool calls está desabilitado, ver ADR-021) antes de responder.
 */
export type LlmTurnResult =
  | { type: "final"; response: ChatResponse }
  | { type: "toolCall"; id: string; name: string; arguments: unknown };
