import { describe, expect, it, vi } from "vitest";
import { HttpAtlasErpClient, AtlasErpRequestError } from "../../src/integrations/atlas-erp/http-atlas-erp-client";

/**
 * Testa HttpAtlasErpClient isoladamente, com fetch fake injetado (mesmo
 * padrão de OpenAiProvider, ver ADR-016 no PROJECT_SPEC.md) — nenhuma
 * chamada real de rede/ao Atlas ERP em nenhum teste deste arquivo.
 */

const SERVICE_EMAIL = "atlas-ai@service.local";
const SERVICE_PASSWORD = "correct-horse-battery-staple";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

interface FetchCall {
  url: string;
  init?: RequestInit;
}

/** fetch fake que devolve, em ordem, as respostas passadas ao construir. */
function buildQueuedFetch(responses: Array<Response | Error>) {
  const calls: FetchCall[] = [];
  let index = 0;

  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), init });
    const next = responses[index];
    index += 1;

    if (next === undefined) {
      throw new Error("teste chamou fetch mais vezes do que o script previa");
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });

  return { fetchImpl, calls };
}

function buildClient(fetchImpl: typeof fetch, timeoutMs?: number) {
  return new HttpAtlasErpClient({
    baseUrl: "http://localhost:8080",
    email: SERVICE_EMAIL,
    password: SERVICE_PASSWORD,
    fetchImpl,
    timeoutMs,
  });
}

const rawProduct = {
  id: 1,
  name: "Parafuso",
  description: "desc",
  sku: "SKU-1",
  barcode: null,
  costPrice: 1,
  salePrice: 2.5,
  stock: 3,
  minimumStock: 10,
  active: true,
  categoryId: 1,
  categoryName: "Ferragens",
};

const rawCustomer = {
  id: 1,
  name: "João",
  email: "joao@ex.com",
  phone: "11999990000",
  document: "12345678900",
  active: true,
  createdAt: "2026-01-01T00:00:00",
};

const rawSale = {
  id: 42,
  customerId: 1,
  customerName: "João",
  total: 150.5,
  createdBy: "svc@atlas.local",
  createdAt: "2026-02-10T12:00:00",
  items: [],
};

describe("HttpAtlasErpClient — autenticação", () => {
  it("faz POST /auth/login e envia Authorization: Bearer <token> na chamada seguinte", async () => {
    const { fetchImpl, calls } = buildQueuedFetch([
      jsonResponse(200, { token: "token-123" }),
      jsonResponse(200, [rawProduct]),
    ]);
    const client = buildClient(fetchImpl);

    await client.getProducts({});

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("http://localhost:8080/auth/login");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({
      email: SERVICE_EMAIL,
      password: SERVICE_PASSWORD,
    });

    expect(calls[1].url).toBe("http://localhost:8080/products");
    expect(calls[1].init?.method).toBe("GET");
    expect(calls[1].init?.headers).toMatchObject({
      Authorization: "Bearer token-123",
      "Content-Type": "application/json",
    });
  });

  it("reaproveita o token em memória: só faz login uma vez para duas chamadas", async () => {
    const { fetchImpl, calls } = buildQueuedFetch([
      jsonResponse(200, { token: "token-123" }),
      jsonResponse(200, [rawProduct]),
      jsonResponse(200, [rawCustomer]),
    ]);
    const client = buildClient(fetchImpl);

    await client.getProducts({});
    await client.getCustomers({});

    const loginCalls = calls.filter((c) => c.url.endsWith("/auth/login"));
    expect(loginCalls).toHaveLength(1);
  });

  it("login sem token válido na resposta: lança erro genérico, nunca a senha", async () => {
    const { fetchImpl } = buildQueuedFetch([jsonResponse(200, {})]);
    const client = buildClient(fetchImpl);

    await expect(client.getProducts({})).rejects.toMatchObject({
      message: expect.not.stringContaining(SERVICE_PASSWORD),
    });
  });

  it("nunca inclui e-mail, senha ou token na mensagem de erro de login (401)", async () => {
    const { fetchImpl } = buildQueuedFetch([jsonResponse(401, { message: "E-mail ou senha inválidos." })]);
    const client = buildClient(fetchImpl);

    const failure = client.getProducts({});

    await expect(failure).rejects.toBeInstanceOf(Error);
    await expect(failure).rejects.toMatchObject({
      message: expect.not.stringMatching(new RegExp(SERVICE_PASSWORD)),
    });
    await expect(failure).rejects.toMatchObject({
      message: expect.not.stringContaining(SERVICE_EMAIL),
    });
  });
});

