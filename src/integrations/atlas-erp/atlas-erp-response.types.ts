/**
 * Formas cruas das respostas HTTP do Atlas ERP (Fase 3b — ver ADR-022 no
 * PROJECT_SPEC.md), tal como a API realmente devolve — antes de qualquer
 * mapeamento para os tipos de domínio consumidos pelas tools
 * (AtlasProduct/AtlasCustomer/AtlasSale/..., definidos em
 * atlas-erp-client.ts). Nenhum campo aqui é inventado: reflete só o que os
 * DTOs reais do Atlas ERP (com.atlas.backend.dto.*) expõem, conferido
 * diretamente no código-fonte do projeto irmão (C:\Users\gabri\atlas-erp).
 *
 * Transcrição manual, não gerada — mantida em sincronia à mão até que haja
 * um contrato compartilhado formal (ex.: OpenAPI), fora do escopo desta
 * fase.
 */

/** Espelha com.atlas.backend.dto.auth.LoginResponse (POST /auth/login). */
export interface AtlasErpLoginResponse {
  token: string;
}

/**
 * Espelha com.atlas.backend.dto.product.ProductResponse (GET /products).
 * Campos que nenhuma tool consome hoje (description, barcode, costPrice,
 * categoryId) continuam listados aqui porque fazem parte da resposta real
 * — o que é ou não mapeado para AtlasProduct é decisão de
 * HttpAtlasErpClient, não deste arquivo.
 */
export interface AtlasErpProductResponse {
  id: number;
  name: string;
  description: string | null;
  sku: string;
  barcode: string | null;
  costPrice: number;
  salePrice: number;
  stock: number;
  minimumStock: number;
  active: boolean;
  categoryId: number;
  categoryName: string;
}

/** Espelha com.atlas.backend.dto.customer.CustomerResponse (GET /customers). */
export interface AtlasErpCustomerResponse {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  document: string;
  active: boolean;
  createdAt: string;
}

/** Espelha com.atlas.backend.dto.sale.SaleItemResponse. */
export interface AtlasErpSaleItemResponse {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

/**
 * Espelha com.atlas.backend.dto.sale.SaleResponse (GET /sales, GET
 * /sales/{id}).
 *
 * IMPORTANTE: este DTO real NÃO tem um campo `status`. A entidade
 * Sale.status existe no Atlas ERP (ACTIVE/CANCELED), mas não é serializada
 * na resposta HTTP de nenhum dos dois endpoints. HttpAtlasErpClient nunca
 * inventa esse valor — ver o comentário em AtlasSale.status
 * (atlas-erp-client.ts) e ADR-023 no PROJECT_SPEC.md.
 */
export interface AtlasErpSaleResponse {
  id: number;
  customerId: number | null;
  customerName: string | null;
  total: number;
  createdBy: string;
  createdAt: string;
  items: AtlasErpSaleItemResponse[];
}

/**
 * Espelha com.atlas.backend.exception.ApiError — corpo de erro padrão
 * devolvido pelo GlobalExceptionHandler do Atlas ERP em qualquer resposta
 * não-2xx. HttpAtlasErpClient nunca repassa `message`/`path` daqui para
 * fora (podem conter detalhe interno do Atlas ERP) — usado só para decidir
 * o desfecho (ex.: 409 em GET /sales/{id} = venda não encontrada).
 */
export interface AtlasErpApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}
