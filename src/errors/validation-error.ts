import { AppError } from "./app-error";

/**
 * Erro de validação de entrada (ex.: body de request inválido).
 * Sempre HTTP 400.
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}