describe("HttpAtlasErpClient — 401/403", () => {
  it("401 na chamada de dado: refaz login uma vez e repete a chamada com sucesso", async () => {
    const { fetchImpl, calls } = buildQueuedFetch([
      jsonResponse(200, { token: "token-velho" }),
      jsonResponse(401, { message: "token expirado" }),
      jsonResponse(200, { token: "token-novo" }),
      jsonResponse(200, [rawProduct]),
    ]);
    const client = buildClient(fetchImpl);

    const result = await client.getProducts({});

    expect(result).toHaveLength(1);
    expect(calls.filter((c) => c.url.endsWith("/auth/login"))).toHaveLength(2);
    expect(calls[3].init?.headers).toMatchObject({ Authorization: "Bearer token-novo" });
  });

  it("403: NÃO tenta relogar (token novo não resolveria falta de permissão) e lança erro", async () => {
    const { fetchImpl, calls } = buildQueuedFetch([
      jsonResponse(200, { token: "token-123" }),
      jsonResponse(403, { message: "Você não tem permissão para executar esta ação." }),
    ]);
    const client = buildClient(fetchImpl);

    await expect(client.getProducts({})).rejects.toBeInstanceOf(AtlasErpRequestError);
    expect(calls.filter((c) => c.url.endsWith("/auth/login"))).toHaveLength(1);
  });
});

describe("HttpAtlasErpClient — códigos de erro HTTP", () => {
  it("404: lança AtlasErpRequestError com o status, sem vazar o corpo da resposta", async () => {
    const { fetchImpl } = buildQueuedFetch([
      jsonResponse(200, { token: "token-123" }),
      jsonResponse(404, { message: "detalhe interno do Atlas ERP" }),
    ]);
    const client = buildClient(fetchImpl);

    const failure = client.getProducts({});

    await expect(failure).rejects.toBeInstanceOf(AtlasErpRequestError);
    await expect(failure).rejects.toMatchObject({ status: 404 });
    await expect(failure).rejects.toMatchObject({
      message: expect.not.stringContaining("detalhe interno do Atlas ERP"),
    });
  });

  it("500: lança AtlasErpRequestError genérico", async () => {
    const { fetchImpl } = buildQueuedFetch([
      jsonResponse(200, { token: "token-123" }),
      jsonResponse(500, { message: "stack trace interno" }),
    ]);
    const client = buildClient(fetchImpl);

    await expect(client.getProducts({})).rejects.toMatchObject({ status: 500 });
  });

  it("409 fora de getSaleById (ex. getProducts): NÃO é tratado como not-found — continua sendo erro", async () => {
    const { fetchImpl } = buildQueuedFetch([
      jsonResponse(200, { token: "token-123" }),
      jsonResponse(409, { message: "conflito" }),
    ]);
    const client = buildClient(fetchImpl);

    await expect(client.getProducts({})).rejects.toMatchObject({ status: 409 });
  });
});

