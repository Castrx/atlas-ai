import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { RateLimitError } from "../errors/rate-limit-error";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Rate limiting simples em memória, por IP, janela fixa (ver ADR-009 e
 * ADR-025 no PROJECT_SPEC.md). Sem dependência externa nem armazenamento
 * compartilhado (Redis etc.) — suficiente para o único processo Node que
 * serve o Atlas AI hoje; não sobrevive a restart nem escala entre
 * processos/instâncias, o que é aceitável no estágio atual do projeto
 * (Princípio 7 do PROJECT_SPEC.md: não adicionar infraestrutura sem
 * necessidade real).
 *
 * Aplicado só em `/api` (o único endpoint que de fato aciona a LLM e o
 * Atlas ERP) — `/health` fica de fora deliberadamente.
 *
 * Cada chamador (composition root) recebe sua própria instância — em
 * testes, `createApp()` cria um limitador novo por app, então testes nunca
 * compartilham contagem entre si.
 */
export function createRateLimiter(
  windowMs = env.RATE_LIMIT_WINDOW_MS,
  maxRequests = env.RATE_LIMIT_MAX_REQUESTS,
) {
  const buckets = new Map<string, Bucket>();

  return function rateLimit(req: Request, _res: Response, next: NextFunction) {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= maxRequests) {
      next(new RateLimitError());
      return;
    }

    bucket.count += 1;
    next();
  };
}
