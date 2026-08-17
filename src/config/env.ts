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

  // OPENROUTER_API_KEY nunca deve ter um valor default — sua ausência deve
  // derrubar a inicialização (fail-fast), nunca cair silenciosamente
  // em um provider desabilitado.
  //
  // Adaptação temporária (ver contexto da conversa): usamos a OpenRouter
  // (API compatível com o padrão OpenAI) em vez da OpenAI diretamente,
  // para evitar custo enquanto testamos com um modelo gratuito.
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY é obrigatória"),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL: z.string().min(1).default("google/gemma-4-26b-a4b-it:free"),

  // Integração real com o Atlas ERP (Fase 3b, ver ADR-022 no
  // PROJECT_SPEC.md). Nenhuma tem default: sua ausência deve derrubar a
  // inicialização (fail-fast), mesmo princípio já aplicado a
  // OPENROUTER_API_KEY. A conta de serviço é role USER (menor privilégio
  // suficiente para as 6 tools, todas somente leitura).
  ATLAS_ERP_BASE_URL: z.string().url("ATLAS_ERP_BASE_URL deve ser uma URL válida"),
  ATLAS_ERP_SERVICE_EMAIL: z.string().email("ATLAS_ERP_SERVICE_EMAIL deve ser um e-mail válido"),
  ATLAS_ERP_SERVICE_PASSWORD: z.string().min(1, "ATLAS_ERP_SERVICE_PASSWORD é obrigatória"),
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
