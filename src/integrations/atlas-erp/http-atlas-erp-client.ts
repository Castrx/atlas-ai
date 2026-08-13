import { logger } from "../../utils/logger";
import { createAtlasErpAuth, type AtlasErpAuth } from "./atlas-erp-auth";
import type {
  AtlasErpClient,
  AtlasProduct,
  AtlasCustomer,
  AtlasSale,
  AtlasSalesSummary,
  GetProductsFilters,
  GetCustomersFilters,
  GetSalesFilters,
  GetSalesSummaryFilters,
} from "./atlas-erp-client";
import type { AtlasErpProductResponse, AtlasErpCustomerResponse, AtlasErpSaleResponse } from "./atlas-erp-response.types";

/**
 * Timeout da chamada HTTP individual ao Atlas ERP. Deliberadamente MENOR
 * que DEFAULT_TOOL_TIMEOUT_MS (5000ms, ver tool-registry.ts): garante que
 * é este cliente quem aborta a requisição (via AbortController) antes que
 * ToolRegistry desista de esperar — evita uma requisição HTTP órfã
 * continuando em segundo plano depois que a tool já foi contabilizada como
 * "timeout".
 */
export const DEFAULT_HTTP_TIMEOUT_MS = 4000;

/**
 * Erro de comunicação com o Atlas ERP (HTTP não-2xx não tratado como
 * desfecho válido, falha de rede, ou timeout). Mensagem sempre genérica —
 * nunca inclui o corpo da resposta, headers (podem conter o token) ou a
 * URL completa. Capturado por ToolRegistry.invoke, que já converte
 * qualquer erro lançado por Tool.execute em `{ status: "execution_error" }`
 * sem repassar a mensagem à LLM (ver ADR-020 no PROJECT_SPEC.md) — a
 * mensagem aqui existe só para diagnóstico em log de servidor.
 */
export class AtlasErpRequestError extends Error {
  constructor(public readonly status?: number) {
    super(status ? `Atlas ERP respondeu com status ${status}.` : "Falha ao comunicar com o Atlas ERP.");
  }
}

