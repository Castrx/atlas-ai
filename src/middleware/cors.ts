import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

/**
 * CORS mínimo, sem dependência externa (ver ADR-009 e ADR-025 no
 * PROJECT_SPEC.md). Sem `CORS_ALLOWED_ORIGIN` configurada (default), nenhum
 * header de CORS é enviado — comportamento idêntico ao que a aplicação já
 * tinha antes desta revisão: só requisições same-origin funcionam a partir
 * de um navegador. Quando configurada, libera exatamente essa origem —
 * nunca "*", e nunca junto de `Access-Control-Allow-Credentials` (a
 * aplicação não usa cookies nem qualquer credencial baseada em navegador).
 *
 * Fábrica (em vez de middleware direto) pelo mesmo motivo do rate limiter
 * (ver rate-limit.ts): permite injetar `allowedOrigin` em teste, sem
 * depender do módulo `env` compartilhado.
 */
export function createCors(allowedOrigin = env.CORS_ALLOWED_ORIGIN) {
  return function cors(req: Request, res: Response, next: NextFunction) {
    const requestOrigin = req.headers.origin;

    if (allowedOrigin && requestOrigin === allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET, POST");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).end();
      return;
    }

    next();
  };
}
