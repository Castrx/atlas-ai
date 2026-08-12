import { describe, expect, it, vi } from "vitest";
import { createChatService } from "../../src/services/chat.service";
import type { LlmProvider } from "../../src/llm/llm-provider";
import type { ChatResponse } from "../../src/llm/chat-response.schema";

describe("chatService.sendMessage", () => {
  it("repassa a mensagem ao LlmProvider e devolve a resposta estruturada dele", async () => {
    const structuredReply: ChatResponse = {
      answer: "resposta da LLM",
      intent: "general",
      confidence: 0.9,
    };
    const fakeProvider: LlmProvider = {
      sendMessage: vi.fn().mockResolvedValue(structuredReply),
    };
    const chatService = createChatService(fakeProvider);

    const reply = await chatService.sendMessage("Olá");

    expect(fakeProvider.sendMessage).toHaveBeenCalledWith("Olá");
    expect(reply).toEqual(structuredReply);
  });

  it("propaga o erro lançado pelo LlmProvider sem transformá-lo", async () => {
    const boom = new Error("falha simulada do provider");
    const fakeProvider: LlmProvider = {
      sendMessage: vi.fn().mockRejectedValue(boom),
    };
    const chatService = createChatService(fakeProvider);

    await expect(chatService.sendMessage("Olá")).rejects.toBe(boom);
  });
});