export interface HttpAtlasErpClientConfig {
  baseUrl: string;
  email: string;
  password: string;
  /** Injetável para testes (ver ADR-016 no PROJECT_SPEC.md) — nunca chama a rede real nos testes. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function toAtlasProduct(raw: AtlasErpProductResponse): AtlasProduct {
  return {
    id: raw.id,
    name: raw.name,
    sku: raw.sku,
    salePrice: raw.salePrice,
    stock: raw.stock,
    minimumStock: raw.minimumStock,
    active: raw.active,
    category: raw.categoryName ?? null,
  };
}

function toAtlasCustomer(raw: AtlasErpCustomerResponse): AtlasCustomer {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    document: raw.document,
    active: raw.active,
  };
}

/**
 * Converte uma venda crua de GET /sales (lista) para AtlasSale.
 *
 * `status: "ACTIVE"` aqui não é um valor inventado: SaleService.findAll()
 * no Atlas ERP já filtra no servidor por SaleStatus.ACTIVE
 * (saleRepository.findByStatus(ACTIVE)) — toda venda que aparece nesta
 * lista é, por construção do próprio endpoint, ACTIVE. Ver ADR-023 no
 * PROJECT_SPEC.md.
 */
function toAtlasSaleFromList(raw: AtlasErpSaleResponse): AtlasSale {
  return {
    id: raw.id,
    customerId: raw.customerId,
    customerName: raw.customerName,
    total: raw.total,
    status: "ACTIVE",
    createdAt: raw.createdAt,
  };
}

/**
 * Converte a venda crua de GET /sales/{id} para AtlasSale.
 *
 * `status: null` aqui é deliberado: diferente da listagem, este endpoint
 * (SaleService.findById) NÃO filtra por status — devolve a venda
 * independentemente de estar ACTIVE ou CANCELED, e o DTO real não expõe
 * esse campo. Não há como saber o status com segurança, então não
 * inventamos um valor (ver ADR-023 no PROJECT_SPEC.md).
 */
function toAtlasSaleFromById(raw: AtlasErpSaleResponse): AtlasSale {
  return {
    id: raw.id,
    customerId: raw.customerId,
    customerName: raw.customerName,
    total: raw.total,
    status: null,
    createdAt: raw.createdAt,
  };
}

function matchesSearch(term: string | undefined, ...fields: (string | null)[]): boolean {
  if (!term) {
    return true;
  }
  const needle = term.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

function matchesProductFilters(product: AtlasProduct, filters: GetProductsFilters): boolean {
  if (filters.onlyActive && !product.active) {
    return false;
  }
  return matchesSearch(filters.search, product.name, product.sku);
}

function matchesCustomerFilters(customer: AtlasCustomer, filters: GetCustomersFilters): boolean {
  if (filters.onlyActive && !customer.active) {
    return false;
  }
  return matchesSearch(filters.search, customer.name, customer.email, customer.document);
}

/** Compara pela data (AAAA-MM-DD), ignorando a hora de createdAt. */
function matchesDateRange(createdAt: string, range: { startDate?: string; endDate?: string }): boolean {
  const day = createdAt.slice(0, 10);
  if (range.startDate && day < range.startDate) {
    return false;
  }
  if (range.endDate && day > range.endDate) {
    return false;
  }
  return true;
}

function matchesSaleFilters(sale: AtlasSale, filters: GetSalesFilters): boolean {
  if (filters.customerId !== undefined && sale.customerId !== filters.customerId) {
    return false;
  }
  // sale.status é sempre "ACTIVE" aqui (toAtlasSaleFromList) — filtrar por
  // "CANCELLED" devolve legitimamente uma lista vazia, porque GET /sales
  // nunca retorna vendas canceladas (ver ADR-023). Não é um bug: é o
  // limite real e documentado do endpoint.
  if (filters.status !== undefined && sale.status !== filters.status) {
    return false;
  }
  return matchesDateRange(sale.createdAt, filters);
}

/**
 * Implementação real de AtlasErpClient, via HTTP contra a API REST do
 * Atlas ERP (Fase 3b — ver ADR-022 e ADR-023 no PROJECT_SPEC.md).
 *
 * Usa apenas `fetch` nativo do Node — nenhuma dependência HTTP nova (ver
 * decisão da Fase 3b). Somente leitura: só emite GET, nunca POST/PUT/DELETE
 * de dado de negócio (a única exceção é POST /auth/login, autenticação da
 * própria integração, não uma operação de negócio do Atlas ERP).
 *
 * Todo erro (HTTP não-2xx não mapeado, falha de rede, timeout) é lançado
 * como AtlasErpRequestError com mensagem genérica — nunca propaga corpo,
 * headers (Authorization) ou stack trace do Atlas ERP. ToolRegistry.invoke
 * converte qualquer exceção daqui em `{ status: "execution_error" }" antes
 * de chegar perto da LLM (ver ADR-020).
 */
export class HttpAtlasErpClient implements AtlasErpClient {
  private readonly baseUrl: string;
  private readonly auth: AtlasErpAuth;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: HttpAtlasErpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
    this.auth = createAtlasErpAuth(
      { baseUrl: this.baseUrl, email: config.email, password: config.password },
      this.fetchImpl,
    );
  }

  async getProducts(filters: GetProductsFilters): Promise<AtlasProduct[]> {
    const raw = await this.get<AtlasErpProductResponse[]>("/products");
    return raw.map(toAtlasProduct).filter((product) => matchesProductFilters(product, filters));
  }

  /**
   * Não existe endpoint dedicado de estoque baixo no Atlas ERP — só um
   * recorte truncado (top 5) dentro de GET /dashboard. Em vez disso,
   * reaproveitamos GET /products (já sem paginação, mesma chamada usada
   * por getProducts) e filtramos client-side por `active && stock <=
   * minimumStock` — mesmo critério usado pela query real do Atlas ERP
   * (ProductRepository.countLowStockProducts), só que sem o limite de 5
   * itens. Seguro para o volume atual (catálogo pequeno, sem paginação em
   * nenhum dos dois lados); ver ADR-023 no PROJECT_SPEC.md.
   */
  async getLowStockProducts(): Promise<AtlasProduct[]> {
    const raw = await this.get<AtlasErpProductResponse[]>("/products");
    return raw.map(toAtlasProduct).filter((product) => product.active && product.stock <= product.minimumStock);
  }

  async getCustomers(filters: GetCustomersFilters): Promise<AtlasCustomer[]> {
    const raw = await this.get<AtlasErpCustomerResponse[]>("/customers");
    return raw.map(toAtlasCustomer).filter((customer) => matchesCustomerFilters(customer, filters));
  }

  async getSales(filters: GetSalesFilters): Promise<AtlasSale[]> {
    const raw = await this.get<AtlasErpSaleResponse[]>("/sales");
    return raw.map(toAtlasSaleFromList).filter((sale) => matchesSaleFilters(sale, filters));
  }

  /**
   * GET /sales/{id} (SaleService.findById) responde 409 Conflict — não 404
   * — quando a venda não existe (BusinessException, ver GlobalExceptionHandler
   * do Atlas ERP). Esse é o único motivo de falha de negócio possível nesta
   * rota (uma leitura por id não tem outra regra de conflito), então
   * mapeamos 409 para `null` aqui, sempre — ToolRegistry trata `null` como
   * "empty", não como erro (ver ADR-023 no PROJECT_SPEC.md).
   */
  async getSaleById(id: number): Promise<AtlasSale | null> {
    const raw = await this.get<AtlasErpSaleResponse>(`/sales/${id}`, { notFoundOn409: true });
    return raw === null ? null : toAtlasSaleFromById(raw);
  }

  /**
   * Não existe endpoint de resumo com período arbitrário no Atlas ERP —
   * GET /dashboard só dá hoje/mês corrente/últimos 7 dias fixos. Calculamos
   * o resumo a partir dos dados reais de GET /sales (filtrados por
   * startDate/endDate client-side), nunca de um valor fictício. Herda a
   * mesma limitação de getSales: só cobre vendas ACTIVE, porque é só isso
   * que GET /sales retorna (ver ADR-023 no PROJECT_SPEC.md).
   */
  async getSalesSummary(filters: GetSalesSummaryFilters): Promise<AtlasSalesSummary> {
    const raw = await this.get<AtlasErpSaleResponse[]>("/sales");
    const sales = raw.map(toAtlasSaleFromList).filter((sale) => matchesDateRange(sale.createdAt, filters));

    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const averageTicket = totalSales === 0 ? 0 : totalRevenue / totalSales;

    return {
      totalSales,
      totalRevenue,
      averageTicket,
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null,
    };
  }

  /** GET simples (sem tratamento especial de 409) — usado por todas as tools exceto getSaleById. */
  private async get<T>(path: string): Promise<T>;
  private async get<T>(path: string, opts: { notFoundOn409: true }): Promise<T | null>;
  private async get<T>(path: string, opts?: { notFoundOn409?: boolean }): Promise<T | null> {
    let token = await this.auth.getToken();
    let response = await this.fetchWithTimeout(path, token);

    // 401: token expirado/inválido — tenta uma vez com login novo antes de
    // desistir. 403 (autenticado mas sem permissão) NUNCA é reautenticado:
    // um token novo não resolveria um problema de papel/permissão, e
    // tentar de novo só mascararia um erro de configuração real.
    if (response.status === 401) {
      token = await this.auth.getToken(true);
      response = await this.fetchWithTimeout(path, token);
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (opts?.notFoundOn409 && response.status === 409) {
      return null;
    }

    // Log de diagnóstico seguro: nunca inclui o corpo da resposta (pode
    // conter mensagem do Atlas ERP) nem headers (Authorization).
    logger.error("Atlas ERP respondeu com erro", { path, status: response.status });
    throw new AtlasErpRequestError(response.status);
  }

  private async fetchWithTimeout(path: string, token: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } catch (err) {
      // Log de diagnóstico seguro: nunca inclui a URL com querystring nem
      // o header Authorization — só o path e se foi timeout.
      logger.error("Falha de rede ao chamar o Atlas ERP", {
        path,
        aborted: err instanceof Error && err.name === "AbortError",
      });
      throw new AtlasErpRequestError();
    } finally {
      clearTimeout(timer);
    }
  }
}
