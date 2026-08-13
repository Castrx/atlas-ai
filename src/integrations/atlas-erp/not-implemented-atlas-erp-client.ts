import type {
  AtlasErpClient,
  AtlasCustomer,
  AtlasProduct,
  AtlasSale,
  AtlasSalesSummary,
  GetCustomersFilters,
  GetProductsFilters,
  GetSalesFilters,
  GetSalesSummaryFilters,
} from "./atlas-erp-client";

const NOT_IMPLEMENTED_MESSAGE =
  "Integração real com o Atlas ERP ainda não implementada (adiada para a Fase 3b).";

/**
 * Implementação padrão de AtlasErpClient usada pelo composition root
 * (src/app.ts) enquanto a integração HTTP real com o Atlas ERP não existe.
 *
 * Toda tool continua registrada e chamável — a LLM pode pedir para
 * executá-las, ToolRegistry valida os argumentos normalmente — mas a
 * execução falha de forma controlada (vira ToolInvocationResult
 * "execution_error", nunca uma exceção não tratada), o que permite testar
 * e usar toda a orquestração de tool calling de ponta a ponta sem uma
 * integração externa real.
 *
 * Nunca deve ser usada em produção depois que a Fase 3b implementar o
 * client HTTP real — só existe para manter a aplicação executável e
 * honesta sobre o que ainda não faz, em vez de simular dados falsos.
 */
export class NotImplementedAtlasErpClient implements AtlasErpClient {
  getProducts(_filters: GetProductsFilters): Promise<AtlasProduct[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED_MESSAGE));
  }

  getLowStockProducts(): Promise<AtlasProduct[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED_MESSAGE));
  }

  getCustomers(_filters: GetCustomersFilters): Promise<AtlasCustomer[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED_MESSAGE));
  }

  getSales(_filters: GetSalesFilters): Promise<AtlasSale[]> {
    return Promise.reject(new Error(NOT_IMPLEMENTED_MESSAGE));
  }

  getSaleById(_id: number): Promise<AtlasSale | null> {
    return Promise.reject(new Error(NOT_IMPLEMENTED_MESSAGE));
  }

  getSalesSummary(_filters: GetSalesSummaryFilters): Promise<AtlasSalesSummary> {
    return Promise.reject(new Error(NOT_IMPLEMENTED_MESSAGE));
  }
}
