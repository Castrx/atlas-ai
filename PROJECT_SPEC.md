# Atlas AI — Especificação Oficial do Projeto

> **Este documento é a fonte de verdade do Atlas AI.** Qualquer nova sessão de trabalho (humana ou de agente, incluindo uma nova sessão do Claude Code sem memória de conversas anteriores) deve conseguir entender contexto, objetivos, arquitetura, limites e roadmap **apenas lendo este arquivo**.

Status: **Fase 0 — Especificação.** Nenhum código de aplicação foi escrito ainda.

---

## 1. CONTEXTO

O **Atlas ERP** (`C:\Users\gabri\atlas-erp`) é o projeto anterior, **oficialmente concluído**. É um ERP modular para PMEs com:

- Java 21 · Spring Boot 3.5 · Spring Security · Spring Data JPA
- PostgreSQL 17 · Flyway
- JWT (stateless) · RBAC (`ADMIN`/`USER`)
- React 19 · TypeScript · Vite · MUI
- Docker · Nginx
- Testes automatizados (JUnit + Testcontainers no backend, Vitest + RTL no frontend)
- GitHub Actions (CI/CD)

O **Atlas AI** é um **projeto novo e separado**, em repositório próprio (`C:\Users\gabri\atlas-ai`), que **poderá se integrar** ao Atlas ERP consumindo sua API REST — nunca acoplando-se diretamente ao seu banco de dados.

---

## 2. OBJETIVO DO ATLAS AI

Criar um assistente inteligente que utiliza uma LLM via API (inicialmente **OpenAI API**) para responder perguntas sobre os dados do Atlas ERP.

**O objetivo não é criar apenas um chatbot.** O projeto existe para demonstrar, de forma prática e com profundidade técnica real, conhecimento em:

- integração com APIs de LLM;
- prompt engineering;
- structured outputs;
- tool/function calling;
- integração entre sistemas;
- MCP (Model Context Protocol);
- RAG (Retrieval-Augmented Generation);
- segurança de aplicações com LLM;
- testes automatizados;
- arquitetura de software.

---

## 3. VISÃO DO PRODUTO

O usuário faz perguntas em linguagem natural sobre o Atlas ERP. Exemplo:

> "Quais produtos estão com estoque abaixo de 10 unidades?"

Fluxo-alvo (evolui por fase — ver Roadmap):

1. o sistema interpreta a intenção do usuário;
2. decide se precisa usar uma ferramenta (*tool*);
3. solicita a tool específica à LLM;
4. o **backend valida** a solicitação da tool;
5. o backend consulta a **API do Atlas ERP** (não o banco diretamente);
6. os dados retornam para a LLM;
7. a LLM gera uma resposta estruturada e compreensível para o usuário.

**Regra inegociável:** a LLM nunca acessa o banco de dados diretamente. Toda leitura de dados passa pelo backend do Atlas AI, que por sua vez consulta a API REST do Atlas ERP.

---

## 4. PRINCÍPIOS

1. Segurança antes de conveniência.
2. Menor privilégio.
3. A LLM nunca acessa diretamente o banco.
4. Ferramentas (*tools*) devem ser explicitamente definidas — sem ferramentas genéricas ou abertas.
5. O backend valida toda operação solicitada pela LLM antes de executá-la.
6. Dados sensíveis não devem ser enviados desnecessariamente para a LLM.
7. Não adicionar tecnologia sem necessidade.
8. Não implementar funcionalidades apenas para "engordar" o currículo.
9. Priorizar entendimento técnico sobre volume de features.
10. Manter a arquitetura simples quando uma solução simples for suficiente.

---

## 5. STACK INICIAL

