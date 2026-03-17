# SDK TypeScript/JavaScript
URL: /docs/sdks/typescript.mdx

SDK oficial TypeScript/JavaScript da brapi.dev. Biblioteca completa com tipos TypeScript, suporte a Node.js e navegador, tratamento de erros automático e retry inteligente.

***

title: 'SDK TypeScript/JavaScript'
description: >-
SDK oficial TypeScript/JavaScript da brapi.dev. Biblioteca completa com tipos
TypeScript, suporte a Node.js e navegador, tratamento de erros automático e
retry inteligente.
full: false
keywords:
brapi, sdk, typescript, javascript, npm, api client, node.js
openGraph:
title: SDK TypeScript/JavaScript - brapi.dev
description: >-
SDK oficial TypeScript/JavaScript com tipos completos e suporte a async/await
type: website
locale: pt\_BR
lastUpdated: '2025-10-12T20:00:00.000Z'
lang: pt-BR
howToSteps:

* name: 'Instale a SDK via npm, yarn ou bun'
  text: 'Execute npm install brapi (ou yarn add brapi, bun add brapi) no terminal do seu projeto para instalar a SDK oficial.'
* name: 'Configure a variável de ambiente com seu token'
  text: 'Crie um arquivo .env e adicione BRAPI\_API\_KEY=seu\_token\_aqui. Nunca exponha o token diretamente no código.'
* name: 'Importe e inicialize o cliente Brapi'
  text: 'No seu código TypeScript/JavaScript, importe com import Brapi from "brapi" e crie uma instância: const client = new Brapi({ apiKey: process.env.BRAPI\_API\_KEY }).'
* name: 'Busque cotações usando async/await'
  text: 'Use const quote = await client.quote.retrieve("PETR4") para obter cotações. O resultado já vem tipado com IntelliSense completo.'
* name: 'Trate erros usando as exceções tipadas'
  text: 'Envolva as chamadas em try/catch e verifique tipos de erro como Brapi.NotFoundError, Brapi.RateLimitError para tratamento específico.'
  howToTools:
* 'Node.js'
* 'npm, yarn, pnpm ou bun'
* 'Editor de código (VS Code recomendado)'
  howToSupplies:
* 'Conta brapi.dev'
* 'Token de API brapi.dev'
* 'Projeto Node.js ou TypeScript'

***

SDK oficial da brapi.dev para TypeScript e JavaScript, oferecendo acesso conveniente à API REST com tipos completos e suporte a async/await.

## Características

* ✅ **Tipos TypeScript completos** - IntelliSense e autocomplete
* ✅ **Suporte a Node.js e Browser** - Funciona em qualquer ambiente
* ✅ **Async/Await nativo** - API moderna e fácil de usar
* ✅ **Retry automático** - Tratamento inteligente de falhas
* ✅ **Tratamento de erros** - Erros tipados e descritivos
* ✅ **Tree-shakeable** - Bundle otimizado
* ✅ **Gerado com Stainless** - Sempre atualizado com a API

## Instalação

```bash
npm install brapi
# ou
yarn add brapi
# ou
pnpm add brapi
# ou
bun add brapi
```

## Início Rápido

### JavaScript

```javascript

const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY,
});

// Buscar cotação de uma ação
const quote = await client.quote.retrieve('PETR4');
console.log(quote.results[0].regularMarketPrice);

// Buscar múltiplas ações
const quotes = await client.quote.retrieve('PETR4,VALE3,ITUB4');
console.log(quotes.results);
```

### TypeScript

```typescript

const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY,
});

// Tipos automáticos!
const quote: Brapi.QuoteRetrieveResponse = await client.quote.retrieve('PETR4');

// IntelliSense completo
const price = quote.results[0].regularMarketPrice;
const change = quote.results[0].regularMarketChangePercent;
```

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env`:

```bash
BRAPI_API_KEY=seu_token_aqui
```

### Opções do Cliente

```typescript
const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY, // Obrigatório
  environment: 'production', // 'production' ou 'sandbox'
  maxRetries: 2, // Número de tentativas (padrão: 2)
  timeout: 60000, // Timeout em ms (padrão: 60000)
});
```

## Exemplos de Uso

### Cotações

```typescript
// Cotação única
const quote = await client.quote.retrieve('PETR4');

// Múltiplas cotações
const quotes = await client.quote.retrieve('PETR4,VALE3,ITUB4');

// Com parâmetros adicionais
const quoteWithModules = await client.quote.retrieve('PETR4', {
  modules: 'summaryProfile,balanceSheetHistory',
});

