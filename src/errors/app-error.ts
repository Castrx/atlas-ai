/**
 * Erro base da aplicação. Erros esperados/de negócio devem estender esta
 * classe para que o middleware central de erro (ver src/middleware/error-handler.ts)
 * saiba como respondê-los sem vazar detalhes internos.
 *
 * Subtipos específicos (ValidationError, LlmError, ToolError, ExternalApiError, ...)
 * serão adicionados nas fases em que fizerem sentido (ver ADR-007 no PROJECT_SPEC.md).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
