import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { logger } from "../utils/logger";

/**
 * Middleware central de tratamento de erros (ver ADR-007 no PROJECT_SPEC.md).
 * Único ponto de resposta de erro da aplicação: garante formato consistente
 * e nunca expõe detalhes internos (stack trace, mensagem crua de dependências)
 * ao cliente.
 *
 * Deve ser registrado por último, depois de todas as rotas.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    logger.warn("Erro operacional tratado", {
      path: req.path,
      statusCode: err.statusCode,
      message: err.message,
    });

    return res.status(err.statusCode).json({
      error: {
        message: err.message,
      },
    });
  }

  // Erro não esperado: logamos detalhado internamente, mas nunca o expomos.
  logger.error("Erro não tratado", {
    path: req.path,
    error: err instanceof Error ? err.stack ?? err.message : String(err),
  });

  return res.status(500).json({
    error: {
      message: "Erro interno do servidor.",
    },
  });
}
