import { describe, expect, it, vi } from "vitest";
import { OpenAiProvider } from "../../src/llm/openai-provider";
import { LlmError } from "../../src/errors/llm-error";

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

describe("OpenAiProvider.sendMessage", () => {
  it("retorna um ChatResponse válido quando a OpenAI devolve um JSON conforme o contrato", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(
        completionWith({
          content: JSON.stringify({ answer: "Olá!", intent: "general", confidence: 0.8 }),
        }),
      ),
    );
    const provider = new OpenAiProvider(fakeClient);

    const result = await provider.sendMessage("Olá");

    expect(result).toEqual({ answer: "Olá!", intent: "general", confidence: 0.8 });
  });

  it("envia system prompt + response_format (Structured Outputs) para a OpenAI", async () => {
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

    await provider.sendMessage("Olá");

    expect(create).toHaveBeenCalledTimes(1);
    const callArgs = create.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.messages).toEqual([
      { role: "system", content: expect.stringContaining("Atlas AI") },
      { role: "user", content: "Olá" },
    ]);
    expect(callArgs.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "chat_response", strict: true },
    });
  });

  it("6. lança LlmError quando o conteúdo não é um JSON válido", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(completionWith({ content: "isto não é JSON{{{" })),
    );
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.sendMessage("Olá")).rejects.toBeInstanceOf(LlmError);
  });

  it("7. lança LlmError quando o JSON é válido mas viola o contrato (schema)", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(
        completionWith({
          // confidence fora do intervalo 0-1: a OpenAI poderia devolver isso
          // mesmo em modo strict, pois esse schema não é enviado ao Structured
          // Outputs (só Zod valida isso) — ver ADR-014.
          content: JSON.stringify({ answer: "ok", intent: "general", confidence: 5 }),
        }),
      ),
    );
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.sendMessage("Olá")).rejects.toBeInstanceOf(LlmError);
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

    await expect(provider.sendMessage("Olá")).rejects.toBeInstanceOf(LlmError);
  });

  it("5. lança LlmError quando a OpenAI recusa responder (refusal)", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.resolve(completionWith({ refusal: "Não posso ajudar com isso." })),
    );
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.sendMessage("Olá")).rejects.toBeInstanceOf(LlmError);
  });

  it("lança LlmError quando a chamada à OpenAI falha (erro de rede/API)", async () => {
    const fakeClient = buildFakeClient(() => Promise.reject(new Error("network down")));
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.sendMessage("Olá")).rejects.toBeInstanceOf(LlmError);
  });

  it("nunca vaza detalhe interno (mensagem de erro) na LlmError lançada", async () => {
    const fakeClient = buildFakeClient(() =>
      Promise.reject(new Error("detalhe sensível do SDK")),
    );
    const provider = new OpenAiProvider(fakeClient);

    await expect(provider.sendMessage("Olá")).rejects.toMatchObject({
      message: "Não foi possível obter resposta da LLM no momento.",
    });
  });
});
