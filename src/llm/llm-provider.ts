import type { ChatResponse } from "./chat-response.schema";

/**
 * Abstração mínima sobre um provedor de LLM (ver ADR-003 no PROJECT_SPEC.md).
 *
 * Desde a Fase 2, o contrato de retorno é estruturado (ChatResponse),
 * não texto livre — ver ADR-013. Ainda sem histórico, sem roles, sem
 * streaming, sem tools: isso pertence a fases futuras.
 */
export interface LlmProvider {
  sendMessage(message: string): Promise<ChatResponse>;
}
