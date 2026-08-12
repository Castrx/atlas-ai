# Atlas AI

Assistente inteligente que utiliza uma LLM (inicialmente a OpenAI API) para responder perguntas sobre os dados do [Atlas ERP](../atlas-erp).

> Status atual: **Fase 2 — Structured Outputs e Prompt Engineering**. O endpoint de chat devolve uma resposta estruturada e validada (`answer`/`intent`/`confidence`), não texto livre.
>
> A especificação completa do projeto — objetivos, arquitetura, roadmap por fases e decisões arquiteturais — está em [`PROJECT_SPEC.md`](./PROJECT_SPEC.md). Este README cobre apenas como rodar o que já existe.

## Stack (até esta etapa)

- Node.js + TypeScript
- Express
- OpenAI SDK (via `LlmProvider` — nunca chamado fora de `src/llm/openai-provider.ts`), com Structured Outputs (`response_format: json_schema`)
- Zod (validação de request, de variáveis de ambiente e da resposta estruturada da LLM)
- Vitest + Supertest (testes; a OpenAI nunca é chamada de verdade em teste automatizado)

## Estrutura

```
src/
├── config/       # leitura/validação de variáveis de ambiente
├── routes/       # definição de endpoints
├── controllers/  # lida com request/response, valida entrada com Zod
├── services/     # orquestração de negócio (ex.: chat.service)
├── llm/          # abstração LlmProvider, OpenAiProvider e o contrato ChatResponse (Zod)
├── prompts/      # prompts de sistema, usados só por OpenAiProvider
├── middleware/   # middlewares Express (ex.: tratamento de erro)
├── errors/       # classes de erro da aplicação
├── utils/        # utilitários (ex.: logger)
├── app.ts        # monta o Express app (composition root)
└── server.ts     # entrypoint (sobe o servidor)
tests/
├── unit/         # testes unitários (chat.service e OpenAiProvider, com fakes)
└── integration/  # testes de integração via Supertest
```

## Como rodar

Pré-requisitos: Node.js 20+ e uma `OPENAI_API_KEY` válida (só necessária para rodar de verdade — os testes não precisam dela).

```bash
npm install
cp .env.example .env
# edite .env e preencha OPENAI_API_KEY com sua chave
npm run dev
```

O servidor sobe em `http://localhost:3000` (porta configurável via `.env`).

Verificar se está no ar:

```bash
curl http://localhost:3000/health
```

Conversar com a LLM:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá"}'
```

Resposta esperada:

```json
{
  "answer": "...",
  "intent": "product_query | sales_query | customer_query | general | unsupported",
  "confidence": 0.0
}
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor em modo desenvolvimento (`tsx`, com watch) |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Roda a versão compilada (`dist/server.js`) |
| `npm test` | Roda os testes (Vitest) |
| `npm run test:watch` | Roda os testes em modo watch |

## Testes

```bash
npm test
```

## Variáveis de ambiente

Ver [`.env.example`](./.env.example).

## Roadmap

Este projeto evolui por fases (LLM básica → structured outputs → tool calling → MCP → RAG → segurança). Detalhes completos em [`PROJECT_SPEC.md`](./PROJECT_SPEC.md).