> Definida para o início do projeto. Pode ser revista posteriormente **se houver justificativa técnica registrada** na seção [Decisões Arquiteturais](#13-decisões-arquiteturais).

**Backend**
- Node.js
- TypeScript
- Express
- OpenAI SDK

**Testes**
- Vitest

**Frontend**
- React
- TypeScript

**Ferramentas**
- Git / GitHub
- Docker (quando necessário)

---

## 6. ARQUITETURA (visão-alvo, evolutiva por fase)

```
Usuário
  │
  ▼
Frontend (React + TS)
  │  HTTP
  ▼
Atlas AI Backend (Node.js + TS + Express)
  │
  ├─► OpenAI API (LLM: interpretação, structured outputs, decisão de tool call)
  │
  └─► Tool Layer (definida e validada pelo backend)
         │
         ▼
      Atlas ERP API (REST, já existente)
         │
         ▼
      PostgreSQL (Atlas ERP) — nunca acessado diretamente pelo Atlas AI
```

Responsabilidades:

- **Frontend**: interface de chat/consulta. Sem lógica de negócio ou de segurança.
- **Atlas AI Backend**: orquestra a conversa com a LLM, define e valida as tools, aplica autenticação/autorização, chama a API do Atlas ERP, trata erros.
- **LLM (OpenAI API)**: interpreta intenção, decide chamadas de ferramenta, formata resposta. Não tem acesso direto a nenhum dado ou sistema — só o que o backend explicitamente fornece.
- **Atlas ERP API**: fonte de dados real, já protegida por JWT/RBAC própria.

---

## 7. RELAÇÃO COM O ATLAS ERP

- O Atlas AI é um **projeto e repositório independentes**.
- Inicialmente (Fase 1–2) deve ser **desenvolvível sem depender do Atlas ERP** rodando.
- A partir da Fase 3 (Tool Calling), poderá **consumir a API REST do Atlas ERP**.
- **Nunca** se conectar diretamente ao banco de dados do Atlas ERP.

---

## 8. ROADMAP

### Fase 0 — Especificação (atual)
Definir arquitetura, stack, responsabilidades, limites, segurança e critérios de conclusão.
**Critério de conclusão:** este documento (`PROJECT_SPEC.md`) aprovado.

### Fase 1 — MVP LLM
Aplicação mínima capaz de: receber uma mensagem → enviar à OpenAI API → receber resposta → retornar ao usuário via API REST própria.

Inclui: variáveis de ambiente, tratamento de erros, validação de entrada, testes.

**Critério de conclusão:** um usuário consegue enviar uma pergunta e receber uma resposta da LLM através da API do Atlas AI.

### Fase 2 — Structured Outputs e Prompt Engineering
Prompts estruturados, respostas estruturadas (schemas), validação de respostas, técnicas de prompt engineering — evitar depender de texto livre quando a aplicação precisa de dados estruturados.

### Fase 3 — Tool Calling
Ferramentas controladas pelo backend, ex.: `getProducts`, `getLowStockProducts`, `getCustomers`, `getSales`, `getSaleById`, `getSalesSummary`.

Fluxo: Usuário → AI Backend → LLM → Tool Call → Backend valida → Atlas ERP API → Resultado → LLM → Resposta.

A LLM não terá acesso direto ao banco.

### Fase 4 — MCP
Avaliar e só implementar Model Context Protocol **se houver benefício real e justificativa arquitetural/educacional** — não por popularidade da tecnologia.

### Fase 5 — RAG
Embeddings, vector store, retrieval, documentação do Atlas como contexto — permitir que o sistema use conhecimento externo/contextual antes de responder.

### Fase 6 — Segurança
Avaliar e implementar: prompt injection, validação de tool calls, autenticação, autorização, RBAC, proteção de dados, limites de ferramentas, controle de acesso, rate limiting quando necessário, proteção contra abuso.

**A LLM nunca deve receber autoridade irrestrita sobre o sistema.**

---

## 9. O QUE NÃO FAZER AGORA

Fora do escopo até que a fase correspondente seja alcançada e justificada:

- RAG
- MCP
- autenticação complexa
- vector database
- microserviços
- Kubernetes
- infraestrutura cloud
- múltiplos provedores de LLM
- agentes autônomos complexos

---

## 10. SEGURANÇA — LIMITES ARQUITETURAIS

- A LLM **nunca** acessa o banco de dados diretamente.
- A LLM **nunca** executa código ou comandos arbitrários.
- Toda tool exposta à LLM é **explicitamente definida, tipada e validada pelo backend** antes da execução.
- O backend é responsável por autenticação, autorização e RBAC — a LLM não decide permissões.
- Dados sensíveis não são enviados à LLM além do estritamente necessário para a resposta.
- Segredos (API keys, credenciais) ficam apenas em variáveis de ambiente, nunca hardcoded ou versionados.

---

## 11. CRITÉRIOS DE QUALIDADE

O projeto deve manter, continuamente:

- código organizado e com separação de responsabilidades;
- tratamento de erros;
- validação de entrada/saída;
- testes automatizados;
- documentação atualizada;
- uso correto de variáveis de ambiente;
- práticas de segurança aplicadas;
- README profissional;
- CI (quando o projeto estiver suficientemente estável).

---

## 12. CRITÉRIO FINAL DE CONCLUSÃO

O Atlas AI será considerado concluído quando, simultaneamente:

- a integração com a LLM estiver funcionando;
- o tool calling estiver funcionando;
- a integração com o Atlas ERP estiver funcionando;
- a segurança tiver sido revisada;
- os testes estiverem passando;
- a documentação estiver completa;
- o CI estiver funcionando;
- o projeto estiver pronto para demonstração e portfólio.

---

## 13. DECISÕES ARQUITETURAIS

> Registro cronológico de decisões técnicas tomadas durante o desenvolvimento, com contexto e justificativa. Atualizado conforme o projeto evolui. Decisões ainda em aberto não são registradas aqui até estarem suficientemente definidas.

### ADR-001 — Express como framework HTTP

**Decisão:** Usar Express como framework HTTP do backend no MVP.
**Contexto:** O spec já define Node.js + TypeScript + Express como stack inicial (Seção 5); era preciso confirmar que isso é suficiente para a arquitetura em camadas proposta.
**Alternativas consideradas:** NestJS (DI e módulos prontos); Fastify (mais performático, schema-first).
**Justificativa:** Express é minimalista, bem documentado e não impõe estrutura opinativa. Para o volume de rotas do MVP, os ganhos de DI do Nest ou de performance do Fastify não compensam a complexidade adicional. A separação em camadas é obtida por organização de pastas, não pelo framework.

### ADR-002 — Monólito modular em camadas, sem microserviços

**Decisão:** Organizar o backend como monólito modular em camadas (`routes → controllers → services → llm/tools/integrations`).
**Contexto:** O projeto precisa evoluir por várias fases (LLM simples → structured outputs → tools → MCP → RAG → segurança) sem reescrita completa.
**Alternativas consideradas:** microserviços desde o início (vetado pela Seção 9 do spec); arquitetura hexagonal formal com portas/adaptadores (avaliada como cerimônia excessiva para o MVP).
**Justificativa:** Fronteiras claras entre camadas dão isolamento suficiente para trocar implementações (provedor de LLM, tools, integrações) sem o custo operacional de múltiplos serviços que o projeto não precisa agora (Princípios 7 e 10).

### ADR-003 — Abstração do provedor de LLM (`LlmProvider`)

**Decisão:** Criar uma interface `LlmProvider` com `OpenAiProvider` como única implementação no MVP.
**Contexto:** A Fase 1 usa somente a OpenAI API; o spec evita múltiplos provedores por ora, mas o restante do código não deve depender diretamente do SDK da OpenAI.
**Alternativas consideradas:** chamar o SDK da OpenAI direto no service (rejeitado — acopla toda a lógica de negócio ao SDK); adotar uma lib de abstração multi-provider pronta como LangChain (rejeitado — tecnologia extra sem necessidade comprovada, esconde o aprendizado que é objetivo do projeto).
**Justificativa:** A interface é código próprio, sem dependência nova, e permite mockar a LLM em testes (ver ADR-006) sem introduzir suporte a múltiplos provedores antes da hora.

### ADR-004 — Camada de Tools desacoplada do transporte

**Decisão:** Modelar tools como módulos independentes de protocolo (`{ name, schema, handler }`), reunidas em um `ToolRegistry`, chamadas apenas pela service layer.
**Contexto:** A Fase 3 introduz tool calling e a Fase 4 avalia MCP; ambas dependem de "o que é uma tool" já estar bem definido.
**Alternativas consideradas:** implementar tools ad-hoc dentro do service de chat só quando a Fase 3 chegar (rejeitado — geraria retrabalho); adotar o MCP SDK já na Fase 1 (rejeitado — o spec exige que MCP só entre com justificativa real, Fase 4).
**Justificativa:** Uma camada de tools agnóstica de protocolo permite que, se o MCP for adotado na Fase 4, ele apenas exponha o `ToolRegistry` já existente via outro protocolo — sem reescrever validação/execução.

### ADR-005 — Validação com Zod (request HTTP e variáveis de ambiente)

**Decisão:** Usar Zod para validar o body das requisições HTTP e as variáveis de ambiente na inicialização.
**Contexto:** A Fase 1 exige validação como critério de conclusão; a Fase 2 exigirá schemas para structured outputs.
**Alternativas consideradas:** validação manual via `if`/`throw` (rejeitada — repetitiva e sujeita a erro); Joi/Yup (rejeitadas — sem vantagem sobre Zod e sem o precedente de uso já existente no Atlas ERP).
**Justificativa:** Zod dá validação declarativa com tipos TypeScript inferidos, cobre request e env vars com a mesma ferramenta, e antecipa a necessidade de schemas estruturados da Fase 2.

### ADR-006 — Testes com Vitest + Supertest; LLM sempre mockada

**Decisão:** Usar Vitest para testes unitários e Supertest para testes de integração da API HTTP. Nenhum teste automatizado chama a API real da OpenAI — `LlmProvider` é sempre mockado.
**Contexto:** A Fase 1 exige testes; a aplicação depende de um serviço externo pago que não deve ser chamado em CI.
**Alternativas consideradas:** testar contra a API real da OpenAI em CI (rejeitado — custo financeiro, não-determinismo, exposição de chave); testar só a camada unitária sem cobrir a HTTP (rejeitado — não cobre erros de rota/serialização).
**Justificativa:** Supertest testa o Express app em memória, sem servidor real nem rede; mockar `LlmProvider` (viabilizado pelo ADR-003) mantém os testes rápidos, determinísticos e sem custo.

### ADR-007 — Tratamento de erros centralizado

**Decisão:** Definir uma hierarquia mínima de erros (`AppError` e subtipos como `ValidationError`, `LlmError`, `ToolError`, `ExternalApiError`) e um único middleware Express de tratamento de erro, que nunca expõe detalhe interno ao cliente.
**Contexto:** A Fase 1 exige tratamento de erros; o Atlas ERP já registrou como lição a necessidade de esconder detalhes internos de erro.
**Alternativas consideradas:** tratar erros localmente em cada controller com try/catch repetido (rejeitado — duplicação e formato de resposta inconsistente).
**Justificativa:** Um único ponto de tratamento garante resposta de erro consistente, facilita a revisão de segurança da Fase 6 e reaproveita uma lição já aprendida no projeto irmão.

### ADR-008 — Observabilidade mínima no MVP

**Decisão:** Usar um logger próprio e mínimo (wrapper fino sobre `console`, saída estruturada), sem adotar biblioteca de logging externa por ora.
**Contexto:** Não há requisito de produção/deploy que justifique logging estruturado avançado, métricas ou tracing no MVP.
**Alternativas consideradas:** adotar `pino` desde já (rejeitado por ora — dependência extra sem consumidor real, como agregador de logs ou ambiente de produção).
**Justificativa:** Segue o Princípio 7 do spec (não adicionar tecnologia sem necessidade). O wrapper próprio isola o ponto de troca: adotar uma lib depois é uma troca de implementação, não uma reescrita.

### ADR-009 — Hardening de segurança de rede adiado para a Fase 6

**Decisão:** Rate limiting, allowlist de CORS e headers de segurança HTTP (ex. `helmet`) não entram no MVP; ficam reservados para a Fase 6, quando houver exposição real (frontend, deploy).
**Contexto:** A Fase 1 roda localmente, sem frontend externo nem exposição pública. Os limites estruturais de segurança do spec (LLM nunca acessa o banco, tools explícitas e validadas, segredos em env vars) já valem desde já, por serem permanentes e não itens de fase.
**Alternativas consideradas:** aplicar `helmet` e rate limiting desde o início "por precaução" (rejeitado — sem ameaça real ainda, contraria o Princípio 7 e a Seção 9 do spec).
**Justificativa:** Evita complexidade prematura mantendo, ao mesmo tempo, os limites de segurança estruturais já ativos desde a Fase 1.

### ADR-010 — Express 5.x (não fixado em 4.x)

**Decisão:** Instalar Express na major version 5.x (`^5.2.1`), em vez de fixar a 4.x, mantida como padrão de mercado por mais tempo.
**Contexto:** ADR-001 já definiu Express como framework HTTP, sem especificar a major version. No scaffolding (instalação sem pin de versão), o npm trouxe a 5.x, atualmente a versão estável publicada como `latest`.
**Alternativas consideradas:** fixar em `^4.x` (mais usada historicamente em tutoriais e no ecossistema legado) para reduzir risco de comportamento novo/menos documentado.
**Justificativa:** O Express 5 encaminha automaticamente erros de handlers `async` (rejeições de Promise) para o middleware de erro via `next()`, sem precisar de try/catch manual em cada rota — reforça diretamente o tratamento de erros centralizado do ADR-007. Não há dependência do projeto que exija Express 4. Documentado aqui para que não pareça uma escolha acidental caso alguém note a versão depois.

### ADR-011 — Uso da Chat Completions API

**Decisão:** Utilizar a Chat Completions API da OpenAI (`client.chat.completions.create`) na primeira implementação do Atlas AI, mantendo a abstração `LlmProvider` como fronteira de troca caso a API utilizada precise ser substituída no futuro.
**Contexto:** A Fase 1 exige apenas enviar uma mensagem e receber uma resposta em texto — sem histórico, sem tools, sem structured outputs (isso é Fase 2/3). Era preciso escolher entre a Chat Completions API (mensagens `role`/`content`, amplamente documentada e estável) e a Responses API, mais recente e desenhada com tool calling/structured outputs em mente.
**Alternativas consideradas:** Responses API (`client.responses.create`) — mais alinhada ao que as Fases 2 e 3 vão exigir, mas com superfície maior e menos necessária para o escopo mínimo desta etapa; adotá-la agora seria antecipar complexidade sem benefício imediato (Princípio 7 do spec).
**Justificativa:** A Chat Completions API é suficiente e mais simples para o objetivo atual (uma mensagem → uma resposta). Como `OpenAiProvider` é a única implementação de `LlmProvider` e nenhum outro módulo conhece o SDK da OpenAI (ADR-003), migrar para a Responses API mais adiante — se as Fases 2/3 justificarem — é uma troca isolada dentro de um único arquivo, não uma mudança arquitetural.

### ADR-012 — Mapeamento de falhas do LLM Provider para HTTP 502

**Decisão:** Falhas do provider de LLM (erro de rede, autenticação, indisponibilidade da OpenAI, resposta sem conteúdo utilizável) são mapeadas para uma `LlmError` (subtipo de `AppError`) com HTTP 502 Bad Gateway e mensagem genérica para o cliente — nunca stack trace, chave, status ou tipo de erro do SDK.
**Contexto:** A Fase 1 exige tratamento de erro adequado; a aplicação depende de um serviço externo (OpenAI) cujas falhas não são culpa do cliente nem do próprio backend, mas de um upstream.
**Alternativas consideradas:** HTTP 500 genérico (rejeitado — esconde que a causa é uma dependência externa, dificultando diagnóstico/observabilidade); HTTP 503 Service Unavailable (avaliado — mais associado à indisponibilidade do próprio servidor/sobrecarga; 502 comunica melhor "o upstream que este servidor consulta falhou", semântica de gateway); repassar o status HTTP original da OpenAI ao cliente (rejeitado — acopla o contrato da nossa API ao de um fornecedor específico e pode vazar detalhe irrelevante ao consumidor).
**Justificativa:** 502 é o código mais correto semanticamente para "este servidor atua como gateway para um serviço externo que falhou". A resposta permanece genérica (mensagem fixa) em todos os casos, com o detalhe real (status/tipo do erro da OpenAI) apenas logado no servidor — reforça o mesmo princípio já registrado no ADR-007 (nunca expor detalhe interno ao cliente).

### ADR-013 — Contrato estruturado de resposta (`answer`/`intent`/`confidence`)

**Decisão:** A resposta da LLM deixa de ser texto livre e passa a seguir um contrato estruturado e validado: `{ answer: string, intent: "product_query" | "sales_query" | "customer_query" | "general" | "unsupported", confidence: number (0–1) }`. `intent` classifica a pergunta por domínio, sem decidir nem nomear uma tool específica. `confidence` reflete a confiança da LLM na classificação de `intent`, não a veracidade factual de `answer`.
**Contexto:** A Fase 2 exige evoluir de "mensagem → texto" para uma resposta estruturada; a Visão do Produto (Seção 3) já prevê "interpretar a intenção do usuário" como primeiro passo do fluxo-alvo, antes de qualquer decisão de tool (Fase 3).
**Alternativas consideradas:** `intent` mapeado 1:1 às tools já previstas para a Fase 3 no Roadmap (`getProducts`, `getSalesSummary`, etc.) — rejeitado, pois antecipa Tool Calling antes da hora e acopla a Fase 2 a decisões de implementação da Fase 3; contrato genérico sem `intent`/`confidence` (só `answer`) — rejeitado, pois não demonstraria structured output/prompt engineering de forma significativa, objetivo explícito do projeto (Seção 2).
**Justificativa:** Agrupar por domínio (produtos, vendas, clientes) mais `general`/`unsupported` dá sinal útil para a Fase 3 sem decidir tool nenhuma. Documentar que `confidence` é autoavaliada pela LLM (sinal conhecidamente imperfeito) evita dar a ela mais peso do que merece — decisão consciente, não ingênua.

### ADR-014 — JSON Schema próprio para `response_format` + validação independente com Zod

**Decisão:** O JSON Schema enviado à OpenAI via `response_format` (Structured Outputs, modo strict) é escrito à mão — não derivado de `z.toJSONSchema()` — contendo só `type`/`enum`/`required`/`additionalProperties`. O `chatResponseSchema` (Zod completo, com `min`/`max`/`min(1)`) permanece a única fonte de verdade para validação real da resposta e para o tipo TypeScript, e é sempre aplicado após a resposta chegar, independentemente do que a OpenAI garantiu.
**Contexto:** Testado durante a análise da Fase 2: `z.toJSONSchema()` (Zod v4, nativo) gera `minLength`/`minimum`/`maximum`, palavras-chave não suportadas pelo modo strict do Structured Outputs da OpenAI — o guardrail da OpenAI cobre a *forma* do JSON, não restrições numéricas/de tamanho.
**Alternativas consideradas:** usar `z.toJSONSchema()` direto e confiar que a OpenAI ignoraria as palavras-chave não suportadas (rejeitado — comportamento não documentado como garantido, risco desnecessário); usar o helper `zodResponseFormat` do SDK da OpenAI (avaliado — evitado por incerteza de compatibilidade com Zod v4 nesta versão do SDK; preferiu-se não introduzir essa dependência implícita sem necessidade comprovada, Princípio 7); confiar apenas no Structured Outputs e não validar de novo com Zod (rejeitado — violaria o Princípio 1, "segurança antes de conveniência": nunca confiar cegamente em dado vindo de fora, mesmo de um provedor "confiável").
**Justificativa:** Duas representações do contrato, cada uma com seu papel: o JSON Schema manual restringe a *forma* durante a geração (reduz mas não elimina erro); o Zod completo é a validação semântica real e independente, que de fato cumpre o requisito de "validar a resposta com Zod" — testado explicitamente (`tests/unit/openai-provider.test.ts`, casos 7 e 7b) simulando uma resposta que passaria pelo modo strict da OpenAI mas viola o contrato semântico.

### ADR-015 — Camada de prompts dedicada

**Decisão:** Prompts de sistema vivem em `src/prompts/`, usados exclusivamente por `OpenAiProvider`. Nem `ChatController` nem `ChatService` conhecem o texto do prompt.
**Contexto:** A Fase 2 exige explicitamente uma camada de prompt dedicada, "sem colocar prompts diretamente no controller". A arquitetura original (ADR-002) já reservava `src/prompts/` para esta fase, mas a pasta estava vazia desde o scaffolding.
**Alternativas consideradas:** prompt inline dentro de `OpenAiProvider.sendMessage` (rejeitado — dificulta localizar/revisar o texto que instrui a LLM, e o pedido explícito é por uma camada dedicada); prompt construído pelo `ChatService` e passado como parâmetro ao `LlmProvider` (rejeitado — acoplaria a interface `LlmProvider` a detalhes de como instruir especificamente um modelo OpenAI a produzir o contrato `ChatResponse`, quando esse é um detalhe de implementação de `OpenAiProvider`, não do contrato abstrato "enviar mensagem, receber resposta estruturada").
**Justificativa:** Mantém `LlmProvider.sendMessage(message: string): Promise<ChatResponse>` simples e estável — qualquer implementação futura de `LlmProvider` (outro provedor) é livre para instruir seu próprio modelo como precisar, desde que honre o mesmo contrato de saída. `src/prompts/` fica isolado, legível e é o único lugar que cresce quando a Fase 5 (RAG) precisar injetar contexto adicional no prompt.

### ADR-016 — Injeção do client OpenAI em `OpenAiProvider`

**Decisão:** O construtor de `OpenAiProvider` passa a aceitar um client OpenAI opcional (`Pick<OpenAI, "chat">`), com default `new OpenAI({ apiKey: env.OPENAI_API_KEY })`. Mesmo padrão de injeção já usado em `createApp({ llmProvider })`.
**Contexto:** Até a Fase 1, `OpenAiProvider` nunca foi testado diretamente — todo teste substituía o `LlmProvider` inteiro por um fake, deixando a lógica interna de `OpenAiProvider` (agora: montagem do `response_format`, parsing de JSON, validação com Zod, tratamento de `refusal`) sem nenhuma cobertura de teste.
**Alternativas consideradas:** `vi.mock("openai")` para simular o módulo inteiro (rejeitado — mais frágil a mudanças na API do SDK e menos explícito sobre o que está sendo simulado do que um objeto injetado com tipo conhecido); continuar sem testar `OpenAiProvider` diretamente, confiando só nos testes de integração com `LlmProvider` fake (rejeitado — deixaria sem cobertura justamente a lógica nova mais arriscada desta fase: parsing e validação de saída não confiável de um serviço externo).
**Justificativa:** Reaproveita um padrão de injeção de dependência já estabelecido no projeto (consistência arquitetural) em vez de introduzir uma técnica de mock diferente. Permite testar determinísticamente, sem rede, os cinco casos de falha exigidos nesta fase (JSON inválido, schema inválido, campo obrigatório ausente, `refusal`, erro de chamada) — ver `tests/unit/openai-provider.test.ts`.

### ADR-017 — Tool calling nativo da OpenAI, restrito a um conjunto fechado de tools somente leitura

**Decisão:** A Fase 3 dá à LLM acesso a dados reais do Atlas ERP através do mecanismo nativo de function calling da Chat Completions API (`tools`/`tool_choice`/`parallel_tool_calls`), exclusivamente por um conjunto fechado de 6 tools somente leitura: `getProducts`, `getLowStockProducts`, `getCustomers`, `getSales`, `getSaleById`, `getSalesSummary`. A LLM nunca acessa o banco de dados, nunca executa código arbitrário, nunca recebe nem produz URLs/SQL, e não existe nenhuma tool de escrita.
**Contexto:** O objetivo do Atlas AI (Seção 2) é responder perguntas sobre dados reais do Atlas ERP; a Seção 9 ("O que não fazer agora") veta acesso direto a banco e tools de escrita nesta fase; a Seção 10 exige que segredos e decisões sensíveis nunca dependam da LLM.
**Alternativas consideradas:** dar à LLM acesso direto a uma API genérica de query/SQL (rejeitado terminantemente pela Seção 9/10 do spec); usar RAG (embeddings sobre um dump dos dados) em vez de tool calling (avaliado — adiado para a Fase 5: dado de ERP é estruturado e mutável, tool calling responde com o valor atual; RAG é mais adequado para conteúdo textual/documental); tools ad-hoc sem registro central (rejeitado — o ADR-004 já havia decidido por uma camada de tools desacoplada e reunida em `ToolRegistry`).
**Justificativa:** Function calling nativo é suportado diretamente pela Chat Completions API já em uso (ADR-011), sem dependência nova. Restringir a um conjunto fechado e somente leitura de tools é a defesa estrutural mais forte contra os riscos previstos para esta fase (escrita indevida, exfiltração, injeção indireta): mesmo que a LLM seja manipulada por conteúdo malicioso vindo de uma tool, só pode acionar uma tool já allowlisted e de leitura — nunca escalar para escrita, URL ou execução de código.

### ADR-018 — Abstração `AtlasErpClient`, com integração HTTP real adiada para a Fase 3b

**Decisão:** As tools dependem somente da interface `AtlasErpClient` (`src/integrations/atlas-erp/`), nunca de HTTP/URL diretamente. Nesta fase, o composition root usa `NotImplementedAtlasErpClient` — todas as operações rejeitam de forma controlada e logada. A implementação HTTP real (autenticação via conta de serviço dedicada, papel `USER` no RBAC já existente do Atlas ERP) fica para a Fase 3b, por instrução explícita do usuário.
**Contexto:** A Fase 3 foi explicitamente delimitada para não incluir integração real com o Atlas ERP nem autenticação Atlas AI → Atlas ERP.
**Alternativas consideradas:** simular dados falsos dentro das tools até a integração real existir (rejeitado — daria a falsa impressão de que a LLM está respondendo com dado real do Atlas ERP, contrariando o princípio de nunca inventar/mascarar dado, reforçado no prompt de sistema); adiar também a criação da interface `AtlasErpClient` e das tools para a Fase 3b (rejeitado — impediria testar e demonstrar de ponta a ponta a orquestração de tool calling, que é o núcleo real desta fase).
**Justificativa:** A abstração isola exatamente a peça que falta (a chamada HTTP real) sem bloquear o que é essencial na Fase 3 — orquestração, validação, registry, tratamento de erro. Falhar de forma explícita, controlada e logada (`execution_error`) é mais honesto do que fingir sucesso com dado inventado, e mantém toda a superfície de teste determinística.

### ADR-019 — `ChatService` orquestra o loop de tool calling; `OpenAiProvider` só traduz (`LlmProvider.converse`)

**Decisão:** `LlmProvider.sendMessage(string)` é substituído por `LlmProvider.converse(messages: LlmMessage[], tools: ToolDescriptor[]): Promise<LlmTurnResult>`. `ChatService` é o único responsável por decidir quando chamar uma tool, quando parar, e por acumular o histórico da conversa; `OpenAiProvider` só traduz entre os tipos próprios da aplicação e o formato de request/response da OpenAI, nunca executa uma tool nem conhece `ToolRegistry`.
**Contexto:** Era preciso decidir onde vive o loop de tool calling: dentro de `OpenAiProvider` (que já fala com a OpenAI) ou em `ChatService` (camada de orquestração de negócio) — discutido no planejamento da Fase 3 como "Approach A" (loop dentro do provider) vs. "Approach B" (loop no service).
**Alternativas consideradas:** Approach A — loop de tool calling inteiro dentro de `OpenAiProvider`, chamando `ToolRegistry` internamente (rejeitado — violaria o ADR-003/ADR-004: acoplaria a camada de tradução do SDK da OpenAI à execução de tools, tornando impossível trocar de provedor de LLM no futuro sem duplicar a lógica de orquestração).
**Justificativa:** Manter `OpenAiProvider` como tradutor puro reafirma o ADR-003/ADR-004 já registrados — qualquer `LlmProvider` futuro (outro modelo/provedor) reaproveita o mesmo `ChatService` sem reescrever a lógica de quando/como chamar tools. `ChatService.sendMessage(message: string): Promise<ChatResponse>` mantém sua assinatura pública inalterada desde a Fase 1.

### ADR-020 — Contrato `Tool`/`ToolRegistry` e taxonomia de resultado de invocação

**Decisão:** `Tool<Args, Result>` é uma interface própria (`name`, `description`, `argsSchema` em Zod, `readOnly: true` como literal de tipo, `parametersJsonSchema`, `execute`), reunida em um `ToolRegistry` com registro estático explícito (lookup fechado, sem descoberta dinâmica). `ToolRegistry.invoke` nunca lança exceção: todo desfecho vira um `ToolInvocationResult` com 6 estados (`ok`, `empty`, `invalid_arguments`, `unknown_tool`, `execution_error`, `timeout`). O JSON Schema enviado à OpenAI para os parâmetros de cada tool é escrito à mão em formato padrão (sem modo strict) — propriedades opcionais simplesmente ficam fora de `required` — e o Zod (`argsSchema`) continua sendo a única validação de fato aplicada aos argumentos antes de qualquer execução.
**Contexto:** O ADR-014 já havia estabelecido, para a resposta final, JSON Schema manual em modo strict + validação Zod independente; era preciso decidir se o modo strict também seria usado para os parâmetros das 6 tools desta fase.
**Alternativas consideradas:** aplicar modo strict também aos parâmetros das tools, exigindo todas as propriedades em `required` com tipos union incluindo `null` para simular opcionalidade (avaliado — tecnicamente possível, mas adiciona complexidade de tradução Zod↔JSON Schema em 6 schemas diferentes sem ganho real de segurança, já que a validação que de fato importa é sempre o Zod, nunca o schema enviado à OpenAI); derivar os JSON Schemas automaticamente com `z.toJSONSchema()` (rejeitado pelo mesmo motivo do ADR-014 — produz palavras-chave não suportadas); permitir que `ToolRegistry.invoke` lance exceção em caso de falha (rejeitado — obrigaria `ChatService` a ter tratamento por tipo de falha, e um erro de tool não deve necessariamente encerrar a conversa: a LLM pode reagir a "cliente não encontrado" e tentar de outra forma).
**Justificativa:** Consistente com o princípio já registrado no ADR-014 ("nunca confiar cegamente no que a LLM/OpenAI garante, mesmo com guardrails do provedor") — o schema enviado à OpenAI é só um guia para gerar melhores argumentos; a aplicação de fato da regra é sempre o Zod. `ToolInvocationResult` como dado (nunca exceção) permite que `ChatService` trate cada desfecho de forma uniforme, inclusive devolvendo-o à LLM como contexto para tentar de novo, sem precisar de tratamento de erro ad-hoc por tipo de falha de tool.

### ADR-021 — Limites de orquestração do tool calling e `ToolError` para esgotamento de `MAX_TOOL_ITERATIONS`

**Decisão:** `parallel_tool_calls` é sempre `false` (uma tool call por turno); cada mensagem do usuário permite no máximo `MAX_TOOL_ITERATIONS = 5` idas-e-voltas de tool calling; cada execução de tool tem um timeout de `DEFAULT_TOOL_TIMEOUT_MS = 5000`ms. Se `MAX_TOOL_ITERATIONS` for esgotado sem a LLM chegar a uma resposta final, `ChatService` lança `ToolError` (novo subtipo de `AppError`, HTTP 502, mensagem genérica) — **nunca** devolve um `ChatResponse` "aparentemente válido" (ex.: `{ intent: "unsupported", confidence: 0 }`). Diagnóstico de segurança (contagem de iterações, nomes das tools tentadas — nunca argumentos ou conteúdo da conversa) é logado no servidor antes de lançar o erro.
**Contexto:** A proposta original de planejamento da Fase 3 tratava o esgotamento do limite como um `ChatResponse` degradado; revisão explícita do usuário rejeitou essa abordagem por misturar uma falha de orquestração do servidor com uma resposta normal da LLM, o que poderia induzir o cliente a tratar um erro como sucesso.
**Alternativas consideradas para o esgotamento do limite:** A) HTTP 502 genérico reaproveitando `LlmError` como já existia (rejeitado — perde a distinção entre "a OpenAI falhou" e "a orquestração não convergiu apesar de a OpenAI sempre responder", a mesma mensagem genérica confundiria as duas causas nos logs); B) HTTP 500 genérico (rejeitado — comunica "erro interno inesperado", quando na verdade é um limite de segurança conhecido e desenhado de propósito, não um bug); D) HTTP 504 Gateway Timeout (rejeitado — o limite é de contagem de iterações, não de tempo; sinalizaria a causa errada ao cliente). C) (escolhida) uma classe de erro própria (`ToolError`), com identidade e mensagem distintas de `LlmError`, mapeada para o mesmo código 502 já estabelecido pelo ADR-012 para "falha em processo mediado pela LLM".
**Justificativa:** `parallel_tool_calls: false` simplifica o loop de orquestração, que nunca precisa coordenar mais de uma tool call por turno. `MAX_TOOL_ITERATIONS` e o timeout por tool protegem, respectivamente, contra ciclos sem convergência e integrações lentas/travadas. `ToolError` reaproveita 100% do pipeline de erro já existente (`AppError` → `errorHandler`, mesmo padrão do ADR-007) sem exigir infraestrutura nova, e devolve ao cliente uma resposta categoricamente diferente (502 com `{ error: { message } }`) de uma resposta de sucesso (200 com `{ answer, intent, confidence }`) — satisfaz a exigência de nunca disfarçar uma falha de orquestração como resposta normal, sem expor detalhe interno, prompt ou argumento algum.

---
