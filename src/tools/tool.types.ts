import type { z } from "zod";

/**
 * Descrição de uma tool no formato enviado à LLM (traduzido para o formato
 * de "function" da OpenAI por OpenAiProvider — este tipo não conhece o SDK
 * da OpenAI, ver ADR-004 no PROJECT_SPEC.md).
 */
export interface ToolDescriptor {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Contrato de uma tool executável pelo backend (ver ADR-004 e ADR-020 no
 * PROJECT_SPEC.md).
 *
 * `readOnly: true` é um literal de tipo, não só um valor em runtime: é
 * impossível declarar uma Tool sem afirmar explicitamente, em tempo de
 * compilação, que ela é somente leitura. Não existem tools de escrita
 * nesta fase — ver Seção 9 do PROJECT_SPEC.md ("O que não fazer agora").
 *
 * `argsSchema` é a única porta de entrada dos argumentos que a LLM propôs:
 * ToolRegistry sempre valida com este schema antes de chamar `execute`
 * (nunca confiamos em argumentos vindos da LLM sem validação — mesmo
 * princípio do ADR-014, aplicado agora a argumentos de tool em vez de à
 * resposta final).
 */
export interface Tool<Args, Result> {
  readonly name: string;
  readonly description: string;
  readonly readOnly: true;
  readonly argsSchema: z.ZodType<Args>;
  readonly parametersJsonSchema: Record<string, unknown>;
  execute(args: Args): Promise<Result>;
}

/**
 * Resultado da tentativa de invocar uma tool (ver ADR-020 no
 * PROJECT_SPEC.md). ToolRegistry.invoke nunca lança exceção: todo desfecho,
 * inclusive falhas, é representado aqui como dado, para que ChatService
 * sempre tenha algo seguro para devolver à LLM como mensagem de role
 * "tool" — nunca um stack trace, nunca um detalhe interno.
 *
 * - ok: a tool executou e devolveu dado utilizável.
 * - empty: a tool executou com sucesso, mas não há dado (lista vazia,
 *   registro não encontrado) — distinto de erro, para a LLM poder dizer
 *   "não encontrei resultados" em vez de tratar como falha.
 * - invalid_arguments: os argumentos propostos pela LLM não passaram no
 *   argsSchema. `issues` vem do Zod (mensagens genéricas, ex.: "Expected
 *   string, received number") — seguro expor à LLM porque descreve os
 *   argumentos que a própria LLM gerou, nunca dado do backend.
 * - unknown_tool: a LLM pediu uma tool que não está registrada. Defesa em
 *   profundidade: só pode acontecer se a LLM inventar um nome fora da
 *   lista que foi oferecida a ela (ver "defesa contra prompt injection
 *   indireta" no PROJECT_SPEC.md).
 * - execution_error: a tool foi chamada e falhou (ex.: integração indisponível).
 *   O erro real é logado no servidor; aqui só o estado é exposto.
 * - timeout: a tool excedeu o tempo máximo de execução (ver
 *   DEFAULT_TOOL_TIMEOUT_MS em tool-registry.ts).
 */
export type ToolInvocationResult =
  | { status: "ok"; data: unknown }
  | { status: "empty" }
  | { status: "invalid_arguments"; issues: string[] }
  | { status: "unknown_tool" }
  | { status: "execution_error" }
  | { status: "timeout" };
