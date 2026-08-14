import type { ChatApi, ChatResponse } from "./chat-api.types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

function extractErrorMessage(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: { message?: unknown } }).error?.message === "string"
  ) {
    return (body as { error: { message: string } }).error.message;
  }
  return "Não foi possível obter resposta do Atlas AI no momento.";
}

/**
 * Implementação real do ChatApi: fala com o backend do Atlas AI via
 * POST /api/chat (ver src/controllers/chat.controller.ts). Único módulo
 * do frontend que conhece fetch e a URL da API — nenhum componente chama
 * fetch diretamente.
 */
export function createRealChatApi(): ChatApi {
  return {
    async sendMessage(message: string): Promise<ChatResponse> {
      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
      } catch {
        throw new Error("Não foi possível conectar ao Atlas AI. Verifique sua conexão e tente novamente.");
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error("O Atlas AI respondeu de um jeito inesperado. Tente novamente.");
      }

      if (!response.ok) {
        throw new Error(extractErrorMessage(body));
      }

      return body as ChatResponse;
    },
  };
}
