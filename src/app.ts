import express from "express";
import { healthRouter } from "./routes/health.routes";
import { createChatRouter } from "./routes/chat.routes";
import { createChatController } from "./controllers/chat.controller";
import { createChatService } from "./services/chat.service";
import { OpenAiProvider } from "./llm/openai-provider";
import { errorHandler } from "./middleware/error-handler";
import type { LlmProvider } from "./llm/llm-provider";

export interface CreateAppOptions {
  /**
   * Permite injetar um LlmProvider (ex.: fake/mock em testes).
   * Quando omitido, usa o OpenAiProvider real — é o único ponto da
   * aplicação que decide isso (composition root).
   */
  llmProvider?: LlmProvider;
}

/**
 * Monta o Express app, sem subir o servidor (sem app.listen).
 * Mantido separado de server.ts para permitir testar o app em memória
 * com Supertest, sem abrir uma porta de rede real.
 */
export function createApp(options: CreateAppOptions = {}) {
  const llmProvider = options.llmProvider ?? new OpenAiProvider();
  const chatService = createChatService(llmProvider);
  const chatController = createChatController(chatService);

  const app = express();

  app.use(express.json());

  app.use(healthRouter);
  app.use("/api", createChatRouter(chatController));

  // Middleware de erro deve ser o último registrado.
  app.use(errorHandler);

  return app;
}
