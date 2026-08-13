import { ToolRegistry } from "./tool-registry";
import { createGetProductsTool, createGetLowStockProductsTool } from "./products.tool";
import { createGetCustomersTool } from "./customers.tool";
import { createGetSalesTool, createGetSaleByIdTool, createGetSalesSummaryTool } from "./sales.tool";
import type { AtlasErpClient } from "../integrations/atlas-erp/atlas-erp-client";

/**
 * Monta o ToolRegistry com as 6 tools de leitura da Fase 3 (ver ADR-020 no
 * PROJECT_SPEC.md), todas dependentes somente da abstração AtlasErpClient
 * — nunca de HTTP, URL ou SQL diretamente.
 */
export function createToolRegistry(client: AtlasErpClient): ToolRegistry {
  return new ToolRegistry([
    createGetProductsTool(client),
    createGetLowStockProductsTool(client),
    createGetCustomersTool(client),
    createGetSalesTool(client),
    createGetSaleByIdTool(client),
    createGetSalesSummaryTool(client),
  ]);
}

export { ToolRegistry } from "./tool-registry";
export type { Tool, ToolDescriptor, ToolInvocationResult } from "./tool.types";
