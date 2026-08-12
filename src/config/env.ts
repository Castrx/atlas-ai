import "dotenv/config";
import { z } from "zod";

/**
 * Schema das variáveis de ambiente exigidas pela aplicação.
 * Mantido mínimo em cada etapa — cresce conforme novas fases
 * (LLM, integrações, etc.) forem implementadas.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // OPENAI_API_KEY nunca deve ter um valor default — sua ausência deve
  // derrubar a inicialização (fail-fast), nunca cair silenciosamente
  // em um provider desabilitado.
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY é obrigatória"),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
});

/**
 * Lê e valida as variáveis de ambiente na inicialização (fail-fast).
 * Se a validação falhar, a aplicação não deve subir.
 */
function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Configuração de ambiente inválida:", parsed.error.flatten().fieldErrors);
    throw new Error("Falha ao carregar variáveis de ambiente. Verifique o .env.");
  }

  return parsed.data;
}

export const env = loadEnv();
