/**
 * Modelos de dado devolvidos pelo Atlas ERP, na forma que as tools
 * (src/tools/) consomem. Espelham os campos relevantes das entidades reais
 * do Atlas ERP (Product/Customer/Sale), mas não são as entidades JPA —
 * são a forma que este backend expõe aos consumidores das tools.
 */
export interface AtlasProduct {
  id: number;
  name: string;
  sku: string;
  salePrice: number;
  stock: number;
  minimumStock: number;
  active: boolean;
  category: string | null;
}

export interface AtlasCustomer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  document: string;
  active: boolean;
}

export type AtlasSaleStatus = "ACTIVE" | "CANCELLED";

export interface AtlasSale {
  id: number;
  customerId: number | null;
  customerName: string | null;
  total: number;
  /**
   * `null` quando o Atlas ERP não permite saber o status com segurança
   * (ver ADR-023 no PROJECT_SPEC.md). O DTO real de venda do Atlas ERP
   * (SaleResponse) não expõe `status` — HttpAtlasErpClient nunca inventa
   * esse valor:
   * - em getSales, todo resultado vem de GET /sales, que o próprio Atlas
   *   ERP já filtra para status ACTIVE no servidor (SaleService.findAll) —
   *   "ACTIVE" aqui é uma dedução provada pelo endpoint, não um chute.
   * - em getSaleById, GET /sales/{id} devolve a venda independentemente do
   *   status (não filtra) e o DTO não informa qual é — nesse caso o valor
   *   é sempre `null` ("desconhecido"), nunca um valor inventado.
   */
  status: AtlasSaleStatus | null;
  createdAt: string;
}

export interface AtlasSalesSummary {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  startDate: string | null;
  endDate: string | null;
}

export interface GetProductsFilters {
  search?: string;
  onlyActive?: boolean;
}

export interface GetCustomersFilters {
  search?: string;
  onlyActive?: boolean;
}

export interface GetSalesFilters {
  customerId?: number;
  status?: AtlasSaleStatus;
  startDate?: string;
  endDate?: string;
}

export interface GetSalesSummaryFilters {
  startDate?: string;
  endDate?: string;
}

/**
 * Abstração sobre a integração real com o Atlas ERP (ver ADR-002 e
 * ADR-018 no PROJECT_SPEC.md). As tools (src/tools/) dependem somente
 * desta interface — nunca de HTTP, de uma URL, ou de qualquer detalhe de
 * transporte diretamente.
 *
 * A implementação real (HttpAtlasErpClient, ver arquivo irmão) chama a REST
 * API do Atlas ERP por HTTP, com uma conta de serviço role USER (ver
 * ADR-022 no PROJECT_SPEC.md). NotImplementedAtlasErpClient (também
 * arquivo irmão) continua disponível como fallback explícito e controlado
 * — não é mais o default do composition root, mas permanece útil para
 * cenários em que a integração deve ficar deliberadamente desligada.
 */
export interface AtlasErpClient {
  getProducts(filters: GetProductsFilters): Promise<AtlasProduct[]>;
  getLowStockProducts(): Promise<AtlasProduct[]>;
  getCustomers(filters: GetCustomersFilters): Promise<AtlasCustomer[]>;
  getSales(filters: GetSalesFilters): Promise<AtlasSale[]>;
  getSaleById(id: number): Promise<AtlasSale | null>;
  getSalesSummary(filters: GetSalesSummaryFilters): Promise<AtlasSalesSummary>;
}
