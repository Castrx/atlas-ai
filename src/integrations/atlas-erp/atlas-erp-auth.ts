import type { AtlasErpLoginResponse } from "./atlas-erp-response.types";

/**
 * Erro de autenticação com o Atlas ERP (falha de rede no login, HTTP não-2xx
 * em POST /auth/login, ou resposta sem token válido). Mensagem sempre
 * genérica e fixa — nunca inclui e-mail, senha, token ou qualquer parte do
 * corpo da resposta do Atlas ERP (ver Seção 10 do PROJECT_SPEC.md e ADR-022).
 */
export class AtlasErpAuthError extends Error {}

export interface AtlasErpAuthConfig {
  baseUrl: string;
  email: string;
  password: string;
}

export interface AtlasErpAuth {
  /**
   * Devolve um token JWT válido, reaproveitando o último obtido por login
   * enquanto possível (cache em memória do processo). `forceRefresh: true`
   * descarta o token em cache e força um novo POST /auth/login — usado por
   * HttpAtlasErpClient depois de um 401 (token expirado/inválido).
   */
  getToken(forceRefresh?: boolean): Promise<string>;
}

/**
 * Autenticação da conta de serviço do Atlas AI junto ao Atlas ERP (ver
 * ADR-022 no PROJECT_SPEC.md). Único módulo que conhece
 * ATLAS_ERP_SERVICE_EMAIL/ATLAS_ERP_SERVICE_PASSWORD; o token obtido fica
 * só em memória do processo — nunca é logado, nunca é persistido, nunca é
 * devolvido à LLM.
 *
 * A conta de serviço é role USER no Atlas ERP, criada via auto-registro
 * público (POST /auth/register), que sempre cria USER independentemente do
 * que for enviado em `role` — nunca ADMIN (ver AuthenticationService no
 * Atlas ERP). USER já tem acesso de leitura a tudo que as 6 tools
 * precisam — menor privilégio possível (Princípio 2 do PROJECT_SPEC.md).
 *
 * Este módulo nunca decodifica nem confia nos claims do JWT (ver Seção 10
 * do PROJECT_SPEC.md) — só guarda a string do token e a envia como
 * Authorization: Bearer <token>.
 */
export function createAtlasErpAuth(config: AtlasErpAuthConfig, fetchImpl: typeof fetch = fetch): AtlasErpAuth {
  let cachedToken: string | null = null;

  async function login(): Promise<string> {
    let response: Response;

    try {
      response = await fetchImpl(`${config.baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: config.email, password: config.password }),
      });
    } catch {
      // Não logamos a causa crua (pode conter detalhe de rede/host) nem o
      // corpo do request (contém a senha).
      throw new AtlasErpAuthError("Falha ao autenticar no Atlas ERP.");
    }

    if (!response.ok) {
      // Não inclui o corpo da resposta (ApiError.message pode ecoar dado
      // sensível) nem o status — só o fato de que a autenticação falhou.
      throw new AtlasErpAuthError("Falha ao autenticar no Atlas ERP.");
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AtlasErpAuthError("Resposta de login do Atlas ERP não é um JSON válido.");
    }

    const token = (data as Partial<AtlasErpLoginResponse> | null)?.token;

    if (typeof token !== "string" || token.length === 0) {
      throw new AtlasErpAuthError("Resposta de login do Atlas ERP sem token válido.");
    }

    cachedToken = token;
    return cachedToken;
  }

  return {
    async getToken(forceRefresh = false): Promise<string> {
      if (!forceRefresh && cachedToken) {
        return cachedToken;
      }
      return login();
    },
  };
}
