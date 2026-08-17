import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      // Placeholders só para satisfazer a validação de env.ts na
      // inicialização. Nenhum teste chama a OpenRouter nem o Atlas ERP de
      // verdade — OpenAiProvider e HttpAtlasErpClient reais nunca são
      // instanciados nos testes, sempre injetamos fakes/mocks em
      // createApp() e em HttpAtlasErpClient (fetch mockado).
      OPENROUTER_API_KEY: "test-placeholder-key",
      ATLAS_ERP_BASE_URL: "http://localhost:8080",
      ATLAS_ERP_SERVICE_EMAIL: "atlas-ai@test-placeholder.local",
      ATLAS_ERP_SERVICE_PASSWORD: "test-placeholder-password",
      NODE_ENV: "test",
    },
  },
});
