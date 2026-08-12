import type { Request, Response } from "express";

/**
 * Health check simples: confirma que o processo está de pé.
 * Não verifica dependências externas — isso não existe ainda nesta etapa.
 */
export function getHealth(_req: Request, res: Response) {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