// Resultado
console.log(quote.results[0]);
// {
//   symbol: 'PETR4',
//   shortName: 'PETROBRAS PN',
//   regularMarketPrice: 38.45,
//   regularMarketChangePercent: 2.15,
//   currency: 'BRL',
//   ...
// }
```

### Lista de Ações

```typescript
// Listar todas as ações disponíveis
const stocks = await client.quote.list();

// Com paginação
const stocksPage = await client.quote.list({
  page: 1,
  limit: 50,
});

console.log(stocks.stocks);
// [
//   { stock: 'PETR4', name: 'Petrobras PN', type: 'stock' },
//   { stock: 'VALE3', name: 'Vale ON', type: 'stock' },
//   ...
// ]
```

### Criptomoedas

```typescript
// Cotação de cripto
const crypto = await client.crypto.retrieve('BTC');

// Lista de criptos disponíveis
const cryptos = await client.crypto.available();
```

### Moedas

```typescript
// Cotação de moeda
const currency = await client.currency.retrieve('USD-BRL');

// Lista de moedas disponíveis
const currencies = await client.currency.available();
```

### Inflação

```typescript
// Dados de inflação
const inflation = await client.inflation.retrieve('IPCA');

// Países disponíveis
const countries = await client.inflation.available();
```

### Taxa de Juros

```typescript
// Taxa SELIC
const selic = await client.primeRate.retrieve('SELIC');

// Países disponíveis
const countries = await client.primeRate.available();
```

## Tratamento de Erros

A SDK lança erros tipados para facilitar o tratamento:

```typescript
try {
  const quote = await client.quote.retrieve('INVALID');
} catch (error) {
  if (error instanceof Brapi.APIError) {
    console.log(error.status); // Código HTTP (ex: 404)
    console.log(error.name); // Nome do erro (ex: 'NotFoundError')
    console.log(error.message); // Mensagem descritiva
    console.log(error.headers); // Headers da resposta
  }
}
```

### Tipos de Erro

| Status Code | Error Type                 | Descrição              |
| ----------- | -------------------------- | ---------------------- |
| 400         | `BadRequestError`          | Requisição inválida    |
| 401         | `AuthenticationError`      | Token inválido         |
| 403         | `PermissionDeniedError`    | Sem permissão          |
| 404         | `NotFoundError`            | Recurso não encontrado |
| 422         | `UnprocessableEntityError` | Dados inválidos        |
| 429         | `RateLimitError`           | Limite de requisições  |
| >=500       | `InternalServerError`      | Erro no servidor       |
| N/A         | `APIConnectionError`       | Erro de conexão        |

## Retry Automático

A SDK tenta automaticamente 2 vezes em caso de falha:

```typescript
// Configurar retries
const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY,
  maxRetries: 3, // Tenta até 3 vezes
});

// Desabilitar retries
const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY,
  maxRetries: 0, // Sem retry
});
```

Erros automaticamente retriados:

* Erros de conexão
* 408 Request Timeout
* 409 Conflict
* 429 Rate Limit
* Erros 5xx (servidor)

## Uso em Next.js

### Server Component

```typescript
// app/stock/[ticker]/page.tsx

const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY,
});

export default async function StockPage({
  params,
}: {
  params: { ticker: string };
}) {
  const quote = await client.quote.retrieve(params.ticker);
  const stock = quote.results[0];
  
  return (
    
  );
}
```

### API Route

```typescript
// app/api/quote/[ticker]/route.ts

const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY,
});

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const quote = await client.quote.retrieve(params.ticker);
    return NextResponse.json(quote);
  } catch (error) {
    if (error instanceof Brapi.NotFoundError) {
      return NextResponse.json(
        { error: 'Ticker not found' },
        { status: 404 }
      );
    }
    throw error;
  }
}
```

### Client Component com SWR

```typescript
'use client';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function StockQuote({ ticker }: { ticker: string }) {
  const { data, error } = useSWR(`/api/quote/${ticker}`, fetcher);
  
  if (error) return ;
  if (!data) return ;
  
  const stock = data.results[0];
  return ;
}
```

## Uso com Express

```typescript

const app = express();
const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY,
});

