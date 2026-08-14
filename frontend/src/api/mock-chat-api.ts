import type { ChatApi, ChatResponse } from "./chat-api.types";

const SIMULATED_LATENCY_MS = 650;

/**
 * Dados fixos usados pelas respostas do mock — espelham os dados de
 * demonstração reais do Atlas ERP (DemoDataRunner, DEMO_DATA=true), lidos
 * via API em 2026-08-14 para validar os números abaixo. Mantidos aqui como
 * constantes (não importados do backend) para o mock continuar sem
 * qualquer chamada externa; se o dataset de demonstração mudar, estes
 * valores precisam ser atualizados manualmente.
 */
const PRODUCTS = [
  { name: "Notebook Gamer 15\"", category: "Informática", price: "R$ 5.299,00", stock: 5, minimumStock: 2 },
  { name: "Teclado Mecânico TKL", category: "Periféricos", price: "R$ 449,00", stock: 8, minimumStock: 3 },
  { name: "Mouse Sem Fio", category: "Periféricos", price: "R$ 149,00", stock: 12, minimumStock: 5 },
  { name: "Monitor 27\" 4K", category: "Eletrônicos", price: "R$ 2.199,00", stock: 2, minimumStock: 3 },
  { name: "Cadeira Ergonômica", category: "Escritório", price: "R$ 1.199,00", stock: 1, minimumStock: 2 },
  { name: "Caixa de Som Bluetooth", category: "Acessórios", price: "R$ 229,00", stock: 0, minimumStock: 2 },
  { name: "Webcam Full HD", category: "Acessórios", price: "R$ 299,00", stock: 7, minimumStock: 2 },
  { name: "Impressora Multifuncional", category: "Escritório", price: "R$ 949,00", stock: 3, minimumStock: 1 },
] as const;

const LOW_STOCK_PRODUCTS = PRODUCTS.filter((p) => p.stock <= p.minimumStock);

const CUSTOMERS = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Elisa Nunes"] as const;

const SALES = [
  { id: 1, customer: "Ana Souza", totalValue: 5448, total: "R$ 5.448,00", items: 'Notebook Gamer 15" (1x R$ 5.299,00) e Mouse Sem Fio (1x R$ 149,00)' },
  { id: 2, customer: "Bruno Lima", totalValue: 1197, total: "R$ 1.197,00", items: "Teclado Mecânico TKL (2x R$ 449,00) e Webcam Full HD (1x R$ 299,00)" },
  { id: 3, customer: "Carla Dias", totalValue: 2428, total: "R$ 2.428,00", items: 'Monitor 27" 4K (1x R$ 2.199,00) e Caixa de Som Bluetooth (1x R$ 229,00)' },
  { id: 4, customer: "Diego Rocha", totalValue: 1199, total: "R$ 1.199,00", items: "Cadeira Ergonômica (1x R$ 1.199,00)" },
  { id: 5, customer: "Elisa Nunes", totalValue: 1398, total: "R$ 1.398,00", items: "Impressora Multifuncional (1x R$ 949,00) e Teclado Mecânico TKL (1x R$ 449,00)" },
] as const;

const TOTAL_REVENUE = "R$ 11.670,00";
const AVERAGE_TICKET = "R$ 2.334,00";

