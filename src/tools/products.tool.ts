import { z } from "zod";
import type { Tool } from "./tool.types";
import type { AtlasErpClient, AtlasProduct } from "../integrations/atlas-erp/atlas-erp-client";

const getProductsArgsSchema = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    onlyActive: z.boolean().optional(),
  })
  .strict();

type GetProductsArgs = z.infer<typeof getProductsArgsSchema>;

/**
 * Lista produtos do Atlas ERP, com filtro opcional por texto (nome/SKU) e
 * por status ativo.
 */
export function createGetProductsTool(client: AtlasErpClient): Tool<GetProductsArgs, AtlasProduct[]> {
  return {
    name: "getProducts",
    description:
      "Lista produtos cadastrados no Atlas ERP. Aceita um termo de busca opcional (nome ou SKU) " +
      "e um filtro opcional para retornar somente produtos ativos.",
    readOnly: true,
    argsSchema: getProductsArgsSchema,
    parametersJsonSchema: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Termo de busca por nome ou SKU do produto.",
        },
        onlyActive: {
          type: "boolean",
          description: "Se verdadeiro, retorna somente produtos ativos.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    execute(args) {
      return client.getProducts(args);
    },
  };
}

const getLowStockProductsArgsSchema = z.object({}).strict();

type GetLowStockProductsArgs = z.infer<typeof getLowStockProductsArgsSchema>;

/**
 * Lista produtos cujo estoque atual está no nível mínimo ou abaixo dele.
 * Não recebe argumentos.
 */
export function createGetLowStockProductsTool(
  client: AtlasErpClient,
): Tool<GetLowStockProductsArgs, AtlasProduct[]> {
  return {
    name: "getLowStockProducts",
    description: "Lista produtos do Atlas ERP cujo estoque atual está no nível mínimo ou abaixo dele.",
    readOnly: true,
    argsSchema: getLowStockProductsArgsSchema,
    parametersJsonSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    execute() {
      return client.getLowStockProducts();
    },
  };
}