app.get('/api/quote/:ticker', async (req, res) => {
  try {
    const quote = await client.quote.retrieve(req.params.ticker);
    res.json(quote);
  } catch (error) {
    if (error instanceof Brapi.NotFoundError) {
      res.status(404).json({ error: 'Ticker not found' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.listen(3000);
```

## Timeouts

```typescript
// Timeout global
const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY,
  timeout: 10000, // 10 segundos
});

// Timeout por requisição
const quote = await client.quote.retrieve('PETR4', {
  timeout: 5000, // 5 segundos
});
```

## Tipos Disponíveis

A SDK exporta todos os tipos necessários:

```typescript
import type {
  QuoteRetrieveResponse,
  QuoteListResponse,
  CryptoRetrieveResponse,
  CurrencyRetrieveResponse,
  InflationRetrieveResponse,
} from 'brapi';
```

## Boas Práticas

### 1. Reutilize a Instância do Cliente

```typescript
// ✅ Bom - Crie uma instância e reutilize
export const brapiClient = new Brapi({
  apiKey: process.env.BRAPI_API_KEY,
});

// ❌ Ruim - Criar nova instância a cada uso
function getQuote() {
  const client = new Brapi({ apiKey: '...' }); // Não faça isso
}
```

### 2. Use Variáveis de Ambiente

```typescript
// ✅ Bom
const client = new Brapi({
  apiKey: process.env.BRAPI_API_KEY,
});

// ❌ Ruim - Nunca hardcode o token
const client = new Brapi({
  apiKey: 'meu-token-secreto', // Não faça isso!
});
```

### 3. Trate Erros Adequadamente

```typescript
// ✅ Bom
try {
  const quote = await client.quote.retrieve('PETR4');
} catch (error) {
  if (error instanceof Brapi.RateLimitError) {
    // Trate limite de requisições
  } else if (error instanceof Brapi.NotFoundError) {
    // Trate ticker não encontrado
  }
}
```

## Links Úteis

* 📦 [Pacote NPM](https://www.npmjs.com/package/brapi)
* 🔧 [Repositório GitHub](https://github.com/brapi-dev/brapi-typescript)
* 📚 [Documentação Completa da API](/docs)
* 🐛 [Reportar Bug](https://github.com/brapi-dev/brapi-typescript/issues)

## Suporte

Precisa de ajuda? Entre em contato:

* 💬 [Abra uma issue](https://github.com/brapi-dev/brapi-typescript/issues)
* 📧 [Suporte por email](mailto:contato@brapi.dev)
* 📖 [Documentação completa](/docs)

## Contribuindo

Contribuições são bem-vindas! Veja o [guia de contribuição](https://github.com/brapi-dev/brapi-typescript/blob/main/CONTRIBUTING.md).

## Licença

MIT License - veja [LICENSE](https://github.com/brapi-dev/brapi-typescript/blob/main/LICENSE) para detalhes.




# Cotação de todas as ações
URL: /docs/acoes/list.mdx

Endpoints para consulta de dados relacionados a ativos negociados na B3, como Ações, Fundos Imobiliários (FIIs), BDRs, ETFs e Índices (ex: IBOVESPA). Permite buscar cotações atuais, dados históricos, informações fundamentalistas (via módulos) e listagens de ativos disponíveis.

***

title: Cotação de todas as ações
description: >-
Endpoints para consulta de dados relacionados a ativos negociados na B3, como
Ações, Fundos Imobiliários (FIIs), BDRs, ETFs e Índices (ex: IBOVESPA).
Permite buscar cotações atuais, dados históricos, informações fundamentalistas
(via módulos) e listagens de ativos disponíveis.
full: true
keywords: brapi, api, documentação, ações
openGraph:
title: Cotação de todas as ações
description: >-
Endpoints para consulta de dados relacionados a ativos negociados na B3,
como Ações, Fundos Imobiliários (FIIs), BDRs, ETFs e Índices (ex: IBOVESPA).
Permite buscar cotações atuais, dados históricos, informações
fundamentalistas (via módulos) e listagens de ativos disponíveis.
type: website
locale: pt\_BR
lastUpdated: '2025-04-28T01:22:35.251Z'
lang: pt-BR
\_openapi:
method: GET
route: /api/quote/list
toc:

* depth: 2
  title: Cotações de todas as ações, fundos, índices e BDRs
  url: '#cotacoes-de-todas-as-acoes-fundos-indices-e-bdrs'
  structuredData:
  headings:
  * content: Listar e Filtrar Cotações de Ativos
    id: cotacoes-de-todas-as-acoes-fundos-indices-e-bdrs
    contents:
  * content: >-
    Obtenha uma lista paginada de cotações de diversos ativos (ações,
    FIIs, BDRs) negociados na B3, com opções avançadas de busca, filtragem
    e ordenação.

    ### Funcionalidades:

    * **Busca por Ticker:** Filtre por parte do ticker usando `search`.

    * **Filtragem por Tipo:** Restrinja a lista a `stock`, `fund` (FII)
      ou `bdr` com o parâmetro `type`.

    * **Filtragem por Setor:** Selecione ativos de um setor específico
      usando `sector`.

    * **Ordenação:** Ordene os resultados por diversos campos (preço,
      variação, volume, etc.) usando `sortBy` e `sortOrder`.

    * **Paginação:** Controle o número de resultados por página
      (`limit`) e a página desejada (`page`).

    ### Autenticação:

    Requer token de autenticação via `token` (query) ou `Authorization`
    (header).

    ### Exemplo de Requisição:

    **Listar as 10 ações do setor Financeiro com maior volume, ordenadas
    de forma decrescente:**

    ```bash

    curl -X GET
    "https://brapi.dev/api/quote/list?sector=Finance&sortBy=volume&sortOrder=desc&limit=10&page=1&token=SEU_TOKEN"

    ```

    **Buscar por ativos cujo ticker contenha 'ITUB' e ordenar por nome
    ascendente:**

    ```bash

    curl -X GET
    "https://brapi.dev/api/quote/list?search=ITUB&sortBy=name&sortOrder=asc&token=SEU_TOKEN"

    ```

    ### Resposta:

    A resposta contém a lista de `stocks` (e `indexes` relevantes),
    informações sobre os filtros aplicados, detalhes da paginação
    (`currentPage`, `totalPages`, `itemsPerPage`, `totalCount`,
    `hasNextPage`) e listas de setores (`availableSectors`) e tipos
    (`availableStockTypes`) disponíveis para filtragem.
    heading: cotacoes-de-todas-as-acoes-fundos-indices-e-bdrs

***

Endpoints para consulta de dados relacionados a ativos negociados na B3, como
**Ações**, **Fundos Imobiliários (FIIs)**, **BDRs**, **ETFs** e **Índices** (ex:
IBOVESPA).

Permite buscar cotações atuais, dados históricos, informações fundamentalistas
(via módulos) e listagens de ativos disponíveis.





## Swagger Documentation

# Brapi - API do Mercado Financeiro Brasileiro - /api/quote/list

Single endpoint documentation for /api/quote/list

## Base URLs

- `https://brapi.dev` - Servidor principal da API Brapi
- `http://localhost:3000` - Servidor local para desenvolvimento

## GET /api/quote/list

**Summary:** Listar e Filtrar Cotações de Ativos

Obtenha uma lista paginada de cotações de diversos ativos (ações, FIIs, BDRs) negociados na B3, com opções avançadas de busca, filtragem e ordenação.

### Funcionalidades:

*   **Busca por Ticker:** Filtre por parte do ticker usando `search`.
*   **Filtragem por Tipo:** Restrinja a lista a `stock`, `fund` (FII) ou `bdr` com o parâmetro `type`.
*   **Filtragem por Setor:** Selecione ativos de um setor específico usando `sector`.
*   **Ordenação:** Ordene os resultados por diversos campos (preço, variação, volume, etc.) usando `sortBy` e `sortOrder`.
*   **Paginação:** Controle o número de resultados por página (`limit`) e a página desejada (`page`).

### Autenticação:

Requer token de autenticação via `token` (query) ou `Authorization` (header).

### Exemplo de Requisição:

**Listar as 10 ações do setor Financeiro com maior volume, ordenadas de forma decrescente:**

```bash
curl -X GET "https://brapi.dev/api/quote/list?sector=Finance&sortBy=volume&sortOrder=desc&limit=10&page=1&token=SEU_TOKEN"
```

**Buscar por ativos cujo ticker contenha 'ITUB' e ordenar por nome ascendente:**

```bash
curl -X GET "https://brapi.dev/api/quote/list?search=ITUB&sortBy=name&sortOrder=asc&token=SEU_TOKEN"
```

### Resposta:

A resposta contém a lista de `stocks` (e `indexes` relevantes), informações sobre os filtros aplicados, detalhes da paginação (`currentPage`, `totalPages`, `itemsPerPage`, `totalCount`, `hasNextPage`) e listas de setores (`availableSectors`) e tipos (`availableStockTypes`) disponíveis para filtragem.

**Tags:** Ações

### Parameters

- **search** (query): **Opcional.** Termo para buscar ativos por ticker (correspondência parcial). Ex: `PETR` encontrará `PETR4`, `PETR3`.
- **sortBy** (query): **Opcional.** Campo pelo qual os resultados serão ordenados.
- **sortOrder** (query): **Opcional.** Direção da ordenação: `asc` (ascendente) ou `desc` (descendente). Requer que `sortBy` seja especificado.
- **limit** (query): **Opcional.** Número máximo de ativos a serem retornados por página. O valor padrão pode variar.
- **page** (query): **Opcional.** Número da página dos resultados a ser retornada, considerando o `limit` especificado. Começa em 1.
- **type** (query): **Opcional.** Filtra os resultados por tipo de ativo.
- **sector** (query): **Opcional.** Filtra os resultados por setor de atuação da empresa. Utilize um dos valores retornados em `availableSectors`.
- **undefined** (undefined)

### Responses

#### 200

**Sucesso.** Retorna a lista paginada e filtrada de ativos, juntamente com metadados de paginação e filtros disponíveis.

#### 401

#### 417

**Expectation Failed.** Requisição malformada ou parâmetro inválido. Geralmente ocorre se um valor inválido for fornecido para `sortBy`, `sortOrder`, `type`, `sector` ou se `limit`/`page` não forem números inteiros positivos.

**Example Response:**

```json
{
  "error": true,
  "message": "Campo 'sortBy' inválido. sortBy válidos: name, close, change, change_abs, volume, market_cap_basic, sector"
}
```

## Schemas

The following schemas are used by this endpoint:

### ErrorResponse

Schema padrão para respostas de erro da API.

**Properties:**

- **error** (boolean) *(required)*
  Indica se a requisição resultou em erro. Sempre `true` para este schema.

- **message** (string) *(required)*
  Mensagem descritiva do erro ocorrido.


### IndexSummary

Resumo de informações de um índice, geralmente retornado em listas.

**Properties:**

- **stock** (string)
  Ticker do índice (ex: `^BVSP`).

- **name** (string)
  Nome do índice (ex: `IBOVESPA`).


### QuoteListResponse

Resposta do endpoint de listagem de cotações (`/api/quote/list`).

**Properties:**

- **indexes** (array)
  Lista resumida de índices relevantes (geralmente inclui IBOVESPA).
  Array items:
    Reference to: **IndexSummary**

- **stocks** (array)
  Lista paginada e filtrada dos ativos solicitados.
  Array items:
    Reference to: **StockSummary**

- **availableSectors** (array)
  Lista de todos os setores disponíveis que podem ser usados no parâmetro de filtro `sector`.
  Array items:
    **Type:** string


- **availableStockTypes** (array)
  Lista dos tipos de ativos (`stock`, `fund`, `bdr`) disponíveis que podem ser usados no parâmetro de filtro `type`.
  Array items:
    **Type:** string

    **Options:** `stock`, `fund`, `bdr`


- **currentPage** (integer)
  Número da página atual retornada nos resultados.

- **totalPages** (integer)
  Número total de páginas existentes para a consulta/filtros aplicados.

- **itemsPerPage** (integer)
  Número de itens (ativos) retornados por página (conforme `limit` ou padrão).

- **totalCount** (integer)
  Número total de ativos encontrados que correspondem aos filtros aplicados (sem considerar a paginação).

- **hasNextPage** (boolean)
  Indica se existe uma próxima página de resultados (`true`) ou se esta é a última página (`false`).


### StockSummary

Resumo de informações de um ativo (ação, FII, BDR), geralmente retornado em listas.

**Properties:**

- **stock** (string)
  Ticker do ativo (ex: `PETR4`, `MXRF11`).

- **name** (string)
  Nome do ativo ou empresa (ex: `PETROBRAS PN`).

- **close** (number, float)
  Preço de fechamento mais recente ou último preço negociado.

- **change** (number, float)
  Variação percentual do preço em relação ao fechamento anterior.

- **volume** (integer, int64)
  Volume financeiro negociado no último pregão ou dia atual.

- **market_cap** (number, float) *(nullable)*
  Capitalização de mercado (Preço x Quantidade de Ações). Pode ser nulo para FIIs ou outros tipos.

- **logo** (string, url)
  URL para a imagem do logo da empresa/ativo.

- **sector** (string) *(nullable)*
  Setor de atuação da empresa (ex: `Energy Minerals`, `Finance`). Pode ser nulo ou variar para FIIs.

- **type** (string) - Options: `stock`, `fund`, `bdr`
  Tipo do ativo: `stock` (Ação), `fund` (Fundo Imobiliário/FII), `bdr` (Brazilian Depositary Receipt).


