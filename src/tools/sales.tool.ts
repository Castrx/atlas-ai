import { z } from "zod";
import type { Tool } from "./tool.types";
import type { AtlasErpClient, AtlasSale, AtlasSalesSummary } from "../integrations/atlas-erp/atlas-erp-client";

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "formato esperado: AAAA-MM-DD");

const getSalesArgsSchema = z
  .object({
    customerId: z.number().int().positive().optional(),
    status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
  })
  .strict();

type GetSalesArgs = z.infer<typeof getSalesArgsSchema>;

/**
 * Lista vendas do Atlas ERP, com filtros opcionais por cliente, status e
 * período.
 */
export function createGetSalesTool(client: AtlasErpClient): Tool<GetSalesArgs, AtlasSale[]> {
  return {
    name: "getSales",
    description:
      "Lista vendas registradas no Atlas ERP. Aceita filtros opcionais por id do cliente, status " +
      "(ACTIVE ou CANCELLED) e período (startDate/endDate no formato AAAA-MM-DD).",
    readOnly: true,
    argsSchema: getSalesArgsSchema,
    parametersJsonSchema: {
      type: "object",
      properties: {
        customerId: { type: "integer", description: "Id do cliente para filtrar as vendas." },
        status: {
          type: "string",
          enum: ["ACTIVE", "CANCELLED"],
          description: "Status da venda.",
        },
        startDate: { type: "string", description: "Data inicial do período, formato AAAA-MM-DD." },
        endDate: { type: "string", description: "Data final do período, formato AAAA-MM-DD." },
      },
      required: [],
      additionalProperties: false,
    },
    execute(args) {
      return client.getSales(args);
    },
  };
}

const getSaleByIdArgsSchema = z
  .object({
    id: z.number().int().positive(),
  })
  .strict();

type GetSaleByIdArgs = z.infer<typeof getSaleByIdArgsSchema>;

/**
 * Busca uma venda específica do Atlas ERP pelo id. Devolve null se não
 * existir (tratado por ToolRegistry como estado "empty", não como erro).
 */
export function createGetSaleByIdTool(client: AtlasErpClient): Tool<GetSaleByIdArgs, AtlasSale | null> {
  return {
    name: "getSaleById",
    description: "Busca uma venda específica do Atlas ERP pelo seu id.",
    readOnly: true,
    argsSchema: getSaleByIdArgsSchema,
    parametersJsonSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Id da venda a ser buscada." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    execute(args) {
      return client.getSaleById(args.id);
    },
  };
}

const getSalesSummaryArgsSchema = z
  .object({
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
  })
  .strict();

type GetSalesSummaryArgs = z.infer<typeof getSalesSummaryArgsSchema>;

/**
 * Devolve um resumo agregado de vendas do Atlas ERP (total de vendas,
 * receita total, ticket médio) para um período opcional.
 */
export function createGetSalesSummaryTool(
  client: AtlasErpClient,
): Tool<GetSalesSummaryArgs, AtlasSalesSummary> {
  return {
    name: "getSalesSummary",
    description:
      "Devolve um resumo agregado de vendas do Atlas ERP (quantidade de vendas, receita total e " +
      "ticket médio), opcionalmente filtrado por período (startDate/endDate no formato AAAA-MM-DD).",
    readOnly: true,
    argsSchema: getSalesSummaryArgsSchema,
    parametersJsonSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Data inicial do período, formato AAAA-MM-DD." },
        endDate: { type: "string", description: "Data final do período, formato AAAA-MM-DD." },
      },
      required: [],
      additionalProperties: false,
    },
    execute(args) {
      return client.getSalesSummary(args);
    },
  };
}
