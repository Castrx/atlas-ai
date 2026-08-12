import { describe, expect, it, vi } from "vitest";
import { createChatService } from "../../src/services/chat.service";
import type { LlmProvider } from "../../src/llm/llm-provider";

describe("chatService.sendMessage", () => {
  it("repassa a mensagem ao LlmProvider e devolve a resposta dele", async () => {
    const fakeProvider: LlmProvider = {
      sendMessage: vi.fn().mockResolvedValue("resposta da LLM"),
    };
    const chatService = createChatService(fakeProvider);

    const reply = await chatService.sendMessage("Olá");

    expect(fakeProvider.sendMessage).toHaveBeenCalledWith("Olá");
    expect(reply).toBe("resposta da LLM");
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
