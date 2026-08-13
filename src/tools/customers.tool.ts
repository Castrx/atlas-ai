import { z } from "zod";
import type { Tool } from "./tool.types";
import type { AtlasErpClient, AtlasCustomer } from "../integrations/atlas-erp/atlas-erp-client";

const getCustomersArgsSchema = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    onlyActive: z.boolean().optional(),
  })
  .strict();

type GetCustomersArgs = z.infer<typeof getCustomersArgsSchema>;

/**
 * Lista clientes do Atlas ERP, com filtro opcional por texto (nome,
 * e-mail ou documento) e por status ativo.
 */
export function createGetCustomersTool(client: AtlasErpClient): Tool<GetCustomersArgs, AtlasCustomer[]> {
  return {
    name: "getCustomers",
    description:
      "Lista clientes cadastrados no Atlas ERP. Aceita um termo de busca opcional (nome, e-mail ou " +
      "documento) e um filtro opcional para retornar somente clientes ativos.",
    readOnly: true,
    argsSchema: getCustomersArgsSchema,
    parametersJsonSchema: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Termo de busca por nome, e-mail ou documento do cliente.",
        },
        onlyActive: {
          type: "boolean",
          description: "Se verdadeiro, retorna somente clientes ativos.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    execute(args) {
      return client.getCustomers(args);
    },
  };
}
