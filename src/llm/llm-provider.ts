import type { LlmMessage, LlmTurnResult } from "./llm-message.types";
import type { ToolDescriptor } from "../tools/tool.types";

/**
 * Abstração mínima sobre um provedor de LLM (ver ADR-003 no PROJECT_SPEC.md).
 *
 * Desde a Fase 3, converse() substitui o antigo sendMessage(string) — ver
 * ADR-019. LlmProvider é responsável somente por traduzir entre o
 * histórico de mensagens/tools (tipos próprios da aplicação) e a API real
 * da LLM; nunca executa uma tool, nunca decide quando parar o loop de tool
 * calling — isso é responsabilidade de ChatService (ver ADR-004).
 */
export interface LlmProvider {
  converse(messages: LlmMessage[], tools: ToolDescriptor[]): Promise<LlmTurnResult>;
}
