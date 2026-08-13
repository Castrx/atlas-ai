import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import request from "supertest";
import { createApp } from "../../src/app";
import { LlmError } from "../../src/errors/llm-error";
import { ToolRegistry } from "../../src/tools/tool-registry";
import type { LlmProvider } from "../../src/llm/llm-provider";
import type { LlmTurnResult } from "../../src/llm/llm-message.types";
import type { ChatResponse } from "../../src/llm/chat-response.schema";

function buildFakeProvider(turns: LlmTurnResult[]): LlmProvider {
  let index = 0;
  return {
    converse: vi.fn(async () => {
      const turn = turns[index] ?? turns[turns.length - 1];
      index += 1;
      return turn;
    }),
  };
}

function buildEmptyToolRegistry(): ToolRegistry {
  return new ToolRegistry([]);
}

describe("POST /api/chat", () => {
  it("1. requisição válida: retorna 200 com o contrato estruturado do provider", async () => {
    const structuredReply: ChatResponse = {
      answer: "Olá! Como posso ajudar?",
      intent: "general",
      confidence: 0.95,
    };
    const fakeProvider = buildFakeProvider([{ type: "final", response: structuredReply }]);
    const app = createApp({ llmProvider: fakeProvider, toolRegistry: buildEmptyToolRegistry() });

    const response = await request(app).post("/api/chat").send({ message: "Olá" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(structuredReply);
    expect(fakeProvider.converse).toHaveBeenCalledTimes(1);
  });

  it("2. mensagem vazia: retorna 400 e não chama o provider", async () => {
    const fakeProvider: LlmProvider = { converse: vi.fn() };
    const app = createApp({ llmProvider: fakeProvider, toolRegistry: buildEmptyToolRegistry() });

    const response = await request(app).post("/api/chat").send({ message: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).not.toContain("OPENAI_API_KEY");
    expect(fakeProvider.converse).not.toHaveBeenCalled();
  });

  it("2b. body sem o campo message: retorna 400 e não chama o provider", async () => {
    const fakeProvider: LlmProvider = { converse: vi.fn() };
    const app = createApp({ llmProvider: fakeProvider, toolRegistry: buildEmptyToolRegistry() });

    const response = await request(app).post("/api/chat").send({});

    expect(response.status).toBe(400);
    expect(fakeProvider.converse).not.toHaveBeenCalled();
  });

  it("3. erro do provider: retorna 502 com mensagem genérica, sem detalhes internos", async () => {
    const fakeProvider: LlmProvider = { converse: vi.fn().mockRejectedValue(new LlmError()) };
    const app = createApp({ llmProvider: fakeProvider, toolRegistry: buildEmptyToolRegistry() });

    const response = await request(app).post("/api/chat").send({ message: "Olá" });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: { message: "Não foi possível obter resposta da LLM no momento." },
    });
    // nunca deve vazar chave, stack trace ou nome de classe interna
    expect(JSON.stringify(response.body)).not.toMatch(/sk-|OPENAI_API_KEY|stack/i);
  });

  it("3b. erro inesperado (não-AppError) do provider: também não expõe detalhes internos", async () => {
    const fakeProvider: LlmProvider = {
      converse: vi.fn().mockRejectedValue(new Error("detalhe interno sensível")),
    };
    const app = createApp({ llmProvider: fakeProvider, toolRegistry: buildEmptyToolRegistry() });

    const response = await request(app).post("/api/chat").send({ message: "Olá" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { message: "Erro interno do servidor." },
    });
    expect(JSON.stringify(response.body)).not.toContain("detalhe interno sensível");
  });

  it("4. tool call seguido de resposta final: retorna 200 com o ChatResponse final", async () => {
    const structuredReply: ChatResponse = {
      answer: "Temos 3 produtos cadastrados.",
      intent: "product_query",
      confidence: 0.9,
    };
    const fakeProvider = buildFakeProvider([
      { type: "toolCall", id: "call_1", name: "getProducts", arguments: {} },
      { type: "final", response: structuredReply },
    ]);
    const toolRegistry = new ToolRegistry([
      {
        name: "getProducts",
        description: "tool de teste",
        readOnly: true,
        argsSchema: z.object({}).strict(),
        parametersJsonSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
        execute: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
    ]);
    const app = createApp({ llmProvider: fakeProvider, toolRegistry });

    const response = await request(app).post("/api/chat").send({ message: "Quantos produtos temos?" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(structuredReply);
    expect(fakeProvider.converse).toHaveBeenCalledTimes(2);
  });

  it("5. MAX_TOOL_ITERATIONS excedido: retorna 502 como erro explícito, nunca como ChatResponse 200", async () => {
    const fakeProvider = buildFakeProvider([
      { type: "toolCall", id: "call_1", name: "getProducts", arguments: {} },
    ]);
    const toolRegistry = new ToolRegistry([
      {
        name: "getProducts",
        description: "tool de teste",
        readOnly: true,
        argsSchema: z.object({}).strict(),
        parametersJsonSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
        execute: async () => [{ id: 1 }],
      },
    ]);
    const app = createApp({ llmProvider: fakeProvider, toolRegistry });

    const response = await request(app).post("/api/chat").send({ message: "Quantos produtos temos?" });

    expect(response.status).toBe(502);
    expect(response.body.error.message).toContain("limite de interações");
    expect(response.body).not.toHaveProperty("intent");
    expect(response.body).not.toHaveProperty("confidence");
    expect(JSON.stringify(response.body)).not.toMatch(/stack|getProducts.*arguments/i);
  });
});
