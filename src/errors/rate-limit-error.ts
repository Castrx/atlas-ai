import { AppError } from "./app-error";

/**
 * Limite de requisições excedido (ver rate limiting em
 * src/middleware/rate-limit.ts e ADR-025 no PROJECT_SPEC.md). Sempre
 * HTTP 429 — mensagem genérica, não revela o limite configurado nem a
 * contagem atual do cliente.
 */
export class RateLimitError extends AppError {
  constructor() {
    super("Muitas requisições. Tente novamente em instantes.", 429);
  }
}
