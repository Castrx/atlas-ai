import { AppError } from "./app-error";

/**
 * Erro de falha na orquestração de tool calling (ver ADR-021 no
 * PROJECT_SPEC.md). Hoje o único caso é o esgotamento de
 * MAX_TOOL_ITERATIONS: a conversa com a LLM envolveu chamadas de tools
 * repetidas vezes sem chegar a uma resposta final dentro do orçamento de
 * iterações permitido.
 *
 * Isto NÃO é uma resposta normal da LLM (não deve virar um ChatResponse
 * com intent "unsupported") — é uma falha de orquestração do lado do
 * servidor, por isso é um AppError, tratado pelo middleware central de
 * erro como qualquer outro (ver src/middleware/error-handler.ts).
 *
 * Sempre HTTP 502: do ponto de vista do cliente, é a mesma categoria de
 * LlmError — "a solicitação dependia de um processo mediado pela LLM que
 * não produziu um resultado utilizável" — mas com uma classe e mensagem
 * próprias para diferenciar a causa nos logs e nos testes.
 *
 * A mensagem exposta ao cliente é sempre genérica. Diagnóstico (quantas
 * iterações ocorreram, quais tools foram tentadas — nunca os argumentos)
 * deve ser logado no servidor antes de lançar este erro, nunca incluído
 * na mensagem.
 */
export class ToolError extends AppError {
  constructor(
    message = "Não foi possível concluir a solicitação: limite de interações com ferramentas foi atingido.",
  ) {
    super(message, 502);
  }
}
