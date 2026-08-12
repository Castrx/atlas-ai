import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      // Placeholder só para satisfazer a validação de env.ts na
      // inicialização. Nenhum teste chama a OpenAI de verdade — o
      // LlmProvider real (OpenAiProvider) nunca é instanciado nos
      // testes, sempre injetamos um fake em createApp().
      OPENAI_API_KEY: "test-placeholder-key",
      NODE_ENV: "test",
    },
  },
});
