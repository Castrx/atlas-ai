# Atlas AI

Assistente inteligente que responde, em linguagem natural, perguntas sobre os dados reais do [Atlas ERP](../atlas-erp) — produtos, estoque, clientes e vendas — usando uma LLM com Tool Calling e Structured Outputs.

> A especificação completa do projeto — objetivos, arquitetura, roadmap por fases e decisões arquiteturais (ADRs) — está em [`PROJECT_SPEC.md`](./PROJECT_SPEC.md). Este README cobre como entender, rodar e demonstrar o que já existe.

## Problema

Consultar dados de um ERP (estoque baixo, resumo de vendas, um cliente específico) normalmente exige navegar por telas, filtros e relatórios específicos — cada pergunta diferente pode significar uma tela diferente. Para quem só quer uma resposta rápida ("quais produtos estão com estoque baixo?"), isso é fricção desnecessária.

## Solução

O Atlas AI expõe um chat em linguagem natural na frente do Atlas ERP. A LLM nunca inventa dados nem acessa o banco diretamente: quando a pergunta depende de dado real, ela aciona uma de 6 *tools* somente leitura, pré-definidas e validadas pelo backend, que por sua vez consulta a API REST real do Atlas ERP. A resposta final é sempre estruturada e validada (nunca texto livre solto).

## Arquitetura

```
Usuário → Frontend (React) → Atlas AI (Express) → LLM (OpenRouter) → Tool Registry → Atlas ERP (API REST)
```

O backend é um monólito modular em camadas (`routes → controllers → services → llm/tools/integrations`), sem microserviços — ver ADR-002. `LlmProvider` isola o provedor de LLM do resto da aplicação (ADR-003); `ToolRegistry` isola a execução de tools do transporte (ADR-004); `AtlasErpClient` isola a integração com o Atlas ERP (ADR-018). O frontend fala só com a API própria do Atlas AI — nunca diretamente com a LLM ou com o Atlas ERP.

## Stack