/** Extrai o número de venda citado na pergunta (ex.: "venda #3", "venda 3"). */
function extractSaleId(normalized: string): number | null {
  const match = normalized.match(/venda[s]?\s*(?:n[º°o]?\.?\s*)?#?\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Respostas fixas para demonstração, baseadas nos dados reais do Atlas ERP
 * (DEMO_DATA=true — ver PRODUCTS/CUSTOMERS/SALES acima), cobrindo os
 * cenários combinados: produtos, estoque baixo, clientes, vendas, resumo de
 * vendas, uma venda específica e uma pergunta fora do escopo. Ordem
 * importa: a primeira condição que casar decide a resposta — os casos mais
 * específicos (venda por número, resumo, estoque baixo) vêm antes dos
 * genéricos ("produto", "cliente", "venda").
 */
function matchResponse(message: string): ChatResponse {
  const normalized = message.trim().toLowerCase();

  // 6. Pergunta sobre uma venda específica (ex.: "o que foi vendido na venda #3?").
  if (normalized.includes("venda") || normalized.includes("vend")) {
    const saleId = extractSaleId(normalized);
    if (saleId !== null) {
      const sale = SALES.find((s) => s.id === saleId);
      if (sale) {
        return {
          answer: `A venda #${sale.id} foi para ${sale.customer}, no total de ${sale.total}: ${sale.items}.`,
          intent: "sales_query",
          confidence: 0.91,
        };
      }
      return {
        answer: `Não encontrei a venda #${saleId} nos dados de demonstração. Há vendas registradas de #1 a #${SALES.length}.`,
        intent: "sales_query",
        confidence: 0.6,
      };
    }
  }

  // 5. Resumo de vendas (agregado, distinto da listagem simples).
  if (normalized.includes("resumo") && (normalized.includes("venda") || normalized.includes("vend"))) {
    const topSale = SALES.reduce((max, sale) => (sale.totalValue > max.totalValue ? sale : max), SALES[0]);
    return {
      answer:
        `Resumo de vendas: ${SALES.length} vendas ativas, faturamento total de ${TOTAL_REVENUE} ` +
        `e ticket médio de ${AVERAGE_TICKET}. Maior venda: #${topSale.id}, de ${topSale.customer}, ${topSale.total}.`,
      intent: "sales_query",
      confidence: 0.89,
    };
  }

  // 2. Produtos com estoque baixo.
  if (normalized.includes("estoque") && /baix[ao]/.test(normalized)) {
    const list = LOW_STOCK_PRODUCTS.map((p) => `"${p.name}" (${p.stock} un., mínimo ${p.minimumStock})`).join(", ");
    return {
      answer: `Encontrei ${LOW_STOCK_PRODUCTS.length} produtos com estoque no nível mínimo ou abaixo: ${list}.`,
      intent: "product_query",
      confidence: 0.88,
    };
  }

  // 1. Produtos cadastrados.
  if (normalized.includes("produto")) {
    const examples = PRODUCTS.slice(0, 3)
      .map((p) => `${p.name} (${p.price})`)
      .join(", ");
    return {
      answer:
        `O Atlas ERP tem ${PRODUCTS.length} produtos cadastrados, todos ativos, distribuídos entre ` +
        `Informática, Periféricos, Eletrônicos, Escritório e Acessórios. Exemplos: ${examples}.`,
      intent: "product_query",
      confidence: 0.92,
    };
  }

  // 3. Clientes cadastrados.
  if (normalized.includes("cliente")) {
    return {
      answer: `Há ${CUSTOMERS.length} clientes cadastrados no Atlas ERP, todos ativos: ${CUSTOMERS.join(", ")}.`,
      intent: "customer_query",
      confidence: 0.9,
    };
  }

  // 4. Vendas (listagem geral).
  if (normalized.includes("venda") || normalized.includes("vend")) {
    const list = SALES.map((s) => `#${s.id} ${s.customer} (${s.total})`).join(", ");
    return {
      answer: `Foram registradas ${SALES.length} vendas, somando ${TOTAL_REVENUE}: ${list}.`,
      intent: "sales_query",
      confidence: 0.85,
    };
  }

  // 7. Fora do escopo deste assistente (ver CHAT_SYSTEM_PROMPT no backend).
  return {
    answer:
      "Ainda estou em modo de demonstração e não tenho uma resposta específica para essa pergunta. " +
      "Tente perguntar sobre produtos, estoque, clientes ou vendas.",
    intent: "unsupported",
    confidence: 0.5,
  };
}

/**
 * Implementação mock do ChatApi — mesma interface do RealChatApi, para
 * que trocar uma pela outra em App.tsx nunca exija tocar em nenhum
 * componente. Usada enquanto o backend real (LLM via OpenRouter) não
 * está estável (ver ADR-022/discussão de migração no PROJECT_SPEC.md).
 */
export function createMockChatApi(): ChatApi {
  return {
    async sendMessage(message: string): Promise<ChatResponse> {
      await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
      return matchResponse(message);
    },
  };
}
