import type { NextFunction, Request, Response } from "express";

/**
 * Headers HTTP de segurança mínimos, sem dependência externa (ex.: helmet)
 * — ver ADR-009 e ADR-025 no PROJECT_SPEC.md. O Atlas AI serve somente
 * JSON (nunca HTML, nunca assets estáticos), então o CSP mais restritivo
 * possível (`default-src 'none'`) não quebra nada e fecha toda a
 * superfície de injeção de conteúdo.
 *
 * `X-Powered-By` é desligado separadamente via `app.disable("x-powered-by")`
 * em app.ts (recurso nativo do Express, não precisa de header manual aqui).
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  next();
}
