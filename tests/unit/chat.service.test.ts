import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createChatService, MAX_TOOL_ITERATIONS } from "../../src/services/chat.service";
import { ToolRegistry } from "../../src/tools/tool-registry";
import { ToolError } from "../../src/errors/tool-error";
import type { LlmProvider } from "../../src/llm/llm-provider";
import type { LlmMessage, LlmTurnResult } from "../../src/llm/llm-message.types";
import type { ChatResponse } from "../../src/llm/chat-response.schema";
import type { Tool } from "../../src/tools/tool.types";

const finalReply: ChatResponse = { answer: "resposta final", intent: "general", confidence: 0.9 };

/** LlmProvider fake que devolve, em ordem, os turnos passados ao construir. */
function buildScriptedProvider(turns: LlmTurnResult[]): {
  provider: LlmProvider;
  calls: LlmMessage[][];
} {
  const calls: LlmMessage[][] = [];
  let index = 0;

  return {
    calls,
    provider: {
      converse: vi.fn(async (messages: LlmMessage[]) => {
        calls.push(structuredClone(messages));
        const turn = turns[index];
        index += 1;
        if (!turn) {
          throw new Error("teste chamou converse mais vezes do que o script previa");
        }
        return turn;
      }),
    },
  };
}

const echoArgsSchema = z.object({ value: z.string() }).strict();

function buildToolRegistry(execute: Tool<{ value: string }, unknown>["execute"] = async (a) => a): ToolRegistry {
  return new ToolRegistry([
    {
      name: "echo",
      description: "tool de teste",
      readOnly: true,
      argsSchema: echoArgsSchema,
      parametersJsonSchema: {
        type: "object",
        properties: { value: { type: "string" } },
        required: ["value"],
        additionalProperties: false,
      },
      execute,
    },
  ]);
}

describe("chatService.sendMessage — resposta direta (sem tool call)", () => {
  it("devolve o ChatResponse final sem invocar nenhuma tool", async () => {
    const { provider } = buildScriptedProvider([{ type: "final", response: finalReply }]);
    const toolRegistry = buildToolRegistry();
    const invokeSpy = vi.spyOn(toolRegistry, "invoke");
    const chatService = createChatService(provider, toolRegistry);

    const reply = await chatService.sendMessage("Olá");

    expect(reply).toEqual(finalReply);
    expect(provider.converse).toHaveBeenCalledTimes(1);
    expect(invokeSpy).not.toHaveBeenCalled();
  });
});

describe("chatService.sendMessage — tool call seguido de resposta final", () => {
  it("invoca a tool pedida e devolve o ChatResponse final do segundo turno", async () => {
    const { provider, calls } = buildScriptedProvider([
      { type: "toolCall", id: "call_1", name: "echo", arguments: { value: "oi" } },
      { type: "final", response: finalReply },
    ]);
    const toolRegistry = buildToolRegistry();
    const invokeSpy = vi.spyOn(toolRegistry, "invoke");
    const chatService = createChatService(provider, toolRegistry);

    const reply = await chatService.sendMessage("Olá");

    expect(reply).toEqual(finalReply);
    expect(invokeSpy).toHaveBeenCalledWith("echo", { value: "oi" });
    expect(provider.converse).toHaveBeenCalledTimes(2);

    // No segundo turno, o histórico já inclui a tool call e o resultado dela.
    expect(calls[1]).toEqual([
      { role: "user", content: "Olá" },
      { role: "assistantToolCall", id: "call_1", toolName: "echo", arguments: { value: "oi" } },
      { role: "toolResult", id: "call_1", toolName: "echo", result: { status: "ok", data: { value: "oi" } } },
    ]);
  });
});

describe("chatService.sendMessage — resultados não-ok da tool são repassados como dado, não como erro fatal", () => {
  it("tool desconhecida: registry devolve unknown_tool e a conversa continua", async () => {
    const { provider } = buildScriptedProvider([
      { type: "toolCall", id: "call_1", name: "naoExiste", arguments: {} },
      { type: "final", response: finalReply },
    ]);
    const toolRegistry = buildToolRegistry();
    const chatService = createChatService(provider, toolRegistry);

    const reply = await chatService.sendMessage("Olá");

    expect(reply).toEqual(finalReply);
  });

  it("argumentos inválidos: registry devolve invalid_arguments e a conversa continua", async () => {
    const { provider } = buildScriptedProvider([
      { type: "toolCall", id: "call_1", name: "echo", arguments: { value: 123 } },
      { type: "final", response: finalReply },
    ]);
    const toolRegistry = buildToolRegistry();
    const chatService = createChatService(provider, toolRegistry);

    const reply = await chatService.sendMessage("Olá");

    expect(reply).toEqual(finalReply);
  });

  it("erro de execução: registry devolve execution_error e a conversa continua", async () => {
    const { provider } = buildScriptedProvider([
      { type: "toolCall", id: "call_1", name: "echo", arguments: { value: "oi" } },
      { type: "final", response: finalReply },
    ]);
    const toolRegistry = buildToolRegistry(async () => {
      throw new Error("falha simulada da integração");
    });
    const chatService = createChatService(provider, toolRegistry);

    const reply = await chatService.sendMessage("Olá");

    expect(reply).toEqual(finalReply);
  });
});

describe("chatService.sendMessage — MAX_TOOL_ITERATIONS excedido", () => {
  it("lança ToolError (nunca um ChatResponse) quando a LLM nunca converge para uma resposta final", async () => {
    const turns: LlmTurnResult[] = Array.from({ length: MAX_TOOL_ITERATIONS }, (_, i) => ({
      type: "toolCall" as const,
      id: `call_${i}`,
      name: "echo",
      arguments: { value: "oi" },
    }));
    const { provider } = buildScriptedProvider(turns);
    const toolRegistry = buildToolRegistry();
    const chatService = createChatService(provider, toolRegistry);

    const failure = chatService.sendMessage("Olá");

    await expect(failure).rejects.toBeInstanceOf(ToolError);
    await expect(failure).rejects.toMatchObject({ statusCode: 502 });
    expect(provider.converse).toHaveBeenCalledTimes(MAX_TOOL_ITERATIONS);
  });
});
