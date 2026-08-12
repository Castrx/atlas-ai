import { AppError } from "./app-error";

/**
 * Erro de falha ao obter resposta de um provedor de LLM (ex.: OpenAI
 * indisponível, erro de rede, resposta inesperada). Sempre HTTP 502
 * (Bad Gateway) — a aplicação atua como gateway para um serviço
 * externo que falhou.
 *
 * A mensagem exposta ao cliente deve ser sempre genérica. Detalhes do
 * provedor (status, tipo de erro do SDK) devem ser logados no servidor,
 * nunca incluídos na mensagem deste erro.
 */
export class LlmError extends AppError {
  constructor(message = "Não foi possível obter resposta da LLM no momento.") {
    super(message, 502);
  }
}
