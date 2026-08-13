import { describe, expect, it, vi } from "vitest";
import { createGetProductsTool, createGetLowStockProductsTool } from "../../src/tools/products.tool";
import { createGetCustomersTool } from "../../src/tools/customers.tool";
import {
  createGetSalesTool,
  createGetSaleByIdTool,
  createGetSalesSummaryTool,
} from "../../src/tools/sales.tool";
import type { AtlasErpClient } from "../../src/integrations/atlas-erp/atlas-erp-client";

function buildFakeClient(overrides: Partial<AtlasErpClient> = {}): AtlasErpClient {
  return {
    getProducts: vi.fn().mockResolvedValue([]),
    getLowStockProducts: vi.fn().mockResolvedValue([]),
    getCustomers: vi.fn().mockResolvedValue([]),
    getSales: vi.fn().mockResolvedValue([]),
    getSaleById: vi.fn().mockResolvedValue(null),
    getSalesSummary: vi.fn().mockResolvedValue({
      totalSales: 0,
      totalRevenue: 0,
      averageTicket: 0,
      startDate: null,
      endDate: null,
    }),
    ...overrides,
  };
}

describe("getProducts tool", () => {
  it("é somente leitura e repassa argumentos válidos ao AtlasErpClient", async () => {
    const client = buildFakeClient();
    const tool = createGetProductsTool(client);

    expect(tool.readOnly).toBe(true);
    expect(tool.argsSchema.parse({ search: "parafuso", onlyActive: true })).toEqual({
      search: "parafuso",
      onlyActive: true,
    });

    await tool.execute({ search: "parafuso" });

    expect(client.getProducts).toHaveBeenCalledWith({ search: "parafuso" });
  });

  it("rejeita argumentos fora do schema (propriedade desconhecida)", () => {
    const tool = createGetProductsTool(buildFakeClient());

    expect(tool.argsSchema.safeParse({ search: "x", unknownField: 1 }).success).toBe(false);
  });
});

describe("getLowStockProducts tool", () => {
  it("não aceita argumentos e delega ao AtlasErpClient", async () => {
    const client = buildFakeClient();
    const tool = createGetLowStockProductsTool(client);

    expect(tool.argsSchema.parse({})).toEqual({});
    expect(tool.argsSchema.safeParse({ limit: 10 }).success).toBe(false);

    await tool.execute({});

    expect(client.getLowStockProducts).toHaveBeenCalledTimes(1);
  });
});

describe("getCustomers tool", () => {
  it("repassa argumentos válidos ao AtlasErpClient", async () => {
    const client = buildFakeClient();
    const tool = createGetCustomersTool(client);

    await tool.execute({ search: "joão", onlyActive: false });

    expect(client.getCustomers).toHaveBeenCalledWith({ search: "joão", onlyActive: false });
  });
});

describe("getSales tool", () => {
  it("valida status e formato de data", () => {
    const tool = createGetSalesTool(buildFakeClient());

    expect(tool.argsSchema.safeParse({ status: "ACTIVE", startDate: "2026-01-01" }).success).toBe(true);
    expect(tool.argsSchema.safeParse({ status: "PENDENTE" }).success).toBe(false);
    expect(tool.argsSchema.safeParse({ startDate: "01/01/2026" }).success).toBe(false);
  });
});

describe("getSaleById tool", () => {
  it("exige id numérico positivo", () => {
    const tool = createGetSaleByIdTool(buildFakeClient());

    expect(tool.argsSchema.safeParse({}).success).toBe(false);
    expect(tool.argsSchema.safeParse({ id: -1 }).success).toBe(false);
    expect(tool.argsSchema.safeParse({ id: 42 }).success).toBe(true);
  });

  it("devolve null quando a venda não existe (tratado como 'empty' pelo ToolRegistry)", async () => {
    const client = buildFakeClient({ getSaleById: vi.fn().mockResolvedValue(null) });
    const tool = createGetSaleByIdTool(client);

    await expect(tool.execute({ id: 999 })).resolves.toBeNull();
  });
});

describe("getSalesSummary tool", () => {
  it("delega o período ao AtlasErpClient", async () => {
    const client = buildFakeClient();
    const tool = createGetSalesSummaryTool(client);

    await tool.execute({ startDate: "2026-01-01", endDate: "2026-01-31" });

    expect(client.getSalesSummary).toHaveBeenCalledWith({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
  });
});