**Backend**
- Node.js + TypeScript + Express (ADR-001, ADR-010)
- [OpenRouter](https://openrouter.ai) (API compatível com o padrão OpenAI), modelo `google/gemma-4-26b-a4b-it:free`
- Tool Calling nativo da Chat Completions API (ADR-011, ADR-017)
- Structured Outputs (`response_format: json_schema`, modo strict) + validação independente com Zod (ADR-014)
- Zod — validação de request HTTP, variáveis de ambiente e contrato de resposta (ADR-005)
- JWT — autenticação da conta de serviço do Atlas AI junto ao Atlas ERP (ADR-022)
- Vitest + Supertest — testes (ADR-006)

**Frontend**
- React + Vite + TypeScript

**Infra / CI**
- GitHub Actions (build + testes a cada push/PR)
- Docker — usado para subir a dependência externa (PostgreSQL do Atlas ERP), não pelo próprio Atlas AI

## As 6 tools disponíveis

Todas somente leitura (`readOnly: true`), definidas em `src/tools/` e reunidas em `ToolRegistry` (ADR-017, ADR-020):

| Tool | O que faz |
|---|---|
| `getProducts` | Lista produtos do Atlas ERP, com busca opcional por nome/SKU e filtro por status ativo. |
| `getLowStockProducts` | Lista produtos cujo estoque atual está no nível mínimo ou abaixo dele. |
| `getCustomers` | Lista clientes, com busca opcional por nome/e-mail/documento e filtro por status ativo. |
| `getSales` | Lista vendas, com filtros opcionais por cliente, status (`ACTIVE`/`CANCELLED`) e período. |
| `getSaleById` | Busca uma venda específica pelo id. |
| `getSalesSummary` | Resumo agregado de vendas (quantidade, receita total, ticket médio) para um período opcional. |

Nenhuma tool de escrita existe — a LLM nunca cria, altera nem apaga dado nenhum no Atlas ERP.

## Fluxo de Tool Calling

`ChatService` orquestra o loop; `OpenAiProvider` só traduz entre os tipos da aplicação e o formato da API (ADR-019):

1. A pergunta do usuário vai para a LLM junto com o schema das 6 tools.
2. Se a LLM decidir que precisa de dado real, devolve uma `tool_call` (uma por turno — `parallel_tool_calls: false`, ADR-021).
3. `ToolRegistry` valida os argumentos com Zod e executa a tool contra o Atlas ERP.
4. O resultado da tool volta para a LLM como uma mensagem `role: "tool"` — sempre tratada como **dado**, nunca como instrução (defesa contra prompt injection indireta).
5. O loop repete até a LLM devolver uma resposta final estruturada, até no máximo `MAX_TOOL_ITERATIONS = 5` idas e voltas — se esgotar sem convergir, o backend responde 502 explícito, nunca finge sucesso (ADR-021).

## Integração com o Atlas ERP

`HttpAtlasErpClient` (`src/integrations/atlas-erp/`) fala com a API REST real do Atlas ERP via `fetch` nativo do Node — nenhuma dependência HTTP nova (ADR-022). Autentica como uma **conta de serviço role `USER`** (menor privilégio suficiente, já que as 6 tools são só leitura), guarda o JWT em memória do processo (nunca logado, nunca persistido, nunca devolvido à LLM), e relogar automaticamente uma única vez em caso de 401. Onde a API real do Atlas ERP não corresponde exatamente ao que uma tool promete (ex.: não existe endpoint dedicado de estoque baixo), o contrato é adaptado para refletir a API real — nunca preenchido com dado inventado (ADR-023).

## Segurança e limites arquiteturais

- A LLM **nunca** acessa o banco de dados diretamente e **nunca** executa código ou comandos arbitrários.
- Toda tool exposta à LLM é explicitamente definida, tipada e validada pelo backend antes da execução.
- O resultado de uma tool é sempre tratado como dado, nunca como instrução (defesa contra prompt injection indireta).
- Segredos (chave da OpenRouter, credenciais do Atlas ERP) ficam só em variáveis de ambiente, nunca hardcoded nem versionados — `.env` está no `.gitignore`.
- Erros nunca expõem stack trace, chave, senha, JWT ou detalhe interno ao cliente (middleware de erro centralizado, ADR-007).
- Rate limiting em memória por IP (padrão: 30 req/60s, configurável), CORS explícito por allowlist de uma origem (sem configurar, nenhum header de CORS é enviado) e headers HTTP de segurança (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy: default-src 'none'`, sem `X-Powered-By`) — sem dependência nova, ver ADR-025.
- **Fora de escopo, deliberadamente:** autenticação/autorização/RBAC do próprio endpoint `POST /api/chat` (distinto da autenticação Atlas AI → Atlas ERP, essa sim implementada — ADR-022); o Atlas AI é um assistente single-tenant de demonstração, sem modelo de usuário próprio (ver ADR-025) — assim como MCP (Fase 4) e RAG (Fase 5), avaliados no `PROJECT_SPEC.md` mas fora do escopo atual.

## Como executar o Atlas ERP localmente

O Atlas AI depende de uma instância real do [Atlas ERP](../atlas-erp) rodando. Na raiz do repositório do Atlas ERP:

```bash
cd docker
cp .env.example .env
docker compose up -d postgres   # sobe só o PostgreSQL

cd ../atlas-backend
./mvnw spring-boot:run          # backend do Atlas ERP em http://localhost:8080
```

Crie a conta de serviço que o Atlas AI vai usar via `POST /auth/login` do próprio Atlas ERP: registre um usuário comum (`POST /auth/register`, que sempre cria papel `USER`, nunca `ADMIN`) e use esse e-mail/senha nas variáveis `ATLAS_ERP_SERVICE_*` do Atlas AI. Detalhes completos de execução do Atlas ERP (incluindo a stack completa em containers) estão no README daquele repositório.

## Como executar o backend do Atlas AI

Pré-requisitos: Node.js 20+, uma `OPENROUTER_API_KEY` válida e o Atlas ERP rodando (seção acima).

```bash
npm install
cp .env.example .env
# edite .env: OPENROUTER_API_KEY e as variáveis ATLAS_ERP_*
npm run dev
```

O servidor sobe em `http://localhost:3001` (porta configurável via `.env`).

```bash
curl http://localhost:3001/health

curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá"}'
```

## Como executar o frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Sobe em `http://localhost:5173` (padrão do Vite). Em desenvolvimento, o Vite faz proxy de `/api` para `http://localhost:3001` (`vite.config.ts`) — não precisa de CORS no backend.

## Variáveis de ambiente

Ver [`.env.example`](./.env.example) (backend) e [`frontend/.env.example`](./frontend/.env.example). Nenhum valor real é versionado.

**Backend:**

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | Não (default `3001`) | Porta do servidor HTTP |
| `NODE_ENV` | Não (default `development`) | `development` \| `test` \| `production` |
| `OPENROUTER_API_KEY` | **Sim** | Chave da API da OpenRouter — sem default, aplicação não sobe sem ela |
| `OPENROUTER_BASE_URL` | Não (default `https://openrouter.ai/api/v1`) | URL base da API da OpenRouter |
| `OPENROUTER_MODEL` | Não (default `google/gemma-4-26b-a4b-it:free`) | Modelo usado nas chamadas |
| `ATLAS_ERP_BASE_URL` | **Sim** | URL base da API do Atlas ERP (sem barra final) |
| `ATLAS_ERP_SERVICE_EMAIL` / `ATLAS_ERP_SERVICE_PASSWORD` | **Sim** | Credenciais da conta de serviço role `USER` do Atlas ERP |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | Não (default `60000` / `30`) | Janela e limite do rate limiting em `/api` (ADR-025) |
| `CORS_ALLOWED_ORIGIN` | Não (default: nenhum header de CORS) | Origem única liberada para CORS, ex.: `http://localhost:5173` (ADR-025) |

**Frontend:** `VITE_USE_MOCK_API` e `VITE_API_BASE_URL` — ver seção seguinte.

## MockChatApi vs RealChatApi

O frontend alterna entre as duas implementações de `ChatApi` via `frontend/.env` (composition root em `src/App.tsx`):

- `VITE_USE_MOCK_API=true` (padrão) → `MockChatApi`, sem nenhuma dependência do backend — útil para desenvolver a UI isoladamente.
- `VITE_USE_MOCK_API=false` → `RealChatApi`, fala com o Atlas AI de verdade via `POST /api/chat` (`VITE_API_BASE_URL`, default `/api`).

## Testes e build

```bash
npm test          # Vitest — 76 testes (unit + integração via Supertest)
npm run build     # compila o backend (TypeScript) para dist/
```

A LLM e o Atlas ERP **nunca** são chamados de verdade em teste automatizado — `LlmProvider` e `AtlasErpClient` são sempre fake/mock (ADR-006, ADR-016).

Frontend:

```bash
cd frontend
npm run build     # tsc -b && vite build
```

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) roda a cada `push`/`pull_request`, em dois jobs paralelos:

- **backend:** `npm ci` → `npm test` → `npm run build`.
- **frontend:** `npm ci` → `npm run build` (`tsc -b && vite build`). O frontend não tem suíte de testes automatizada nem lint configurado ainda — o build é, hoje, a única verificação automatizável que existe para ele; nada foi inventado para preencher essa lacuna.

Não há deploy automatizado.

## Limitação conhecida: latência do modelo gratuito

O modelo atual (`google/gemma-4-26b-a4b-it:free`, camada `:free` da OpenRouter) tem latência **alta e variável** — de poucos segundos a dezenas de segundos por chamada, em uma requisição típica com duas chamadas ao LLM (Tool Calling + Structured Output final). Investigação registrada em **ADR-024**: a variância não é explicada por tamanho de payload, `response_format` nem por parâmetro de sampling configurado pela aplicação (nenhum é definido) — a hipótese mais sustentada pelos testes é fila/capacidade compartilhada do provider gratuito, não um gargalo do Atlas ERP nem da orquestração do Atlas AI.

## Exemplo de uso real

Pergunta: **"Quais produtos estão com estoque baixo?"**

1. A LLM identifica que precisa de dado real e chama a tool `getLowStockProducts`.
2. `ToolRegistry` executa a tool, que consulta o Atlas ERP real (`GET /products`, filtrado por `active && stock <= minimumStock`).
3. O resultado volta para a LLM como dado.
4. A LLM devolve uma resposta estruturada e validada:

```json
{
  "answer": "Os produtos com estoque baixo são: ...",
  "intent": "product_query",
  "confidence": 1
}
```