describe("HttpAtlasErpClient — rede/timeout", () => {
  it("erro de rede (fetch rejeita): lança AtlasErpRequestError genérico", async () => {
    const { fetchImpl } = buildQueuedFetch([
      jsonResponse(200, { token: "token-123" }),
      new Error("connect ECONNREFUSED 127.0.0.1:8080"),
    ]);
    const client = buildClient(fetchImpl);

    const failure = client.getProducts({});

    await expect(failure).rejects.toBeInstanceOf(AtlasErpRequestError);
    await expect(failure).rejects.toMatchObject({
      message: expect.not.stringContaining("ECONNREFUSED"),
    });
  });

  it("timeout: aborta a requisição e lança erro em vez de esperar indefinidamente", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (String(url).endsWith("/auth/login")) {
        return jsonResponse(200, { token: "token-123" });
      }

      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });
    const client = buildClient(fetchImpl, 5);

    await expect(client.getProducts({})).rejects.toBeInstanceOf(AtlasErpRequestError);
  });
});

describe("HttpAtlasErpClient — getProducts / getLowStockProducts", () => {
  it("mapeia ProductResponse para AtlasProduct e aplica search/onlyActive client-side", async () => {
    const products = [
      { ...rawProduct, id: 1, name: "Parafuso", sku: "P-1", active: true, stock: 5, minimumStock: 10 },
      { ...rawProduct, id: 2, name: "Porca", sku: "PRC-2", active: false, stock: 100, minimumStock: 10 },
    ];
    const { fetchImpl } = buildQueuedFetch([jsonResponse(200, { token: "t" }), jsonResponse(200, products)]);
    const client = buildClient(fetchImpl);

    const result = await client.getProducts({ onlyActive: true });

    expect(result).toEqual([
      {
        id: 1,
        name: "Parafuso",
        sku: "P-1",
        salePrice: 2.5,
        stock: 5,
        minimumStock: 10,
        active: true,
        category: "Ferragens",
      },
    ]);
  });

  it("getLowStockProducts: filtra active && stock <= minimumStock a partir de GET /products", async () => {
    const products = [
      { ...rawProduct, id: 1, stock: 2, minimumStock: 10, active: true },
      { ...rawProduct, id: 2, stock: 50, minimumStock: 10, active: true },
      { ...rawProduct, id: 3, stock: 1, minimumStock: 10, active: false },
    ];
    const { fetchImpl, calls } = buildQueuedFetch([jsonResponse(200, { token: "t" }), jsonResponse(200, products)]);
    const client = buildClient(fetchImpl);

    const result = await client.getLowStockProducts();

    expect(result.map((p) => p.id)).toEqual([1]);
    expect(calls[1].url).toBe("http://localhost:8080/products");
  });
});

describe("HttpAtlasErpClient — getCustomers", () => {
  it("mapeia CustomerResponse para AtlasCustomer e aplica search client-side", async () => {
    const customers = [
      { ...rawCustomer, id: 1, name: "João Silva", email: "joao@ex.com", document: "111" },
      { ...rawCustomer, id: 2, name: "Maria", email: "maria@ex.com", document: "222" },
    ];
    const { fetchImpl } = buildQueuedFetch([jsonResponse(200, { token: "t" }), jsonResponse(200, customers)]);
    const client = buildClient(fetchImpl);

    const result = await client.getCustomers({ search: "joão" });

    expect(result).toEqual([
      { id: 1, name: "João Silva", email: "joao@ex.com", phone: "11999990000", document: "111", active: true },
    ]);
  });
});

