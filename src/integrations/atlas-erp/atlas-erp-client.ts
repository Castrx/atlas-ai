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
  status: AtlasSaleStatus;
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
 * A implementação real (chamando a REST API do Atlas ERP por HTTP, com a
 * conta de serviço dedicada definida no plano da Fase 3) é adiada para a
 * Fase 3b, por instrução explícita. Nesta fase, o composition root usa
 * NotImplementedAtlasErpClient (ver arquivo irmão), que deixa toda a
 * orquestração (ToolRegistry, ChatService, tratamento de erro) completa e
 * testável, sem depender de uma integração externa ainda inexistente.
 */
export interface AtlasErpClient {
  getProducts(filters: GetProductsFilters): Promise<AtlasProduct[]>;
  getLowStockProducts(): Promise<AtlasProduct[]>;
  getCustomers(filters: GetCustomersFilters): Promise<AtlasCustomer[]>;
  getSales(filters: GetSalesFilters): Promise<AtlasSale[]>;
  getSaleById(id: number): Promise<AtlasSale | null>;
  getSalesSummary(filters: GetSalesSummaryFilters): Promise<AtlasSalesSummary>;
}
