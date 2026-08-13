import { describe, expect, it, vi } from "vitest";
import { OpenAiProvider } from "../../src/llm/openai-provider";
import { LlmError } from "../../src/errors/llm-error";
import type { LlmMessage } from "../../src/llm/llm-message.types";
import type { ToolDescriptor } from "../../src/tools/tool.types";

/**
 * Testa OpenAiProvider isoladamente, com um client OpenAI fake injetado
 * (ver ADR-016 no PROJECT_SPEC.md) — nenhuma chamada real à rede/OpenAI.
 * Cobre exatamente a lógica que os testes de integração não alcançam,
 * porque lá o LlmProvider inteiro é substituído por um fake.
 */
function buildFakeClient(createImpl: (...args: unknown[]) => unknown) {
  return {
    chat: {
      completions: {
        create: vi.fn(createImpl),
      },
    },
  } as unknown as ConstructorParameters<typeof OpenAiProvider>[0];
}

function completionWith(message: Record<string, unknown>) {
  return {
    choices: [{ message, finish_reason: "stop" }],
  };
}

const userMessages: LlmMessage[] = [{ role: "user", content: "Olá" }];
const noTools: ToolDescriptor[] = [];
const oneTool: ToolDescriptor[] = [
  {
    name: "getProducts",
    description: "Lista produtos.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

describe("OpenAiProvider.converse — resposta final", () => {
  it("retorna { type: 'final' } com um ChatResponse válido quando a OpenAI não pede tool call", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(
        completionWith({
          content: JSON.stringify({ answer: "Olá!", intent: "general", confidence: 0.8 }),
        }),
      ),
    );
    const provider = new OpenAiProvider(fakeClient);

    const result = await provider.converse(userMessages, noTools);

    expect(result).toEqual({
      type: "final",
      response: { answer: "Olá!", intent: "general", confidence: 0.8 },
    });
  });

  it("envia system prompt, tools, tool_choice auto e parallel_tool_calls false para a OpenAI", async () => {
    const create = vi.fn((..._args: unknown[]) =>
      Promise.resolve(
        completionWith({
          content: JSON.stringify({ answer: "ok", intent: "general", confidence: 1 }),
        }),
      ),
    );
    const fakeClient = { chat: { completions: { create } } } as unknown as ConstructorParameters<
      typeof OpenAiProvider
    >[0];
    const provider = new OpenAiProvider(fakeClient);

    await provider.converse(userMessages, oneTool);

    expect(create).toHaveBeenCalledTimes(1);
    const callArgs = create.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.messages).toEqual([
      { role: "system", content: expect.stringContaining("Atlas AI") },
      { role: "user", content: "Olá" },
    ]);
    expect(callArgs.tools).toEqual([
      {
        type: "function",
        function: { name: "getProducts", description: "Lista produtos.", parameters: oneTool[0].parameters },
      },
    ]);
    expect(callArgs.tool_choice).toBe("auto");
    expect(callArgs.parallel_tool_calls).toBe(false);
    expect(callArgs.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "chat_response", strict: true },
    });
  });

  it("traduz o histórico (assistantToolCall + toolResult) para o formato de mensagens da OpenAI", async () => {
    const create = vi.fn((..._args: unknown[]) =>
      Promise.resolve(
        completionWith({
          content: JSON.stringify({ answer: "ok", intent: "general", confidence: 1 }),
        }),
      ),
    );
    const fakeClient = { chat: { completions: { create } } } as unknown as ConstructorParameters<
      typeof OpenAiProvider
    >[0];
    const provider = new OpenAiProvider(fakeClient);

    const history: LlmMessage[] = [
      { role: "user", content: "Quantos produtos temos?" },
      { role: "assistantToolCall", id: "call_1", toolName: "getProducts", arguments: { onlyActive: true } },
      { role: "toolResult", id: "call_1", toolName: "getProducts", result: { status: "empty" } },
    ];

    await provider.converse(history, oneTool);

    const callArgs = create.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.messages).toEqual([
      { role: "system", content: expect.any(String) },
      { role: "user", content: "Quantos produtos temos?" },
      {
        role: "assistant",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "getProducts", arguments: JSON.stringify({ onlyActive: true }) },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: JSON.stringify({ status: "empty" }) },
    ]);
  });

  it("6. lança LlmError quando o conteúdo não é um JSON válido", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(completionWith({ content: "isto não é JSON{{{" })),
    );
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.converse(userMessages, noTools)).rejects.toBeInstanceOf(LlmError);
  });

  it("7. lança LlmError quando o JSON é válido mas viola o contrato (schema)", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(
        completionWith({
          content: JSON.stringify({ answer: "ok", intent: "general", confidence: 5 }),
        }),
      ),
    );
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.converse(userMessages, noTools)).rejects.toBeInstanceOf(LlmError);
  });

  it("7b. lança LlmError quando falta um campo obrigatório do contrato", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(
        completionWith({
          content: JSON.stringify({ answer: "ok", intent: "general" /* confidence ausente */ }),
        }),
      ),
    );
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.converse(userMessages, noTools)).rejects.toBeInstanceOf(LlmError);
  });

  it("5. lança LlmError quando a OpenAI recusa responder (refusal)", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(completionWith({ refusal: "Não posso ajudar com isso." })),
    );
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.converse(userMessages, noTools)).rejects.toBeInstanceOf(LlmError);
  });

  it("lança LlmError quando a chamada à OpenAI falha (erro de rede/API)", async () => {
    const fakeClient = buildFakeClient(() => Promise.reject(new Error("network down")));
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.converse(userMessages, noTools)).rejects.toBeInstanceOf(LlmError);
  });

  it("nunca vaza detalhe interno (mensagem de erro) na LlmError lançada", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.reject(new Error("detalhe sensível do SDK")),
    );
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.converse(userMessages, noTools)).rejects.toMatchObject({
      message: "Não foi possível obter resposta da LLM no momento.",
    });
  });
});

describe("OpenAiProvider.converse — tool call", () => {
  it("retorna { type: 'toolCall' } quando a OpenAI pede a execução de uma tool", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(
        completionWith({
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "getProducts", arguments: JSON.stringify({ onlyActive: true }) },
            },
          ],
        }),
      ),
    );
    const provider = new OpenAiProvider(fakeClient);

    const result = await provider.converse(userMessages, oneTool);

    expect(result).toEqual({
      type: "toolCall",
      id: "call_1",
      name: "getProducts",
      arguments: { onlyActive: true },
    });
  });

  it("lança LlmError quando os argumentos da tool call não são um JSON válido, sem vazá-los", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(
        completionWith({
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "getProducts", arguments: "{{{ não é json" },
            },
          ],
        }),
      ),
    );
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.converse(userMessages, oneTool)).rejects.toMatchObject({
      message: "Não foi possível obter resposta da LLM no momento.",
    });
  });
});