describe("HttpAtlasErpClient — getSales / getSaleById", () => {
  it("getSales: mapeia status sempre como ACTIVE (GET /sales só retorna vendas ativas)", async () => {
    const { fetchImpl } = buildQueuedFetch([jsonResponse(200, { token: "t" }), jsonResponse(200, [rawSale])]);
    const client = buildClient(fetchImpl);

    const result = await client.getSales({});

    expect(result).toEqual([
      { id: 42, customerId: 1, customerName: "João", total: 150.5, status: "ACTIVE", createdAt: rawSale.createdAt },
    ]);
  });

  it("getSales: filtrar por status CANCELLED devolve lista vazia (limite real do endpoint, não bug)", async () => {
    const { fetchImpl } = buildQueuedFetch([jsonResponse(200, { token: "t" }), jsonResponse(200, [rawSale])]);
    const client = buildClient(fetchImpl);

    const result = await client.getSales({ status: "CANCELLED" });

    expect(result).toEqual([]);
  });

  it("getSales: filtra por customerId e período (startDate/endDate) client-side", async () => {
    const sales = [
      { ...rawSale, id: 1, customerId: 1, createdAt: "2026-01-05T10:00:00" },
      { ...rawSale, id: 2, customerId: 2, createdAt: "2026-01-15T10:00:00" },
      { ...rawSale, id: 3, customerId: 1, createdAt: "2026-02-01T10:00:00" },
    ];
    const { fetchImpl } = buildQueuedFetch([jsonResponse(200, { token: "t" }), jsonResponse(200, sales)]);
    const client = buildClient(fetchImpl);

    const result = await client.getSales({ customerId: 1, startDate: "2026-01-01", endDate: "2026-01-31" });

    expect(result.map((s) => s.id)).toEqual([1]);
  });

  it("getSaleById: mapeia com status null (endpoint não filtra nem informa o status real)", async () => {
    const { fetchImpl, calls } = buildQueuedFetch([jsonResponse(200, { token: "t" }), jsonResponse(200, rawSale)]);
    const client = buildClient(fetchImpl);

    const result = await client.getSaleById(42);

    expect(result).toEqual({
      id: 42,
      customerId: 1,
      customerName: "João",
      total: 150.5,
      status: null,
      createdAt: rawSale.createdAt,
    });
    expect(calls[1].url).toBe("http://localhost:8080/sales/42");
  });

  it("getSaleById: 409 (BusinessException 'não encontrada') vira null, não erro", async () => {
    const { fetchImpl } = buildQueuedFetch([
      jsonResponse(200, { token: "t" }),
      jsonResponse(409, { message: "Venda não encontrada." }),
    ]);
    const client = buildClient(fetchImpl);

    await expect(client.getSaleById(999)).resolves.toBeNull();
  });
});

describe("HttpAtlasErpClient — getSalesSummary", () => {
  it("calcula totalSales/totalRevenue/averageTicket a partir de GET /sales, filtrado por período", async () => {
    const sales = [
      { ...rawSale, id: 1, total: 100, createdAt: "2026-01-10T00:00:00" },
      { ...rawSale, id: 2, total: 50, createdAt: "2026-01-20T00:00:00" },
      { ...rawSale, id: 3, total: 999, createdAt: "2026-03-01T00:00:00" },
    ];
    const { fetchImpl } = buildQueuedFetch([jsonResponse(200, { token: "t" }), jsonResponse(200, sales)]);
    const client = buildClient(fetchImpl);

    const result = await client.getSalesSummary({ startDate: "2026-01-01", endDate: "2026-01-31" });

    expect(result).toEqual({
      totalSales: 2,
      totalRevenue: 150,
      averageTicket: 75,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
  });

  it("sem vendas no período: averageTicket é 0 (nunca NaN/Infinity)", async () => {
    const { fetchImpl } = buildQueuedFetch([jsonResponse(200, { token: "t" }), jsonResponse(200, [])]);
    const client = buildClient(fetchImpl);

    const result = await client.getSalesSummary({});

    expect(result).toEqual({ totalSales: 0, totalRevenue: 0, averageTicket: 0, startDate: null, endDate: null });
  });
});

describe("HttpAtlasErpClient — baseUrl", () => {
  it("remove barra final do baseUrl para não duplicar barras na URL final", async () => {
    const { fetchImpl, calls } = buildQueuedFetch([jsonResponse(200, { token: "t" }), jsonResponse(200, [])]);
    const client = new HttpAtlasErpClient({
      baseUrl: "http://localhost:8080/",
      email: SERVICE_EMAIL,
      password: SERVICE_PASSWORD,
      fetchImpl,
    });

    await client.getProducts({});

    expect(calls[1].url).toBe("http://localhost:8080/products");
  });
});
