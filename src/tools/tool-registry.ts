import { logger } from "../utils/logger";
import type { Tool, ToolDescriptor, ToolInvocationResult } from "./tool.types";

/**
 * Tempo máximo permitido para a execução de uma tool. Protege contra uma
 * integração externa lenta/travada prendendo a conversa indefinidamente
 * (ver ADR-021 no PROJECT_SPEC.md).
 */
export const DEFAULT_TOOL_TIMEOUT_MS = 5000;

class ToolTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ToolTimeoutError(`Tool excedeu o tempo máximo de ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function isEmptyResult(data: unknown): boolean {
  if (data === null || data === undefined) {
    return true;
  }
  if (Array.isArray(data)) {
    return data.length === 0;
  }
  return false;
}

/**
 * Registro estático e explícito de tools disponíveis para a LLM (ver
 * ADR-004 e ADR-020 no PROJECT_SPEC.md). Lookup fechado: só é possível
 * invocar uma tool que foi passada ao construtor — não há registro
 * dinâmico, não há descoberta automática.
 *
 * invoke() nunca lança exceção — todo desfecho (sucesso, tool
 * desconhecida, argumentos inválidos, falha de execução, timeout) é
 * devolvido como ToolInvocationResult, para que ChatService sempre tenha
 * algo seguro para repassar à LLM como mensagem de role "tool".
 */
export class ToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly tools: Map<string, Tool<any, any>>;
  private readonly timeoutMs: number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(tools: Tool<any, any>[], timeoutMs = DEFAULT_TOOL_TIMEOUT_MS) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
    this.timeoutMs = timeoutMs;
  }

  list(): ToolDescriptor[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parametersJsonSchema,
    }));
  }

  async invoke(name: string, rawArgs: unknown): Promise<ToolInvocationResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      logger.warn("LLM pediu uma tool desconhecida", { tool: name });
      return { status: "unknown_tool" };
    }

    const parsedArgs = tool.argsSchema.safeParse(rawArgs);

    if (!parsedArgs.success) {
      return {
        status: "invalid_arguments",
        issues: parsedArgs.error.issues.map((issue) => issue.message),
      };
    }

    try {
      const data = await withTimeout(tool.execute(parsedArgs.data), this.timeoutMs);
      return isEmptyResult(data) ? { status: "empty" } : { status: "ok", data };
    } catch (err) {
      if (err instanceof ToolTimeoutError) {
        logger.error("Tool excedeu o tempo máximo de execução", { tool: name });
        return { status: "timeout" };
      }

      // Log de diagnóstico seguro: nunca o erro cru (pode conter detalhe
      // de uma integração externa), nunca os argumentos (podem conter
      // dado sensível fornecido pelo usuário).
      logger.error("Falha ao executar tool", {
        tool: name,
        error: err instanceof Error ? err.message : String(err),
      });
      return { status: "execution_error" };
    }
  }
}
