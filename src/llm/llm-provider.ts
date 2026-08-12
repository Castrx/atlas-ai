/**
 * Abstração mínima sobre um provedor de LLM (ver ADR-003 no PROJECT_SPEC.md).
 *
 * Representa somente o comportamento necessário nesta fase: enviar uma
 * mensagem e receber uma resposta em texto. Sem histórico, sem roles,
 * sem streaming, sem tools — isso pertence a fases futuras e não deve
 * ser antecipado aqui.
 */
export interface LlmProvider {
  sendMessage(message: string): Promise<string>;
}
