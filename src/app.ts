import express from "express";
import { healthRouter } from "./routes/health.routes";
import { createChatRouter } from "./routes/chat.routes";
import { createChatController } from "./controllers/chat.controller";
import { createChatService } from "./services/chat.service";
import { OpenAiProvider } from "./llm/openai-provider";
import { errorHandler } from "./middleware/error-handler";
import { securityHeaders } from "./middleware/security-headers";
import { createCors } from "./middleware/cors";
import { createRateLimiter } from "./middleware/rate-limit";
import { createToolRegistry } from "./tools";
import { HttpAtlasErpClient } from "./integrations/atlas-erp/http-atlas-erp-client";
import { env } from "./config/env";
import type { LlmProvider } from "./llm/llm-provider";
import type { ToolRegistry } from "./tools/tool-registry";
import type { AtlasErpClient } from "./integrations/atlas-erp/atlas-erp-client";

function buildDefaultAtlasErpClient(): AtlasErpClient {
  return new HttpAtlasErpClient({
    baseUrl: env.ATLAS_ERP_BASE_URL,
    email: env.ATLAS_ERP_SERVICE_EMAIL,
    password: env.ATLAS_ERP_SERVICE_PASSWORD,
  });
}

export interface CreateAppOptions {
  /**
   * Permite injetar um LlmProvider (ex.: fake/mock em testes).
   * Quando omitido, usa o OpenAiProvider real — é o único ponto da
   * aplicação que decide isso (composition root).
   */
  llmProvider?: LlmProvider;
  /**
   * Permite injetar um ToolRegistry já montado (ex.: com tools fake em
   * testes). Tem prioridade sobre atlasErpClient, se ambos forem passados.
   */
  toolRegistry?: ToolRegistry;
  /**
   * Permite injetar um AtlasErpClient (ex.: fake em testes). Ignorado se
   * toolRegistry for passado diretamente. Quando ambos são omitidos, usa
   * HttpAtlasErpClient real, configurado a partir de
   * ATLAS_ERP_BASE_URL/ATLAS_ERP_SERVICE_EMAIL/ATLAS_ERP_SERVICE_PASSWORD
   * (ver ADR-022 no PROJECT_SPEC.md).
   */
  atlasErpClient?: AtlasErpClient;
}

/**
 * Monta o Express app, sem subir o servidor (sem app.listen).
 * Mantido separado de server.ts para permitir testar o app em memória
 * com Supertest, sem abrir uma porta de rede real.
 */
export function createApp(options: CreateAppOptions = {}) {
  const llmProvider = options.llmProvider ?? new OpenAiProvider();
  const toolRegistry =
    options.toolRegistry ?? createToolRegistry(options.atlasErpClient ?? buildDefaultAtlasErpClient());
  const chatService = createChatService(llmProvider, toolRegistry);
  const chatController = createChatController(chatService);

  const app = express();

  // Não anunciar o framework HTTP usado (ver ADR-025 no PROJECT_SPEC.md).
  app.disable("x-powered-by");

  app.use(securityHeaders);
  app.use(createCors());
  app.use(express.json());

  app.use(healthRouter);
  // Rate limiting só no endpoint que de fato aciona a LLM/Atlas ERP.
  app.use("/api", createRateLimiter(), createChatRouter(chatController));

  // Middleware de erro deve ser o último registrado.
  app.use(errorHandler);

  return app;
}
