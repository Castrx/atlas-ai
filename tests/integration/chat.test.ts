import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { LlmError } from "../../src/errors/llm-error";
import type { LlmProvider } from "../../src/llm/llm-provider";
import type { ChatResponse } from "../../src/llm/chat-response.schema";

describe("POST /api/chat", () => {
  it("1. requisição válida: retorna 200 com o contrato estruturado do provider", async () => {
    const structuredReply: ChatResponse = {
      answer: "Olá! Como posso ajudar?",
      intent: "general",
      confidence: 0.95,
    };
    const fakeProvider: LlmProvider = {
      sendMessage: vi.fn().mockResolvedValue(structuredReply),
    };
    const app = createApp({ llmProvider: fakeProvider });

    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Olá" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(structuredReply);
    expect(fakeProvider.sendMessage).toHaveBeenCalledWith("Olá");
  });

  it("2. mensagem vazia: retorna 400 e não chama o provider", async () => {
    const fakeProvider: LlmProvider = {
      sendMessage: vi.fn(),
    };
    const app = createApp({ llmProvider: fakeProvider });

    const response = await request(app)
      .post("/api/chat")
      .send({ message: "" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).not.toContain("OPENAI_API_KEY");
    expect(fakeProvider.sendMessage).not.toHaveBeenCalled();
  });

  it("2b. body sem o campo message: retorna 400 e não chama o provider", async () => {
    const fakeProvider: LlmProvider = {
      sendMessage: vi.fn(),
    };
    const app = createApp({ llmProvider: fakeProvider });

    const response = await request(app).post("/api/chat").send({});

    expect(response.status).toBe(400);
    expect(fakeProvider.sendMessage).not.toHaveBeenCalled();
  });

  it("3. erro do provider: retorna 502 com mensagem genérica, sem detalhes internos", async () => {
    const fakeProvider: LlmProvider = {
      sendMessage: vi.fn().mockRejectedValue(new LlmError()),
    };
    const app = createApp({ llmProvider: fakeProvider });

    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Olá" });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: { message: "Não foi possível obter resposta da LLM no momento." },
    });
    // nunca deve vazar chave, stack trace ou nome de classe interna
    expect(JSON.stringify(response.body)).not.toMatch(/sk-|OPENAI_API_KEY|stack/i);
  });

  it("3b. erro inesperado (não-AppError) do provider: também não expõe detalhes internos", async () => {
    const fakeProvider: LlmProvider = {
      sendMessage: vi.fn().mockRejectedValue(new Error("detalhe interno sensível")),
    };
    const app = createApp({ llmProvider: fakeProvider });

    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Olá" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { message: "Erro interno do servidor." },
    });
    expect(JSON.stringify(response.body)).not.toContain("detalhe interno sensível");
  });
});
