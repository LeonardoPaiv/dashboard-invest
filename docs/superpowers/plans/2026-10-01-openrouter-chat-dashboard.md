# Dashboard com Assistente (OpenRouter) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a página principal por uma tela dividida entre um chatbot (OpenRouter) e o painel da carteira, e fazer do chatbot o único caminho para importar arquivos e gerenciar ativos e categorias.

**Architecture:** O modelo nunca escreve no store. Ele chama duas ferramentas: `get_portfolio` (leitura) e `propose_changes` (uma lista de operações). Cada proposta é validada por funções puras em `src/domain/`, vira um cartão de prévia no chat e só é aplicada quando o usuário clica em Confirmar. O formato `PortfolioData` (`acoes`, `fiis`, `tesouro`, `renda_fixa`, `manualAssets`) não muda, então as outras abas continuam funcionando; uma camada de adaptação (`src/domain/assets.ts`) converte essas seções em uma lista única de ativos com categoria.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Zustand 4 (persist), Tailwind 3, lucide-react, xlsx. Novo: Vitest 2 + jsdom + Testing Library. OpenRouter via `fetch` direto (sem SDK).

**Spec:** não há documento de spec separado. As fontes são:
- Design: `Dashboard Chat.dc.html` no projeto Claude Design `3ebabe82-ea2f-4956-84a1-e7e751f911e7` (https://claude.ai/design/p/3ebabe82-ea2f-4956-84a1-e7e751f911e7?file=Dashboard+Chat.dc.html). O protótipo usa estilos inline; este plano já traz a tradução para Tailwind em cada componente.
- Decisões do usuário (2026-10-01), listadas em "Global Constraints".

## Global Constraints

- O chat **substitui** o fluxo antigo de importação: `ImportModal`, `importConfig`, `autoBuildImportSections`, `src/utils/parser.ts` e `src/utils/universalParser.ts` são removidos.
- O chatbot só altera **ativos e categorias**. Carteiras, plano mensal, metas e listas ficam fora das ferramentas de escrita.
- Nada é salvo sem confirmação do usuário no cartão de prévia. Rodapé do chat, texto exato: `Nada é salvo sem sua confirmação. Respostas podem conter erros — confira os valores.`
- Sem chave do OpenRouter, ou com chave recusada (HTTP 401), a área do chat mostra o formulário de chave. O painel da carteira continua visível.
- A chave fica só no `localStorage` (chave de persistência `ai-settings`) e só é enviada para `https://openrouter.ai`. Nunca vai para o backup JSON.
- Modelos predefinidos (IDs exatos, escolhidos pelo usuário em 2026-10-01; todos com suporte a tools no OpenRouter nessa data): `stealth/space-bunny-alpha` (padrão, "Padrão"), `nvidia/nemotron-3-ultra-550b-a55b:free` ("Grátis"), `deepseek/deepseek-r1` ("Raciocínio"), `openrouter/auto` ("Automático"). O usuário pode digitar outro ID. O protótipo lista outros modelos; esta lista prevalece.
- Endpoints: `GET https://openrouter.ai/api/v1/key` (validação; 401 = inválida) e `POST https://openrouter.ai/api/v1/chat/completions` (o campo `tools` vai em **toda** requisição).
- Categorias embutidas, nesta ordem: `Ações`, `FIIs`, `Renda Fixa`, `Tesouro Direto`. Não podem ser renomeadas nem excluídas. Qualquer outra categoria é livre e seus ativos vivem em `manualAssets` com o campo `Categoria`.
- Anexos aceitos: `.xlsx`, `.xls`, `.csv`. PDF fica fora deste plano.
- Paleta do gráfico (ordem exata): `#4F46E5`, `#10B981`, `#F59E0B`, `#EF4444`, `#8B5CF6`, `#EC4899`, `#3B82F6`, `#6366F1`. Cores do tema já existem no Tailwind: `background #0a0a0b`, `card #18181b`, `primary #10b981`.
- Interface e mensagens em português do Brasil. Identificadores de código em inglês, como no resto do projeto.
- Verificação de cada tarefa: `npm test` e `npm run build`. `npm run lint` **não** funciona neste repo (não há config de ESLint); não use.
- O `tsc` do build cobre `src/**`, inclusive testes, com `noUnusedLocals` e `noUnusedParameters`. Não deixe import ou variável sem uso.

## O que sai da página principal

O design novo não tem estes blocos do `Dashboard.tsx` antigo, e este plano os remove junto com o arquivo:
cards de Patrimônio/Investido/Lucro, "Monitoramento Direto" (listas personalizadas), modal "Adicionar Ativo" e edição inline de preço médio. As ações do store que eles usavam (`addCustomList`, `addManualAsset`, `updateAsset` etc.) permanecem, sem UI. Adicionar e editar ativos passa a ser feito pelo chat.

## Review Focus

1. **Carteira ativa = "Todas" (`activePortfolioId === 'all'`)** ao propor ou confirmar: a pessoa espera saber onde será salvo. A proposta grava o id e o nome da primeira carteira e o cartão mostra esse nome. Teste na Task 9 (`buildToolContext`).
2. **Dados mudaram entre a prévia e o clique em Confirmar** (ativo removido, carteira excluída, clique duplo): a proposta é revalidada ao confirmar; se falhar, o cartão mostra o erro e nada é gravado; o segundo clique não aplica de novo. Testes na Task 9.
3. **Modelo devolve argumentos malformados** (JSON quebrado, ferramenta inexistente, quantidade como `"1.234,56"`, quantidade negativa): vira erro devolvido ao modelo, sem prévia e sem exceção na UI. Testes na Task 8.
4. **Chave revogada no meio da sessão** (401 no chat): o formulário de chave reaparece e a mensagem digitada (e o arquivo anexado) voltam para o campo, sem se perder. Teste na Task 9.
5. **Planilha grande ou com separador `;`**: o arquivo é truncado em 300 linhas por aba / 60 000 caracteres, com aviso explícito para o modelo repassar ao usuário; CSV com `;` é lido corretamente. Testes na Task 7.

## File Structure

| Arquivo | Responsabilidade |
| --- | --- |
| `src/test/setup.ts` (novo) | Setup do Vitest: jest-dom, cleanup, limpar localStorage. |
| `src/lib/format.ts` (novo) | `brl`, `pct`, `num`. |
| `src/domain/assets.ts` (novo) | Categorias embutidas, `Asset`, `listAssets`, `collectCategories`. |
| `src/domain/operations.ts` (novo) | `AssetOperation`, `runOperations`, `describeOperations`. |
| `src/domain/portfolioView.ts` (novo) | View model do painel: pílulas, fatias do donut, linhas da tabela. |
| `src/lib/openrouter/client.ts` (novo) | `validateKey`, `createChatCompletion`, `OpenRouterError`, tipos de mensagem. |
| `src/lib/openrouter/models.ts` (novo) | `MODEL_PRESETS`, `DEFAULT_MODEL`, `shortModelName`. |
| `src/store/useAiSettingsStore.ts` (novo) | Chave, status da chave e modelo (persistido). |
| `src/chat/attachments.ts` (novo) | Ler `.xlsx/.xls/.csv` e serializar para o prompt. |
| `src/chat/systemPrompt.ts` (novo) | Prompt de sistema. |
| `src/chat/tools.ts` (novo) | Definições das ferramentas e `executeTool`. |
| `src/chat/agent.ts` (novo) | Loop de tool calling de um turno. |
| `src/store/useChatStore.ts` (novo) | Mensagens, histórico, envio, confirmar/descartar proposta. |
| `src/hooks/useQuoteRefresh.ts` (novo) | Atualização de cotações (extraída do `Dashboard.tsx`). |
| `src/components/home/*.tsx` (novos) | `HomePage`, `ChatPanel`, `ApiKeyGate`, `ModelPicker`, `MessageList`, `ProposalCard`, `Composer`, `PortfolioPanel`. |
| `src/store/useInvestmentStore.ts` (alterado) | `+applyAssetOperations`, `+resolveWritablePortfolioId`, `−importConfig`. |
| `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/DataManagement.tsx` (alterados) | Ligação da nova página e remoção do import antigo. |
| `src/components/Dashboard.tsx`, `src/components/ImportModal.tsx`, `src/utils/parser.ts`, `src/utils/universalParser.ts` (removidos) | Substituídos. |

---

### Task 1: Infraestrutura de testes (Vitest)

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: scripts `npm test` e `npm run test:watch`; `brl(v: number): string`, `pct(v: number): string`, `num(v: number): string` em `src/lib/format.ts`.

- [ ] **Step 1: Instalar dependências de teste**

```bash
npm install -D vitest@^2.1.9 jsdom@^25.0.1 @testing-library/react@^16.1.0 @testing-library/dom@^10.4.0 @testing-library/user-event@^14.5.2 @testing-library/jest-dom@^6.6.3
```

- [ ] **Step 2: Adicionar os scripts em `package.json`**

Em `"scripts"`, depois de `"preview": "vite preview"`:

```json
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Configurar o Vitest em `vite.config.ts`**

Substitua o arquivo inteiro por:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://brapi.dev',
        changeOrigin: true,
      },
      '/i10': {
        target: 'https://investidor10.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/i10/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 4: Criar `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
})
```

- [ ] **Step 5: Escrever o teste que falha**

`src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { brl, num, pct } from './format'

describe('format', () => {
  it('formats currency in pt-BR', () => {
    expect(brl(1234.56)).toMatch(/^R\$\s1\.234,56$/)
    expect(brl(NaN)).toMatch(/^R\$\s0,00$/)
  })

  it('formats percentages with one decimal and comma', () => {
    expect(pct(12.345)).toBe('12,3%')
    expect(pct(0)).toBe('0,0%')
  })

  it('formats plain numbers with at most two decimals', () => {
    expect(num(1200)).toBe('1.200')
    expect(num(4.256)).toBe('4,26')
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./format"`.

- [ ] **Step 7: Implementar `src/lib/format.ts`**

```ts
export const brl = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

export const pct = (value: number): string => (value || 0).toFixed(1).replace('.', ',') + '%'

export const num = (value: number): string =>
  Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
```

- [ ] **Step 8: Rodar testes e build**

Run: `npm test && npm run build`
Expected: 3 testes passam; build termina com `✓ built in`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/lib/format.ts src/lib/format.test.ts
git commit -m "test: add vitest setup and format helpers"
```

---

### Task 2: Camada de ativos e categorias (`src/domain/assets.ts`)

**Files:**
- Create: `src/domain/assets.ts`
- Test: `src/domain/assets.test.ts`

**Interfaces:**
- Consumes: tipos `Portfolio`, `PortfolioData` e a função `createEmptyPortfolioData` de `src/store/useInvestmentStore.ts` (já existem).
- Produces (tudo exportado de `src/domain/assets.ts`):
  - `type SectionKey = 'acoes' | 'fiis' | 'tesouro' | 'renda_fixa' | 'manualAssets'`
  - `const SECTIONS: SectionKey[]`
  - `const BUILTIN_CATEGORIES: readonly ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto']`
  - `isBuiltinCategory(name: string): boolean`
  - `sectionForCategory(category: string): SectionKey`
  - `normalizeTicker(ticker: string): string`
  - `rawName(record: any): string`, `recordTicker(record: any): string`
  - `unitPrice(record: any): number`
  - `categoryOfRecord(record: any, section: SectionKey): string`
  - `interface Asset { key: string; ticker: string; category: string; section: SectionKey; segment: string; quantity: number; avgPrice: number; price: number; value: number }`
  - `listAssets(data: PortfolioData | null): Asset[]`
  - `collectCategories(assetCategories: string[], portfolios: Portfolio[]): string[]`

Contexto de domínio: cada carteira guarda ativos em cinco listas. `acoes` e `fiis` identificam o ativo por `Ticker`; `tesouro` por `Titulo`; `renda_fixa` por `Ativo`; `manualAssets` por `Ticker` e traz a categoria em `Categoria`. Todas usam `Quantidade`, `PrecoMedio`, `Posicao` (valor total); só algumas têm `Cotacao`.

- [ ] **Step 1: Escrever o teste que falha**

`src/domain/assets.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyPortfolioData, type Portfolio, type PortfolioData } from '../store/useInvestmentStore'
import { collectCategories, isBuiltinCategory, listAssets, sectionForCategory } from './assets'

const sample = (): PortfolioData => ({
  ...createEmptyPortfolioData(),
  acoes: [{ Ticker: 'itub4', Quantidade: 300, PrecoMedio: 28.4, Cotacao: 36.12, Posicao: 10836, Segmento: 'Bancos' }],
  fiis: [{ Ticker: 'HGLG11', Quantidade: 60, PrecoMedio: 158, Cotacao: 162.4, Posicao: 9744, Segmento: 'Logística' }],
  tesouro: [{ Titulo: 'Tesouro IPCA+ 2035', Quantidade: 4, PrecoMedio: 3000, Posicao: 13600, Vencimento: '-' }],
  renda_fixa: [{ Ativo: 'CDB Inter 110% CDI', Quantidade: 1, PrecoMedio: 10500, Posicao: 12000, Indexador: 'CDI' }],
  manualAssets: [
    { id: 'm1', Ticker: 'BTC', Categoria: 'Cripto', Quantidade: 0.5, PrecoMedio: 200000, Cotacao: 300000, Posicao: 150000, Segmento: 'Cripto' },
  ],
})

const portfolio = (data: PortfolioData): Portfolio => ({
  id: 'p1',
  name: 'Carteira Principal',
  data,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('listAssets', () => {
  it('returns an empty list for null data', () => {
    expect(listAssets(null)).toEqual([])
  })

  it('flattens every section into assets with a category', () => {
    const assets = listAssets(sample())
    expect(assets.map((a) => [a.ticker, a.category])).toEqual([
      ['ITUB4', 'Ações'],
      ['HGLG11', 'FIIs'],
      ['Tesouro IPCA+ 2035', 'Tesouro Direto'],
      ['CDB Inter 110% CDI', 'Renda Fixa'],
      ['BTC', 'Cripto'],
    ])
  })

  it('uppercases stock tickers and keeps a normalized key for every asset', () => {
    const [itub, , tesouro] = listAssets(sample())
    expect(itub.key).toBe('ITUB4')
    expect(tesouro.key).toBe('TESOURO IPCA+ 2035')
  })

  it('derives unit price from position when there is no quote', () => {
    const tesouro = listAssets(sample())[2]
    expect(tesouro.price).toBe(3400)
    expect(tesouro.value).toBe(13600)
  })

  it('falls back to the category when the segment is missing or "-"', () => {
    const assets = listAssets(sample())
    expect(assets[2].segment).toBe('Tesouro Direto')
    expect(assets[3].segment).toBe('CDI')
  })

  it('labels manual assets without Categoria as "Outros"', () => {
    const data = { ...createEmptyPortfolioData(), manualAssets: [{ id: 'x', Ticker: 'XPTO', Quantidade: 1, PrecoMedio: 10, Posicao: 10 }] }
    expect(listAssets(data)[0].category).toBe('Outros')
  })
})

describe('categories', () => {
  it('maps built-in categories to their sections and everything else to manualAssets', () => {
    expect(sectionForCategory('Ações')).toBe('acoes')
    expect(sectionForCategory('FIIs')).toBe('fiis')
    expect(sectionForCategory('Renda Fixa')).toBe('renda_fixa')
    expect(sectionForCategory('Tesouro Direto')).toBe('tesouro')
    expect(sectionForCategory('Cripto')).toBe('manualAssets')
    expect(isBuiltinCategory('Cripto')).toBe(false)
  })

  it('merges built-ins, stored categories and categories found in assets, without duplicates', () => {
    const data = { ...sample(), manualAssets: [{ id: 'm2', Ticker: 'VOO', Categoria: 'ETFs', Quantidade: 1, PrecoMedio: 1, Posicao: 1 }] }
    expect(collectCategories(['Ações', 'FIIs', 'Renda Fixa', 'Cripto', 'Exterior'], [portfolio(data)])).toEqual([
      'Ações',
      'FIIs',
      'Renda Fixa',
      'Tesouro Direto',
      'Cripto',
      'Exterior',
      'ETFs',
    ])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/assets.test.ts`
Expected: FAIL — `Failed to resolve import "./assets"`.

- [ ] **Step 3: Implementar `src/domain/assets.ts`**

```ts
import type { Portfolio, PortfolioData } from '../store/useInvestmentStore'

export type SectionKey = 'acoes' | 'fiis' | 'tesouro' | 'renda_fixa' | 'manualAssets'

export const SECTIONS: SectionKey[] = ['acoes', 'fiis', 'tesouro', 'renda_fixa', 'manualAssets']

export const BUILTIN_CATEGORIES = ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto'] as const

const CATEGORY_SECTION: Record<string, SectionKey> = {
  'Ações': 'acoes',
  'FIIs': 'fiis',
  'Renda Fixa': 'renda_fixa',
  'Tesouro Direto': 'tesouro',
}

const SECTION_CATEGORY: Record<Exclude<SectionKey, 'manualAssets'>, string> = {
  acoes: 'Ações',
  fiis: 'FIIs',
  renda_fixa: 'Renda Fixa',
  tesouro: 'Tesouro Direto',
}

export const isBuiltinCategory = (name: string): boolean => name in CATEGORY_SECTION

export const sectionForCategory = (category: string): SectionKey => CATEGORY_SECTION[category] ?? 'manualAssets'

export const normalizeTicker = (ticker: string): string => ticker.trim().toUpperCase()

export const rawName = (record: any): string => String(record?.Ticker ?? record?.Titulo ?? record?.Ativo ?? '').trim()

export const recordTicker = (record: any): string => normalizeTicker(rawName(record))

export const unitPrice = (record: any): number => {
  const quote = Number(record?.Cotacao) || 0
  if (quote > 0) return quote
  const quantity = Number(record?.Quantidade) || 0
  const position = Number(record?.Posicao) || 0
  if (quantity > 0 && position > 0) return position / quantity
  return Number(record?.PrecoMedio) || 0
}

export const categoryOfRecord = (record: any, section: SectionKey): string =>
  section === 'manualAssets' ? record?.Categoria || 'Outros' : SECTION_CATEGORY[section]

export interface Asset {
  /** Ticker normalizado (maiúsculas, sem espaços nas pontas); usado para comparar. */
  key: string
  /** Nome para exibição. */
  ticker: string
  category: string
  section: SectionKey
  segment: string
  quantity: number
  avgPrice: number
  price: number
  value: number
}

function toAsset(record: any, section: SectionKey): Asset {
  const category = categoryOfRecord(record, section)
  const quantity = Number(record.Quantidade) || 0
  const price = unitPrice(record)
  const segment = [record.Segmento, record.Vencimento, record.Indexador].find((v) => v && v !== '-') ?? category
  const name = rawName(record)
  return {
    key: normalizeTicker(name),
    ticker: section === 'acoes' || section === 'fiis' ? normalizeTicker(name) : name,
    category,
    section,
    segment: String(segment),
    quantity,
    avgPrice: Number(record.PrecoMedio) || 0,
    price,
    value: Number(record.Posicao) || quantity * price,
  }
}

export function listAssets(data: PortfolioData | null): Asset[] {
  if (!data) return []
  return SECTIONS.flatMap((section) =>
    (((data as any)[section] || []) as any[]).map((record) => toAsset(record, section)),
  ).filter((asset) => asset.key !== '')
}

export function collectCategories(assetCategories: string[], portfolios: Portfolio[]): string[] {
  const used = portfolios.flatMap((p) => ((p.data?.manualAssets || []) as any[]).map((r) => r.Categoria || 'Outros'))
  return Array.from(new Set<string>([...BUILTIN_CATEGORIES, ...(assetCategories || []), ...used]))
}
```

Nota: o resultado esperado no teste (`Renda Fixa` antes de `Tesouro Direto`, depois `Cripto`, `Exterior`, `ETFs`) vem da ordem de inserção do `Set`: embutidas, depois as do store, depois as encontradas nos ativos.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/assets.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/assets.ts src/domain/assets.test.ts
git commit -m "feat: add asset and category adapter over portfolio sections"
```

---

### Task 3: Operações sobre ativos e categorias (`src/domain/operations.ts`)

**Files:**
- Create: `src/domain/operations.ts`
- Test: `src/domain/operations.test.ts`

**Interfaces:**
- Consumes (de `src/domain/assets.ts`): `SECTIONS`, `SectionKey`, `categoryOfRecord`, `isBuiltinCategory`, `normalizeTicker`, `rawName`, `recordTicker`, `sectionForCategory`, `unitPrice`. Tipos `Portfolio`, `PortfolioData` do store.
- Produces (de `src/domain/operations.ts`):

```ts
export type AssetOperation =
  | { type: 'upsert_asset'; ticker: string; category: string; quantity: number; avgPrice: number; mode: 'add' | 'set' }
  | { type: 'remove_asset'; ticker: string }
  | { type: 'move_asset'; ticker: string; category: string }
  | { type: 'add_category'; name: string }
  | { type: 'rename_category'; from: string; to: string }
  | { type: 'remove_category'; name: string; moveTo?: string }

export interface Workspace { portfolios: Portfolio[]; categories: string[] }
export interface RunResult { workspace: Workspace; errors: string[] }
export function runOperations(workspace: Workspace, targetPortfolioId: string, operations: AssetOperation[]): RunResult

export type PreviewMode = 'novo' | 'somar' | 'substituir' | 'remover' | 'mover' | 'nova categoria' | 'renomear' | 'excluir categoria'
export interface PreviewRow { label: string; category: string; quantity?: number; avgPrice?: number; mode: PreviewMode }
export function describeOperations(workspace: Workspace, targetPortfolioId: string, operations: AssetOperation[]): PreviewRow[]
```

Regras:
- Operações de ativo (`upsert_asset`, `remove_asset`, `move_asset`) agem só na carteira `targetPortfolioId`. Operações de categoria agem em **todas** as carteiras, porque a lista de categorias é global.
- `runOperations` aplica em ordem. Uma operação inválida é pulada e gera um item em `errors`; as demais continuam. Quem chama decide o que fazer com `errors` (o store recusa tudo se houver erro).
- `upsert_asset` com `mode: 'add'` em ativo existente soma a quantidade e recalcula o preço médio ponderado. Com `mode: 'set'`, ou em ativo novo, usa os valores informados. A cotação de um ativo existente é preservada; a de um ativo novo começa igual ao preço médio.
- Comparação de ticker e de nome de categoria ignora maiúsculas/minúsculas e espaços nas pontas.

- [ ] **Step 1: Escrever os testes que falham**

`src/domain/operations.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyPortfolioData, type Portfolio, type PortfolioData } from '../store/useInvestmentStore'
import { describeOperations, runOperations, type Workspace } from './operations'

const portfolio = (id: string, data: Partial<PortfolioData> = {}): Portfolio => ({
  id,
  name: id === 'p1' ? 'Carteira Principal' : 'Outra',
  data: { ...createEmptyPortfolioData(), ...data },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const workspace = (data: Partial<PortfolioData> = {}, other: Partial<PortfolioData> = {}): Workspace => ({
  portfolios: [portfolio('p1', data), portfolio('p2', other)],
  categories: ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'Cripto'],
})

const hglg = { Ticker: 'HGLG11', Quantidade: 60, PrecoMedio: 158, Cotacao: 162.4, Posicao: 9744, Segmento: 'Logística' }
const btc = { id: 'm1', Ticker: 'BTC', Categoria: 'Cripto', Quantidade: 1, PrecoMedio: 100, Cotacao: 150, Posicao: 150, Segmento: 'Cripto' }

describe('runOperations — assets', () => {
  it('adds a new asset to the section of its category', () => {
    const { workspace: ws, errors } = runOperations(workspace(), 'p1', [
      { type: 'upsert_asset', ticker: 'bbse3', category: 'Ações', quantity: 200, avgPrice: 33.1, mode: 'add' },
    ])
    expect(errors).toEqual([])
    expect(ws.portfolios[0].data.acoes).toEqual([
      { Ticker: 'BBSE3', Quantidade: 200, PrecoMedio: 33.1, Cotacao: 33.1, Posicao: 6620, Segmento: 'Ações' },
    ])
    expect(ws.portfolios[0].data.total_live).toBe(6620)
    expect(ws.portfolios[0].data.resumo.total_investido).toBe(6620)
    expect(ws.portfolios[1].data.acoes).toEqual([])
  })

  it('sums quantity and recomputes the weighted average price in "add" mode, keeping the quote', () => {
    const { workspace: ws } = runOperations(workspace({ fiis: [hglg] }), 'p1', [
      { type: 'upsert_asset', ticker: 'hglg11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'add' },
    ])
    const record = ws.portfolios[0].data.fiis[0]
    expect(record.Quantidade).toBe(80)
    expect(record.PrecoMedio).toBeCloseTo((60 * 158 + 20 * 160.1) / 80, 6)
    expect(record.Cotacao).toBe(162.4)
    expect(record.Posicao).toBeCloseTo(80 * 162.4, 6)
    expect(record.Segmento).toBe('Logística')
  })

  it('replaces quantity and average price in "set" mode', () => {
    const { workspace: ws } = runOperations(workspace({ fiis: [hglg] }), 'p1', [
      { type: 'upsert_asset', ticker: 'HGLG11', category: 'FIIs', quantity: 10, avgPrice: 150, mode: 'set' },
    ])
    expect(ws.portfolios[0].data.fiis[0]).toMatchObject({ Quantidade: 10, PrecoMedio: 150, Cotacao: 162.4 })
  })

  it('stores Tesouro and Renda Fixa with their own name fields', () => {
    const { workspace: ws } = runOperations(workspace(), 'p1', [
      { type: 'upsert_asset', ticker: 'Tesouro Selic 2029', category: 'Tesouro Direto', quantity: 1.1, avgPrice: 14600, mode: 'add' },
      { type: 'upsert_asset', ticker: 'CDB BTG 112% CDI', category: 'Renda Fixa', quantity: 1, avgPrice: 5000, mode: 'add' },
    ])
    expect(ws.portfolios[0].data.tesouro[0]).toMatchObject({ Titulo: 'Tesouro Selic 2029', Vencimento: '-' })
    expect(ws.portfolios[0].data.renda_fixa[0]).toMatchObject({ Ativo: 'CDB BTG 112% CDI', Indexador: '-' })
  })

  it('stores custom-category assets in manualAssets with Categoria and an id', () => {
    const { workspace: ws } = runOperations(workspace(), 'p1', [
      { type: 'upsert_asset', ticker: 'ETH', category: 'cripto', quantity: 2, avgPrice: 10, mode: 'add' },
    ])
    const record = ws.portfolios[0].data.manualAssets[0]
    expect(record).toMatchObject({ Ticker: 'ETH', Categoria: 'Cripto', Segmento: 'Cripto', Posicao: 20 })
    expect(typeof record.id).toBe('string')
  })

  it('removes an asset and recomputes totals', () => {
    const { workspace: ws, errors } = runOperations(workspace({ fiis: [hglg] }), 'p1', [{ type: 'remove_asset', ticker: 'hglg11' }])
    expect(errors).toEqual([])
    expect(ws.portfolios[0].data.fiis).toEqual([])
    expect(ws.portfolios[0].data.total_live).toBe(0)
  })

  it('moves an asset to another category, changing section', () => {
    const { workspace: ws } = runOperations(workspace({ fiis: [{ ...hglg, Ticker: 'TAEE11' }] }), 'p1', [
      { type: 'move_asset', ticker: 'TAEE11', category: 'Ações' },
    ])
    expect(ws.portfolios[0].data.fiis).toEqual([])
    expect(ws.portfolios[0].data.acoes[0]).toMatchObject({ Ticker: 'TAEE11', Quantidade: 60, Segmento: 'Ações' })
  })

  it.each([
    [{ type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: -1, avgPrice: 1, mode: 'add' }, 'Quantidade inválida'],
    [{ type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: NaN, avgPrice: 1, mode: 'add' }, 'Quantidade inválida'],
    [{ type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: 1, avgPrice: -5, mode: 'add' }, 'Preço médio inválido'],
    [{ type: 'upsert_asset', ticker: ' ', category: 'Ações', quantity: 1, avgPrice: 1, mode: 'add' }, 'Ticker vazio'],
    [{ type: 'upsert_asset', ticker: 'X', category: 'ETFs', quantity: 1, avgPrice: 1, mode: 'add' }, 'não existe'],
    [{ type: 'remove_asset', ticker: 'NADA3' }, 'não existe na carteira'],
    [{ type: 'move_asset', ticker: 'NADA3', category: 'Ações' }, 'não existe na carteira'],
  ] as const)('rejects invalid asset operation %#', (op, message) => {
    const before = workspace()
    const { workspace: ws, errors } = runOperations(before, 'p1', [op])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain(message)
    expect(ws).toEqual(before)
  })

  it('reports an error when the target portfolio does not exist', () => {
    const { errors } = runOperations(workspace(), 'gone', [
      { type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: 1, avgPrice: 1, mode: 'add' },
    ])
    expect(errors[0]).toContain('Carteira de destino não encontrada')
  })

  it('keeps applying valid operations after an invalid one', () => {
    const { workspace: ws, errors } = runOperations(workspace(), 'p1', [
      { type: 'remove_asset', ticker: 'NADA3' },
      { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 30, mode: 'add' },
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/^Operação 1 \(remove_asset\)/)
    expect(ws.portfolios[0].data.acoes).toHaveLength(1)
  })
})

describe('runOperations — categories', () => {
  it('adds a category and lets a later operation in the same batch use it', () => {
    const { workspace: ws, errors } = runOperations(workspace(), 'p1', [
      { type: 'add_category', name: 'ETFs' },
      { type: 'upsert_asset', ticker: 'IVVB11', category: 'ETFs', quantity: 10, avgPrice: 300, mode: 'add' },
    ])
    expect(errors).toEqual([])
    expect(ws.categories).toContain('ETFs')
    expect(ws.portfolios[0].data.manualAssets[0]).toMatchObject({ Ticker: 'IVVB11', Categoria: 'ETFs' })
  })

  it('rejects a duplicate category regardless of case', () => {
    expect(runOperations(workspace(), 'p1', [{ type: 'add_category', name: 'cripto' }]).errors[0]).toContain('já existe')
  })

  it('renames a custom category in every portfolio', () => {
    const { workspace: ws, errors } = runOperations(workspace({ manualAssets: [btc] }, { manualAssets: [{ ...btc, id: 'm2' }] }), 'p1', [
      { type: 'rename_category', from: 'Cripto', to: 'Criptomoedas' },
    ])
    expect(errors).toEqual([])
    expect(ws.categories).toEqual(['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'Criptomoedas'])
    expect(ws.portfolios[0].data.manualAssets[0].Categoria).toBe('Criptomoedas')
    expect(ws.portfolios[1].data.manualAssets[0].Categoria).toBe('Criptomoedas')
  })

  it('refuses to rename or remove built-in categories', () => {
    const { errors } = runOperations(workspace(), 'p1', [
      { type: 'rename_category', from: 'FIIs', to: 'Fundos' },
      { type: 'remove_category', name: 'Ações' },
    ])
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('embutida')
    expect(errors[1]).toContain('embutida')
  })

  it('removes an empty custom category', () => {
    const { workspace: ws, errors } = runOperations(workspace(), 'p1', [{ type: 'remove_category', name: 'Cripto' }])
    expect(errors).toEqual([])
    expect(ws.categories).not.toContain('Cripto')
  })

  it('requires moveTo when the category still has assets in any portfolio', () => {
    const { errors } = runOperations(workspace({}, { manualAssets: [btc] }), 'p1', [{ type: 'remove_category', name: 'Cripto' }])
    expect(errors[0]).toContain('moveTo')
  })

  it('moves assets to moveTo before removing the category', () => {
    const { workspace: ws, errors } = runOperations(workspace({ manualAssets: [btc] }), 'p1', [
      { type: 'remove_category', name: 'Cripto', moveTo: 'Ações' },
    ])
    expect(errors).toEqual([])
    expect(ws.portfolios[0].data.manualAssets).toEqual([])
    expect(ws.portfolios[0].data.acoes[0]).toMatchObject({ Ticker: 'BTC', Quantidade: 1, Cotacao: 150 })
  })
})

describe('describeOperations', () => {
  it('labels each row with what will happen', () => {
    const rows = describeOperations(workspace({ fiis: [hglg], manualAssets: [btc] }), 'p1', [
      { type: 'upsert_asset', ticker: 'bbse3', category: 'Ações', quantity: 200, avgPrice: 33.1, mode: 'add' },
      { type: 'upsert_asset', ticker: 'hglg11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'add' },
      { type: 'upsert_asset', ticker: 'HGLG11', category: 'FIIs', quantity: 5, avgPrice: 100, mode: 'set' },
      { type: 'move_asset', ticker: 'BTC', category: 'Ações' },
      { type: 'remove_asset', ticker: 'HGLG11' },
      { type: 'add_category', name: 'ETFs' },
      { type: 'rename_category', from: 'ETFs', to: 'Fundos de Índice' },
      { type: 'remove_category', name: 'Cripto', moveTo: 'Ações' },
    ])
    expect(rows).toEqual([
      { label: 'BBSE3', category: 'Ações', quantity: 200, avgPrice: 33.1, mode: 'novo' },
      { label: 'HGLG11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'somar' },
      { label: 'HGLG11', category: 'FIIs', quantity: 5, avgPrice: 100, mode: 'substituir' },
      { label: 'BTC', category: 'Ações', mode: 'mover' },
      { label: 'HGLG11', category: 'FIIs', quantity: 5, mode: 'remover' },
      { label: 'ETFs', category: 'ETFs', mode: 'nova categoria' },
      { label: 'ETFs → Fundos de Índice', category: 'Fundos de Índice', mode: 'renomear' },
      { label: 'Cripto', category: 'Ações', mode: 'excluir categoria' },
    ])
  })

  it('marks the second upsert of the same new ticker as "somar"', () => {
    const rows = describeOperations(workspace(), 'p1', [
      { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 30, mode: 'add' },
      { type: 'upsert_asset', ticker: 'itub4', category: 'Ações', quantity: 2, avgPrice: 31, mode: 'add' },
    ])
    expect(rows.map((r) => r.mode)).toEqual(['novo', 'somar'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/operations.test.ts`
Expected: FAIL — `Failed to resolve import "./operations"`.

- [ ] **Step 3: Implementar `src/domain/operations.ts`**

```ts
import type { Portfolio, PortfolioData } from '../store/useInvestmentStore'
import {
  SECTIONS,
  categoryOfRecord,
  isBuiltinCategory,
  normalizeTicker,
  rawName,
  recordTicker,
  sectionForCategory,
  unitPrice,
  type SectionKey,
} from './assets'

export type AssetOperation =
  | { type: 'upsert_asset'; ticker: string; category: string; quantity: number; avgPrice: number; mode: 'add' | 'set' }
  | { type: 'remove_asset'; ticker: string }
  | { type: 'move_asset'; ticker: string; category: string }
  | { type: 'add_category'; name: string }
  | { type: 'rename_category'; from: string; to: string }
  | { type: 'remove_category'; name: string; moveTo?: string }

export interface Workspace {
  portfolios: Portfolio[]
  categories: string[]
}

export interface RunResult {
  workspace: Workspace
  errors: string[]
}

export type PreviewMode =
  | 'novo'
  | 'somar'
  | 'substituir'
  | 'remover'
  | 'mover'
  | 'nova categoria'
  | 'renomear'
  | 'excluir categoria'

export interface PreviewRow {
  label: string
  category: string
  quantity?: number
  avgPrice?: number
  mode: PreviewMode
}

interface Located {
  section: SectionKey
  index: number
  record: any
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

const findCategory = (categories: string[], name: string | undefined): string | undefined =>
  name ? categories.find((c) => sameName(c, name)) : undefined

const sectionList = (data: PortfolioData, section: SectionKey): any[] => ((data as any)[section] || []) as any[]

function locate(data: PortfolioData, ticker: string): Located | null {
  const wanted = normalizeTicker(ticker)
  for (const section of SECTIONS) {
    const index = sectionList(data, section).findIndex((r) => recordTicker(r) === wanted)
    if (index >= 0) return { section, index, record: sectionList(data, section)[index] }
  }
  return null
}

function withTotals(data: PortfolioData): PortfolioData {
  const all = SECTIONS.flatMap((section) => sectionList(data, section))
  return {
    ...data,
    total_live: all.reduce((acc, r) => acc + (Number(r.Posicao) || 0), 0),
    resumo: {
      saldo_disponivel: data.resumo?.saldo_disponivel || 0,
      saldo_projetado: data.resumo?.saldo_projetado || 0,
      total_investido: all.reduce((acc, r) => acc + (Number(r.PrecoMedio) || 0) * (Number(r.Quantidade) || 0), 0),
    },
  }
}

const displayName = (section: SectionKey, ticker: string, previous?: any): string =>
  section === 'acoes' || section === 'fiis' ? normalizeTicker(ticker) : previous ? rawName(previous) : ticker.trim()

function buildRecord(
  section: SectionKey,
  name: string,
  category: string,
  quantity: number,
  avgPrice: number,
  price: number,
  previous: any,
  keepSegment: boolean,
): any {
  const rest: any = { ...(previous || {}) }
  for (const field of ['Ticker', 'Titulo', 'Ativo', 'Categoria', 'portfolioId', 'portfolioName', 'portfolioColor']) {
    delete rest[field]
  }
  const base = { ...rest, Quantidade: quantity, PrecoMedio: avgPrice, Cotacao: price, Posicao: quantity * price }
  const segment = keepSegment && rest.Segmento ? rest.Segmento : category
  if (section === 'tesouro') return { ...base, Titulo: name, Vencimento: rest.Vencimento ?? '-' }
  if (section === 'renda_fixa') return { ...base, Ativo: name, Indexador: rest.Indexador ?? '-' }
  if (section === 'manualAssets') {
    return { ...base, id: rest.id ?? crypto.randomUUID(), Ticker: name, Categoria: category, Segmento: segment }
  }
  return { ...base, Ticker: name, Segmento: segment }
}

function put(data: PortfolioData, found: Located | null, section: SectionKey, record: any): PortfolioData {
  const next: any = { ...data }
  if (found && found.section === section) {
    next[section] = sectionList(data, section).map((r, i) => (i === found.index ? record : r))
  } else {
    if (found) next[found.section] = sectionList(data, found.section).filter((_, i) => i !== found.index)
    next[section] = [...sectionList(next, section), record]
  }
  return withTotals(next)
}

function moveRecord(data: PortfolioData, found: Located, category: string): PortfolioData {
  const section = sectionForCategory(category)
  const record = buildRecord(
    section,
    displayName(section, rawName(found.record), found.record),
    category,
    Number(found.record.Quantidade) || 0,
    Number(found.record.PrecoMedio) || 0,
    unitPrice(found.record),
    found.record,
    false,
  )
  return put(data, found, section, record)
}

function applyAssetOperation(
  data: PortfolioData,
  categories: string[],
  op: Extract<AssetOperation, { ticker: string }>,
): PortfolioData {
  const ticker = (op.ticker || '').trim()
  if (!ticker) throw new Error('Ticker vazio.')
  const found = locate(data, ticker)

  if (op.type === 'remove_asset') {
    if (!found) throw new Error(`O ativo ${ticker} não existe na carteira.`)
    return withTotals({
      ...data,
      [found.section]: sectionList(data, found.section).filter((_, i) => i !== found.index),
    } as PortfolioData)
  }

  const category = findCategory(categories, op.category)
  if (!category) throw new Error(`A categoria "${op.category}" não existe. Crie-a com add_category antes de usá-la.`)

  if (op.type === 'move_asset') {
    if (!found) throw new Error(`O ativo ${ticker} não existe na carteira.`)
    return moveRecord(data, found, category)
  }

  if (!Number.isFinite(op.quantity) || op.quantity <= 0) throw new Error(`Quantidade inválida para ${ticker}.`)
  if (!Number.isFinite(op.avgPrice) || op.avgPrice < 0) throw new Error(`Preço médio inválido para ${ticker}.`)

  const section = sectionForCategory(category)
  const previousQuantity = found ? Number(found.record.Quantidade) || 0 : 0
  const previousAvgPrice = found ? Number(found.record.PrecoMedio) || 0 : 0
  const adding = found !== null && op.mode === 'add'
  const quantity = adding ? previousQuantity + op.quantity : op.quantity
  const avgPrice = adding
    ? (previousQuantity * previousAvgPrice + op.quantity * op.avgPrice) / quantity
    : op.avgPrice
  const price = (found ? unitPrice(found.record) : 0) || avgPrice
  const record = buildRecord(
    section,
    displayName(section, ticker, found?.record),
    category,
    quantity,
    avgPrice,
    price,
    found?.record,
    found?.section === section,
  )
  return put(data, found, section, record)
}

function moveCategoryAssets(portfolio: Portfolio, from: string, to: string): Portfolio {
  let data = portfolio.data
  for (;;) {
    const index = sectionList(data, 'manualAssets').findIndex((r) => (r.Categoria || 'Outros') === from)
    if (index < 0) break
    data = moveRecord(data, { section: 'manualAssets', index, record: sectionList(data, 'manualAssets')[index] }, to)
  }
  return data === portfolio.data ? portfolio : { ...portfolio, data }
}

function applyOne(workspace: Workspace, targetPortfolioId: string, op: AssetOperation): Workspace {
  switch (op.type) {
    case 'upsert_asset':
    case 'remove_asset':
    case 'move_asset': {
      const target = workspace.portfolios.find((p) => p.id === targetPortfolioId)
      if (!target) throw new Error('Carteira de destino não encontrada.')
      const data = applyAssetOperation(target.data, workspace.categories, op)
      return { ...workspace, portfolios: workspace.portfolios.map((p) => (p.id === targetPortfolioId ? { ...p, data } : p)) }
    }
    case 'add_category': {
      const name = (op.name || '').trim()
      if (!name) throw new Error('Nome de categoria vazio.')
      if (findCategory(workspace.categories, name)) throw new Error(`A categoria "${name}" já existe.`)
      return { ...workspace, categories: [...workspace.categories, name] }
    }
    case 'rename_category': {
      const from = findCategory(workspace.categories, op.from)
      const to = (op.to || '').trim()
      if (!from) throw new Error(`A categoria "${op.from}" não existe.`)
      if (isBuiltinCategory(from)) throw new Error(`A categoria "${from}" é embutida e não pode ser renomeada.`)
      if (!to) throw new Error('Novo nome de categoria vazio.')
      if (findCategory(workspace.categories, to)) throw new Error(`A categoria "${to}" já existe.`)
      return {
        categories: workspace.categories.map((c) => (c === from ? to : c)),
        portfolios: workspace.portfolios.map((p) => moveCategoryAssets(p, from, to)),
      }
    }
    case 'remove_category': {
      const name = findCategory(workspace.categories, op.name)
      if (!name) throw new Error(`A categoria "${op.name}" não existe.`)
      if (isBuiltinCategory(name)) throw new Error(`A categoria "${name}" é embutida e não pode ser excluída.`)
      const inUse = workspace.portfolios.some((p) =>
        sectionList(p.data, 'manualAssets').some((r) => (r.Categoria || 'Outros') === name),
      )
      let portfolios = workspace.portfolios
      if (inUse) {
        const moveTo = findCategory(workspace.categories, op.moveTo)
        if (!moveTo || moveTo === name) {
          throw new Error(`A categoria "${name}" ainda tem ativos; informe moveTo com outra categoria existente.`)
        }
        portfolios = workspace.portfolios.map((p) => moveCategoryAssets(p, name, moveTo))
      }
      return { categories: workspace.categories.filter((c) => c !== name), portfolios }
    }
    default:
      throw new Error('Tipo de operação desconhecido.')
  }
}

export function runOperations(
  workspace: Workspace,
  targetPortfolioId: string,
  operations: AssetOperation[],
): RunResult {
  let current = workspace
  const errors: string[] = []
  operations.forEach((op, index) => {
    try {
      current = applyOne(current, targetPortfolioId, op)
    } catch (error) {
      errors.push(`Operação ${index + 1} (${op.type}): ${(error as Error).message}`)
    }
  })
  return { workspace: current, errors }
}

export function describeOperations(
  workspace: Workspace,
  targetPortfolioId: string,
  operations: AssetOperation[],
): PreviewRow[] {
  let current = workspace
  const rows: PreviewRow[] = []
  for (const op of operations) {
    const target = current.portfolios.find((p) => p.id === targetPortfolioId)
    const found = target && 'ticker' in op ? locate(target.data, op.ticker) : null
    const assetLabel = (ticker: string) => (found ? recordTicker(found.record) : normalizeTicker(ticker))
    switch (op.type) {
      case 'upsert_asset': {
        const section = sectionForCategory(findCategory(current.categories, op.category) ?? op.category)
        rows.push({
          label: found ? displayName(found.section, rawName(found.record), found.record) : displayName(section, op.ticker),
          category: findCategory(current.categories, op.category) ?? op.category,
          quantity: op.quantity,
          avgPrice: op.avgPrice,
          mode: found ? (op.mode === 'add' ? 'somar' : 'substituir') : 'novo',
        })
        break
      }
      case 'remove_asset':
        rows.push({
          label: found ? displayName(found.section, rawName(found.record), found.record) : assetLabel(op.ticker),
          category: found ? categoryOfRecord(found.record, found.section) : '—',
          ...(found ? { quantity: Number(found.record.Quantidade) || 0 } : {}),
          mode: 'remover',
        })
        break
      case 'move_asset':
        rows.push({
          label: found ? displayName(found.section, rawName(found.record), found.record) : assetLabel(op.ticker),
          category: findCategory(current.categories, op.category) ?? op.category,
          mode: 'mover',
        })
        break
      case 'add_category':
        rows.push({ label: op.name.trim(), category: op.name.trim(), mode: 'nova categoria' })
        break
      case 'rename_category':
        rows.push({ label: `${op.from} → ${op.to}`, category: op.to, mode: 'renomear' })
        break
      case 'remove_category':
        rows.push({ label: op.name, category: op.moveTo ?? '—', mode: 'excluir categoria' })
        break
    }
    current = runOperations(current, targetPortfolioId, [op]).workspace
  }
  return rows
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/operations.test.ts`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: termina com `✓ built in`, sem erros do `tsc`.

- [ ] **Step 6: Commit**

```bash
git add src/domain/operations.ts src/domain/operations.test.ts
git commit -m "feat: add validated asset and category operations"
```

---

### Task 4: View model do painel da carteira (`src/domain/portfolioView.ts`)

**Files:**
- Create: `src/domain/portfolioView.ts`
- Test: `src/domain/portfolioView.test.ts`

**Interfaces:**
- Consumes: `Asset` de `src/domain/assets.ts`.
- Produces (de `src/domain/portfolioView.ts`):

```ts
export const CHART_COLORS: string[]
export const ALL_FILTER = 'Todos'
export function categoryColor(category: string, categories: string[]): string
export interface Pill { label: string; value: number; share: number | null }
export interface Slice { name: string; value: number; color: string; selectable: boolean }
export interface AssetRow { key: string; ticker: string; subtitle: string; price: number; avgPrice: number; allocation: number; returnPct: number; value: number; quantity: number }
export interface PortfolioView { filter: string; total: number; base: number; pills: Pill[]; slices: Slice[]; rows: AssetRow[] }
export function buildPortfolioView(assets: Asset[], categories: string[], requestedFilter: string): PortfolioView
export function donutBackground(slices: Slice[]): string
```

Comportamento (igual ao protótipo):
- Em "Todos", o donut tem uma fatia por categoria com valor > 0, clicável. Com uma categoria selecionada, tem uma fatia por ativo (as 8 maiores; o resto vira `Outros`, cor `#52525b`), não clicável.
- `allocation` é a porcentagem do ativo sobre `base` (total geral em "Todos"; total da categoria quando filtrado).
- Se o filtro pedido não tem mais ativos, o view volta para "Todos".

- [ ] **Step 1: Escrever os testes que falham**

`src/domain/portfolioView.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Asset } from './assets'
import { CHART_COLORS, buildPortfolioView, categoryColor, donutBackground } from './portfolioView'

const asset = (ticker: string, category: string, value: number, extra: Partial<Asset> = {}): Asset => ({
  key: ticker,
  ticker,
  category,
  section: 'acoes',
  segment: 'Seg',
  quantity: 10,
  avgPrice: 8,
  price: value / 10,
  value,
  ...extra,
})

const categories = ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'Cripto']
const assets = [asset('ITUB4', 'Ações', 600), asset('WEGE3', 'Ações', 200), asset('HGLG11', 'FIIs', 200)]

describe('buildPortfolioView', () => {
  it('builds pills for "Todos" plus each category that has assets', () => {
    const view = buildPortfolioView(assets, categories, 'Todos')
    expect(view.total).toBe(1000)
    expect(view.pills).toEqual([
      { label: 'Todos', value: 1000, share: null },
      { label: 'Ações', value: 800, share: 80 },
      { label: 'FIIs', value: 200, share: 20 },
    ])
  })

  it('slices by category when showing everything', () => {
    const view = buildPortfolioView(assets, categories, 'Todos')
    expect(view.slices).toEqual([
      { name: 'Ações', value: 800, color: CHART_COLORS[0], selectable: true },
      { name: 'FIIs', value: 200, color: CHART_COLORS[1], selectable: true },
    ])
  })

  it('slices by asset and computes allocation inside the selected category', () => {
    const view = buildPortfolioView(assets, categories, 'Ações')
    expect(view.base).toBe(800)
    expect(view.slices.map((s) => [s.name, s.selectable])).toEqual([
      ['ITUB4', false],
      ['WEGE3', false],
    ])
    expect(view.rows.map((r) => [r.ticker, r.allocation, r.subtitle])).toEqual([
      ['ITUB4', 75, 'Seg'],
      ['WEGE3', 25, 'Seg'],
    ])
  })

  it('sorts rows by value and prefixes the subtitle with the category in "Todos"', () => {
    const view = buildPortfolioView(assets, categories, 'Todos')
    expect(view.rows.map((r) => r.ticker)).toEqual(['ITUB4', 'WEGE3', 'HGLG11'])
    expect(view.rows[0].subtitle).toBe('Ações · Seg')
    expect(view.rows[0].returnPct).toBeCloseTo(((60 - 8) / 8) * 100, 6)
  })

  it('groups assets beyond the eighth into "Outros"', () => {
    const many = Array.from({ length: 10 }, (_, i) => asset(`AAA${i}`, 'Ações', 100 - i))
    const view = buildPortfolioView(many, categories, 'Ações')
    expect(view.slices).toHaveLength(9)
    expect(view.slices[8]).toEqual({ name: 'Outros', value: 92 + 91, color: '#52525b', selectable: false })
  })

  it('falls back to "Todos" when the requested category has no assets', () => {
    expect(buildPortfolioView(assets, categories, 'Cripto').filter).toBe('Todos')
  })

  it('returns zero return when there is no average price and handles an empty portfolio', () => {
    const view = buildPortfolioView([asset('X', 'Ações', 100, { avgPrice: 0 })], categories, 'Todos')
    expect(view.rows[0].returnPct).toBe(0)
    const empty = buildPortfolioView([], categories, 'Todos')
    expect(empty.pills).toEqual([{ label: 'Todos', value: 0, share: null }])
    expect(empty.slices).toEqual([])
    expect(empty.rows).toEqual([])
  })

  it('gives categories outside the known list a color after the known ones', () => {
    expect(categoryColor('Cripto', categories)).toBe(CHART_COLORS[4])
    expect(categoryColor('Nova', categories)).toBe(CHART_COLORS[5])
  })
})

describe('donutBackground', () => {
  it('returns a neutral fill when there is nothing to draw', () => {
    expect(donutBackground([])).toBe('rgba(255,255,255,.05)')
  })

  it('draws one segment per slice with a small gap', () => {
    const css = donutBackground([
      { name: 'A', value: 50, color: '#4F46E5', selectable: true },
      { name: 'B', value: 50, color: '#10B981', selectable: true },
    ])
    expect(css.startsWith('conic-gradient(')).toBe(true)
    expect(css).toContain('#4F46E5 1.2deg 178.8deg')
    expect(css).toContain('#10B981 181.2deg 358.8deg')
  })

  it('draws a full ring without gaps for a single slice', () => {
    expect(donutBackground([{ name: 'A', value: 10, color: '#4F46E5', selectable: true }])).toContain('#4F46E5 0deg 360deg')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/portfolioView.test.ts`
Expected: FAIL — `Failed to resolve import "./portfolioView"`.

- [ ] **Step 3: Implementar `src/domain/portfolioView.ts`**

```ts
import type { Asset } from './assets'

export const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#6366F1']
export const ALL_FILTER = 'Todos'
const OTHERS_COLOR = '#52525b'
const MAX_ASSET_SLICES = 8

export interface Pill {
  label: string
  value: number
  share: number | null
}

export interface Slice {
  name: string
  value: number
  color: string
  selectable: boolean
}

export interface AssetRow {
  key: string
  ticker: string
  subtitle: string
  price: number
  avgPrice: number
  allocation: number
  returnPct: number
  value: number
  quantity: number
}

export interface PortfolioView {
  filter: string
  total: number
  base: number
  pills: Pill[]
  slices: Slice[]
  rows: AssetRow[]
}

export function categoryColor(category: string, categories: string[]): string {
  const index = categories.indexOf(category)
  return CHART_COLORS[(index >= 0 ? index : categories.length) % CHART_COLORS.length]
}

export function buildPortfolioView(assets: Asset[], categories: string[], requestedFilter: string): PortfolioView {
  const byCategory = new Map<string, number>()
  let total = 0
  for (const asset of assets) {
    byCategory.set(asset.category, (byCategory.get(asset.category) || 0) + asset.value)
    total += asset.value
  }
  const present = [
    ...categories.filter((c) => byCategory.has(c)),
    ...Array.from(byCategory.keys()).filter((c) => !categories.includes(c)),
  ]
  const filter = present.includes(requestedFilter) ? requestedFilter : ALL_FILTER
  const isAll = filter === ALL_FILTER
  const base = isAll ? total : byCategory.get(filter) || 0
  const share = (value: number, of: number) => (of > 0 ? (value / of) * 100 : 0)

  const pills: Pill[] = [
    { label: ALL_FILTER, value: total, share: null },
    ...present.map((c) => ({ label: c, value: byCategory.get(c) || 0, share: share(byCategory.get(c) || 0, total) })),
  ]

  const visible = assets.filter((a) => isAll || a.category === filter).sort((a, b) => b.value - a.value)

  let slices: Slice[]
  if (isAll) {
    slices = present
      .filter((c) => (byCategory.get(c) || 0) > 0)
      .map((c) => ({ name: c, value: byCategory.get(c) || 0, color: categoryColor(c, categories), selectable: true }))
  } else {
    const positive = visible.filter((a) => a.value > 0)
    slices = positive.slice(0, MAX_ASSET_SLICES).map((a, i) => ({
      name: a.ticker,
      value: a.value,
      color: CHART_COLORS[i % CHART_COLORS.length],
      selectable: false,
    }))
    const rest = positive.slice(MAX_ASSET_SLICES).reduce((acc, a) => acc + a.value, 0)
    if (rest > 0) slices.push({ name: 'Outros', value: rest, color: OTHERS_COLOR, selectable: false })
  }

  const rows: AssetRow[] = visible.map((a) => ({
    key: `${a.section}:${a.key}`,
    ticker: a.ticker,
    subtitle: isAll ? `${a.category} · ${a.segment}` : a.segment,
    price: a.price,
    avgPrice: a.avgPrice,
    allocation: share(a.value, base),
    returnPct: a.avgPrice > 0 ? ((a.price - a.avgPrice) / a.avgPrice) * 100 : 0,
    value: a.value,
    quantity: a.quantity,
  }))

  return { filter, total, base, pills, slices, rows }
}

export function donutBackground(slices: Slice[]): string {
  const base = slices.reduce((acc, s) => acc + s.value, 0)
  if (slices.length === 0 || base <= 0) return 'rgba(255,255,255,.05)'
  const gap = slices.length > 1 ? 1.2 : 0
  const stops: string[] = []
  let acc = 0
  for (const slice of slices) {
    const start = (acc / base) * 360
    const end = ((acc + slice.value) / base) * 360
    acc += slice.value
    stops.push(
      `transparent ${start}deg ${start + gap}deg`,
      `${slice.color} ${start + gap}deg ${end - gap}deg`,
      `transparent ${end - gap}deg ${end}deg`,
    )
  }
  return `conic-gradient(${stops.join(',')})`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/portfolioView.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/portfolioView.ts src/domain/portfolioView.test.ts
git commit -m "feat: add portfolio panel view model"
```

---

### Task 5: Ação `applyAssetOperations` no store de investimentos

**Files:**
- Modify: `src/store/useInvestmentStore.ts`
- Test: `src/store/useInvestmentStore.test.ts`

**Interfaces:**
- Consumes: `runOperations`, `AssetOperation` de `src/domain/operations.ts`; `collectCategories` de `src/domain/assets.ts`.
- Produces:
  - `resolveWritablePortfolioId(portfolios: Portfolio[], activePortfolioId: string): string` (export nomeado do store) — devolve `activePortfolioId` se for uma carteira existente; senão o id da primeira carteira; senão `'default'`.
  - Ação `applyAssetOperations(targetPortfolioId: string, operations: AssetOperation[]): void` — **lança `Error`** (mensagens unidas por `\n`) e não altera nada se qualquer operação for inválida.

A remoção de `importConfig` **não** é feita aqui; fica na Task 13, junto com os arquivos que ainda o usam.

- [ ] **Step 1: Escrever os testes que falham**

`src/store/useInvestmentStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { resolveWritablePortfolioId, useInvestmentStore } from './useInvestmentStore'

const store = () => useInvestmentStore.getState()

beforeEach(() => {
  store().clearAllData()
})

describe('applyAssetOperations', () => {
  it('applies operations to the target portfolio and refreshes the derived view', () => {
    store().applyAssetOperations('default', [
      { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 100, avgPrice: 30, mode: 'add' },
    ])
    expect(store().portfolios[0].data.acoes).toHaveLength(1)
    expect(store().portfolio?.total_live).toBe(3000)
  })

  it('stores new categories', () => {
    store().applyAssetOperations('default', [{ type: 'add_category', name: 'ETFs' }])
    expect(store().assetCategories).toContain('ETFs')
  })

  it('throws and leaves the state untouched when any operation is invalid', () => {
    const before = store().portfolios
    expect(() =>
      store().applyAssetOperations('default', [
        { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 100, avgPrice: 30, mode: 'add' },
        { type: 'remove_asset', ticker: 'NADA3' },
      ]),
    ).toThrow(/NADA3/)
    expect(store().portfolios).toBe(before)
  })

  it('throws when the target portfolio no longer exists', () => {
    expect(() =>
      store().applyAssetOperations('gone', [
        { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 1, mode: 'add' },
      ]),
    ).toThrow(/Carteira de destino não encontrada/)
  })

  it('updates updatedAt only on portfolios whose data changed', () => {
    const otherId = store().addPortfolio('Outra')
    useInvestmentStore.setState((s) => ({
      portfolios: s.portfolios.map((p) => ({ ...p, updatedAt: '2000-01-01T00:00:00.000Z' })),
    }))
    store().applyAssetOperations('default', [
      { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 1, mode: 'add' },
    ])
    const byId = Object.fromEntries(store().portfolios.map((p) => [p.id, p.updatedAt]))
    expect(byId.default).not.toBe('2000-01-01T00:00:00.000Z')
    expect(byId[otherId]).toBe('2000-01-01T00:00:00.000Z')
  })
})

describe('resolveWritablePortfolioId', () => {
  it('keeps the active portfolio when it exists', () => {
    expect(resolveWritablePortfolioId(store().portfolios, 'default')).toBe('default')
  })

  it('falls back to the first portfolio for the consolidated view or an unknown id', () => {
    expect(resolveWritablePortfolioId(store().portfolios, 'all')).toBe('default')
    expect(resolveWritablePortfolioId(store().portfolios, 'missing')).toBe('default')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/store/useInvestmentStore.test.ts`
Expected: FAIL — `resolveWritablePortfolioId` não é exportado / `applyAssetOperations is not a function`.

- [ ] **Step 3: Implementar no store**

Em `src/store/useInvestmentStore.ts`:

(a) No topo, depois de `import { persist } from 'zustand/middleware'`:

```ts
import { collectCategories } from '../domain/assets'
import { runOperations, type AssetOperation } from '../domain/operations'
```

(b) Logo depois da função `mergePortfolioData` (antes de `interface InvestmentStore`):

```ts
export const resolveWritablePortfolioId = (portfolios: Portfolio[], activePortfolioId: string): string => {
  if (portfolios.some((p) => p.id === activePortfolioId)) return activePortfolioId;
  return portfolios[0]?.id || 'default';
};
```

(c) Em `interface InvestmentStore`, depois da linha `updateAsset: (...) => void`:

```ts
  applyAssetOperations: (targetPortfolioId: string, operations: AssetOperation[]) => void
```

(d) Na implementação, imediatamente antes de `clearAllData: () => set({`:

```ts
      applyAssetOperations: (targetPortfolioId, operations) => {
        const state = get();
        const { workspace, errors } = runOperations(
          { portfolios: state.portfolios, categories: collectCategories(state.assetCategories, state.portfolios) },
          targetPortfolioId,
          operations
        );
        if (errors.length > 0) throw new Error(errors.join('\n'));

        const now = new Date().toISOString();
        const portfolios = workspace.portfolios.map((p, index) =>
          p.data === state.portfolios[index].data ? p : { ...p, updatedAt: now }
        );

        set({
          portfolios,
          assetCategories: workspace.categories,
          portfolio: updatePortfolioDerivedView(portfolios, state.activePortfolioId)
        });
      },

```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/store/useInvestmentStore.test.ts && npm run build`
Expected: 7 testes passam; build ok.

- [ ] **Step 5: Commit**

```bash
git add src/store/useInvestmentStore.ts src/store/useInvestmentStore.test.ts
git commit -m "feat: add applyAssetOperations store action"
```

---

### Task 6: Cliente OpenRouter e configurações de IA

**Files:**
- Create: `src/lib/openrouter/client.ts`
- Create: `src/lib/openrouter/models.ts`
- Create: `src/store/useAiSettingsStore.ts`
- Test: `src/lib/openrouter/client.test.ts`
- Test: `src/store/useAiSettingsStore.test.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces:

```ts
// src/lib/openrouter/client.ts
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export type AssistantMessage = { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | AssistantMessage
  | { role: 'tool'; tool_call_id: string; content: string }
export interface ToolDefinition { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
export class OpenRouterError extends Error { status: number }
export function validateKey(apiKey: string, fetchImpl?: typeof fetch): Promise<'valid' | 'invalid'>
export interface ChatCompletionParams { apiKey: string; model: string; messages: ChatMessage[]; tools: ToolDefinition[] }
export function createChatCompletion(params: ChatCompletionParams, fetchImpl?: typeof fetch): Promise<AssistantMessage>

// src/lib/openrouter/models.ts
export const MODEL_PRESETS: { id: string; note: string }[]
export const DEFAULT_MODEL: string
export const shortModelName: (id: string) => string

// src/store/useAiSettingsStore.ts
export type KeyStatus = 'missing' | 'unknown' | 'valid' | 'invalid'
export const useAiSettingsStore // { apiKey: string; keyStatus: KeyStatus; model: string;
                                //   setApiKey(key: string, status: KeyStatus): void; markKeyStatus(status: KeyStatus): void;
                                //   clearApiKey(): void; setModel(model: string): void }
```

Semântica de `keyStatus`: `missing` = sem chave; `unknown` = há chave salva ainda não revalidada nesta sessão; `valid`/`invalid` = resultado da última validação. `keyStatus` **não** é persistido: ao recarregar a página vira `unknown` (se houver chave) ou `missing`.

- [ ] **Step 1: Escrever os testes do cliente**

`src/lib/openrouter/client.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { OpenRouterError, createChatCompletion, validateKey } from './client'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('validateKey', () => {
  it('calls the key endpoint with the bearer token and reports a valid key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { label: 'k' } }))
    await expect(validateKey('sk-or-abc', fetchMock)).resolves.toBe('valid')
    expect(fetchMock).toHaveBeenCalledWith('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: 'Bearer sk-or-abc' },
    })
  })

  it('reports an invalid key on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: 'No auth' } }))
    await expect(validateKey('bad', fetchMock)).resolves.toBe('invalid')
  })

  it('throws on other HTTP errors so callers do not treat an outage as an invalid key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, {}))
    await expect(validateKey('k', fetchMock)).rejects.toMatchObject({ name: 'OpenRouterError', status: 503 })
  })
})

describe('createChatCompletion', () => {
  const params = {
    apiKey: 'sk-or-abc',
    model: 'stealth/space-bunny-alpha',
    messages: [{ role: 'user' as const, content: 'oi' }],
    tools: [],
  }

  it('posts model, messages and tools and returns the assistant message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { choices: [{ message: { role: 'assistant', content: 'olá', tool_calls: [] } }] }),
    )
    await expect(createChatCompletion(params, fetchMock)).resolves.toEqual({ role: 'assistant', content: 'olá' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer sk-or-abc')
    expect(JSON.parse(init.body)).toEqual({ model: params.model, messages: params.messages, tools: [] })
  })

  it('keeps tool calls in the returned message', async () => {
    const toolCalls = [{ id: 'call_1', type: 'function', function: { name: 'get_portfolio', arguments: '{}' } }]
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { choices: [{ message: { role: 'assistant', content: null, tool_calls: toolCalls } }] }),
    )
    await expect(createChatCompletion(params, fetchMock)).resolves.toEqual({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls,
    })
  })

  it('throws OpenRouterError with the HTTP status and the API message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: 'Invalid credentials' } }))
    const error = await createChatCompletion(params, fetchMock).catch((e) => e)
    expect(error).toBeInstanceOf(OpenRouterError)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Invalid credentials')
  })

  it('throws when a 200 response carries an error instead of choices', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { error: { message: 'Provider returned error' } }))
    await expect(createChatCompletion(params, fetchMock)).rejects.toMatchObject({
      status: 502,
      message: 'Provider returned error',
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/openrouter/client.test.ts`
Expected: FAIL — `Failed to resolve import "./client"`.

- [ ] **Step 3: Implementar `src/lib/openrouter/client.ts`**

```ts
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type AssistantMessage = { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | AssistantMessage
  | { role: 'tool'; tool_call_id: string; content: string }

export interface ToolDefinition {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export class OpenRouterError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'OpenRouterError'
    this.status = status
  }
}

export async function validateKey(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<'valid' | 'invalid'> {
  const response = await fetchImpl(`${OPENROUTER_BASE_URL}/key`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (response.ok) return 'valid'
  if (response.status === 401) return 'invalid'
  throw new OpenRouterError(`Falha ao validar a chave (HTTP ${response.status}).`, response.status)
}

export interface ChatCompletionParams {
  apiKey: string
  model: string
  messages: ChatMessage[]
  tools: ToolDefinition[]
}

export async function createChatCompletion(
  { apiKey, model, messages, tools }: ChatCompletionParams,
  fetchImpl: typeof fetch = fetch,
): Promise<AssistantMessage> {
  const response = await fetchImpl(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Dashboard Invest',
    },
    body: JSON.stringify({ model, messages, tools }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new OpenRouterError(body?.error?.message || `HTTP ${response.status}`, response.status)
  }
  const message = body?.choices?.[0]?.message
  if (!message) throw new OpenRouterError(body?.error?.message || 'Resposta vazia do modelo.', 502)
  return {
    role: 'assistant',
    content: message.content ?? null,
    ...(Array.isArray(message.tool_calls) && message.tool_calls.length > 0 ? { tool_calls: message.tool_calls } : {}),
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/openrouter/client.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Criar `src/lib/openrouter/models.ts`**

```ts
export const MODEL_PRESETS = [
  { id: 'stealth/space-bunny-alpha', note: 'Padrão' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', note: 'Grátis' },
  { id: 'deepseek/deepseek-r1', note: 'Raciocínio' },
  { id: 'openrouter/auto', note: 'Automático' },
]

export const DEFAULT_MODEL = MODEL_PRESETS[0].id

export const shortModelName = (id: string): string => id.split('/').pop() || id
```

- [ ] **Step 6: Escrever os testes do store de configurações**

`src/store/useAiSettingsStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_MODEL } from '../lib/openrouter/models'
import { useAiSettingsStore } from './useAiSettingsStore'

const store = () => useAiSettingsStore.getState()

beforeEach(() => {
  useAiSettingsStore.setState({ apiKey: '', keyStatus: 'missing', model: DEFAULT_MODEL })
})

describe('useAiSettingsStore', () => {
  it('starts without a key and with the default model', () => {
    expect(store()).toMatchObject({ apiKey: '', keyStatus: 'missing', model: 'stealth/space-bunny-alpha' })
  })

  it('saves and clears the key', () => {
    store().setApiKey('  sk-or-abc  ', 'valid')
    expect(store()).toMatchObject({ apiKey: 'sk-or-abc', keyStatus: 'valid' })
    store().clearApiKey()
    expect(store()).toMatchObject({ apiKey: '', keyStatus: 'missing' })
  })

  it('ignores an empty model id', () => {
    store().setModel('   ')
    expect(store().model).toBe(DEFAULT_MODEL)
    store().setModel(' deepseek/deepseek-r1 ')
    expect(store().model).toBe('deepseek/deepseek-r1')
  })

  it('persists key and model but not the key status', () => {
    store().setApiKey('sk-or-abc', 'valid')
    const saved = JSON.parse(localStorage.getItem('ai-settings') || '{}')
    expect(saved.state).toEqual({ apiKey: 'sk-or-abc', model: DEFAULT_MODEL })
  })

  it('rehydrates a saved key as "unknown" so it is validated again', async () => {
    localStorage.setItem('ai-settings', JSON.stringify({ state: { apiKey: 'sk-or-abc', model: 'x/y' }, version: 0 }))
    await useAiSettingsStore.persist.rehydrate()
    expect(store()).toMatchObject({ apiKey: 'sk-or-abc', keyStatus: 'unknown', model: 'x/y' })
  })

  it('rehydrates as "missing" when nothing is saved', async () => {
    localStorage.removeItem('ai-settings')
    store().markKeyStatus('valid')
    localStorage.setItem('ai-settings', JSON.stringify({ state: { apiKey: '', model: DEFAULT_MODEL }, version: 0 }))
    await useAiSettingsStore.persist.rehydrate()
    expect(store().keyStatus).toBe('missing')
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/store/useAiSettingsStore.test.ts`
Expected: FAIL — `Failed to resolve import "./useAiSettingsStore"`.

- [ ] **Step 8: Implementar `src/store/useAiSettingsStore.ts`**

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_MODEL } from '../lib/openrouter/models'

export type KeyStatus = 'missing' | 'unknown' | 'valid' | 'invalid'

interface AiSettingsStore {
  apiKey: string
  keyStatus: KeyStatus
  model: string
  setApiKey: (key: string, status: KeyStatus) => void
  markKeyStatus: (status: KeyStatus) => void
  clearApiKey: () => void
  setModel: (model: string) => void
}

export const useAiSettingsStore = create<AiSettingsStore>()(
  persist(
    (set) => ({
      apiKey: '',
      keyStatus: 'missing',
      model: DEFAULT_MODEL,
      setApiKey: (key, status) => set({ apiKey: key.trim(), keyStatus: status }),
      markKeyStatus: (keyStatus) => set({ keyStatus }),
      clearApiKey: () => set({ apiKey: '', keyStatus: 'missing' }),
      setModel: (model) => set((state) => ({ model: model.trim() || state.model })),
    }),
    {
      name: 'ai-settings',
      partialize: (state) => ({ apiKey: state.apiKey, model: state.model }),
      merge: (persisted, current) => {
        const saved = (persisted || {}) as Partial<AiSettingsStore>
        return {
          ...current,
          apiKey: saved.apiKey || '',
          model: saved.model || current.model,
          keyStatus: saved.apiKey ? 'unknown' : 'missing',
        }
      },
    },
  ),
)
```

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run src/store/useAiSettingsStore.test.ts && npm run build`
Expected: 6 testes passam; build ok.

- [ ] **Step 10: Commit**

```bash
git add src/lib/openrouter src/store/useAiSettingsStore.ts src/store/useAiSettingsStore.test.ts
git commit -m "feat: add OpenRouter client and AI settings store"
```

---

### Task 7: Anexos do chat (`src/chat/attachments.ts`)

**Files:**
- Create: `src/chat/attachments.ts`
- Test: `src/chat/attachments.test.ts`

**Interfaces:**
- Consumes: pacote `xlsx` (já instalado).
- Produces:

```ts
export const ACCEPTED_EXTENSIONS: string[]            // ['.xlsx', '.xls', '.csv']
export const MAX_ROWS_PER_SHEET = 300
export const MAX_PROMPT_CHARS = 60_000
export type Sheets = Record<string, unknown[][]>
export interface PreparedAttachment { name: string; meta: string; promptText: string }
export function readSheets(file: File): Promise<Sheets>
export function sheetsToPromptText(fileName: string, sheets: Sheets): { text: string; truncated: boolean; rowCount: number }
export function prepareAttachment(file: File): Promise<PreparedAttachment>   // lança Error com mensagem em pt-BR
```

O arquivo é lido no navegador e vira texto simples dentro da mensagem do usuário; quem interpreta colunas e classifica ativos é o modelo. A leitura usa `FileReader` (funciona no navegador e no jsdom).

- [ ] **Step 1: Escrever os testes que falham**

`src/chat/attachments.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { MAX_ROWS_PER_SHEET, prepareAttachment, readSheets, sheetsToPromptText } from './attachments'

const csvFile = (text: string, name = 'posicao.csv') => new File([text], name, { type: 'text/csv' })

describe('readSheets', () => {
  it('reads a semicolon-separated CSV, keeping decimal commas inside cells', async () => {
    const sheets = await readSheets(csvFile('Ativo;Cotas;Custo médio\nTAEE11;80;35,20\nVISC11;40;104,50\n'))
    expect(sheets).toEqual({
      CSV: [
        ['Ativo', 'Cotas', 'Custo médio'],
        ['TAEE11', '80', '35,20'],
        ['VISC11', '40', '104,50'],
      ],
    })
  })

  it('reads a comma-separated CSV with quoted cells and an empty first cell', async () => {
    const sheets = await readSheets(csvFile(',Qtd,Nome\n"ITUB4",100,"Itaú, PN"\n'))
    expect(sheets.CSV).toEqual([
      ['', 'Qtd', 'Nome'],
      ['ITUB4', '100', 'Itaú, PN'],
    ])
  })

  it('reads every sheet of an xlsx workbook', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Papel', 'Qtd'], ['ITUB4', 100]]), 'Custódia')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['x']]), 'Outra')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const sheets = await readSheets(new File([bytes], 'extrato.xlsx'))
    expect(Object.keys(sheets)).toEqual(['Custódia', 'Outra'])
    expect(sheets['Custódia']).toEqual([['Papel', 'Qtd'], ['ITUB4', 100]])
  })

  it('rejects unsupported formats with a readable message', async () => {
    await expect(readSheets(new File(['x'], 'nota.pdf'))).rejects.toThrow(
      'Formato não suportado: .pdf. Envie um arquivo .xlsx, .xls ou .csv.',
    )
  })
})

describe('sheetsToPromptText', () => {
  it('serializes rows with a header per sheet and skips empty rows', () => {
    const { text, truncated, rowCount } = sheetsToPromptText('extrato.xlsx', {
      Custódia: [['Papel', 'Qtd'], [], [null, ''], ['ITUB4', 100]],
    })
    expect(truncated).toBe(false)
    expect(rowCount).toBe(2)
    expect(text).toBe('Arquivo anexado: extrato.xlsx\n### Aba: Custódia (2 linhas)\nPapel | Qtd\nITUB4 | 100')
  })

  it('truncates long sheets and tells the model about it', () => {
    const rows = Array.from({ length: MAX_ROWS_PER_SHEET + 50 }, (_, i) => [`ATIVO${i}`, i])
    const { text, truncated } = sheetsToPromptText('grande.csv', { CSV: rows })
    expect(truncated).toBe(true)
    expect(text).toContain(`ATIVO${MAX_ROWS_PER_SHEET - 1} |`)
    expect(text).not.toContain(`ATIVO${MAX_ROWS_PER_SHEET} |`)
    expect(text).toContain('[AVISO: o arquivo foi truncado')
  })
})

describe('prepareAttachment', () => {
  it('describes a CSV by its number of rows', async () => {
    const prepared = await prepareAttachment(csvFile('Ativo;Cotas\nTAEE11;80\nVISC11;40\n', 'posicao_nuinvest.csv'))
    expect(prepared.name).toBe('posicao_nuinvest.csv')
    expect(prepared.meta).toBe('CSV · 3 linhas')
    expect(prepared.promptText).toContain('TAEE11 | 80')
  })

  it('describes a workbook by its number of sheets', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['a']]), 'Um')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    expect((await prepareAttachment(new File([bytes], 'x.xlsx'))).meta).toBe('Planilha · 1 aba')
  })

  it('flags truncated files in the meta line', async () => {
    const text = Array.from({ length: MAX_ROWS_PER_SHEET + 10 }, (_, i) => `A${i};1`).join('\n')
    expect((await prepareAttachment(csvFile(text))).meta).toBe(`CSV · ${MAX_ROWS_PER_SHEET + 10} linhas · truncado`)
  })

  it('rejects a file with no data', async () => {
    await expect(prepareAttachment(csvFile('\n\n'))).rejects.toThrow('O arquivo está vazio.')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/chat/attachments.test.ts`
Expected: FAIL — `Failed to resolve import "./attachments"`.

- [ ] **Step 3: Implementar `src/chat/attachments.ts`**

```ts
import * as XLSX from 'xlsx'

export const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv']
export const MAX_ROWS_PER_SHEET = 300
export const MAX_PROMPT_CHARS = 60_000

export type Sheets = Record<string, unknown[][]>

export interface PreparedAttachment {
  name: string
  meta: string
  promptText: string
}

const extensionOf = (name: string): string => {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index).toLowerCase() : ''
}

function readWith<T>(file: File, start: (reader: FileReader) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as T)
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    start(reader)
  })
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 10).join('\n')
  const count = (char: string) => sample.split(char).length - 1
  const commas = count(',')
  const semicolons = count(';')
  const tabs = count('\t')
  if (semicolons > commas && semicolons > tabs) return ';'
  if (tabs > commas && tabs > semicolons) return '\t'
  return ','
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        current += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const delimiter = detectDelimiter(lines)
  return lines.map((line) => splitCsvLine(line, delimiter))
}

export async function readSheets(file: File): Promise<Sheets> {
  const extension = extensionOf(file.name)
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    throw new Error(`Formato não suportado: ${extension || 'sem extensão'}. Envie um arquivo .xlsx, .xls ou .csv.`)
  }
  if (extension === '.csv') {
    const text = await readWith<string>(file, (reader) => reader.readAsText(file))
    return { CSV: parseCsv(text) }
  }
  const buffer = await readWith<ArrayBuffer>(file, (reader) => reader.readAsArrayBuffer(file))
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheets: Sheets = {}
  for (const name of workbook.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1 })
  }
  return sheets
}

const isFilled = (row: unknown[]): boolean =>
  Array.isArray(row) && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')

export function sheetsToPromptText(
  fileName: string,
  sheets: Sheets,
): { text: string; truncated: boolean; rowCount: number } {
  let truncated = false
  let rowCount = 0
  const parts: string[] = [`Arquivo anexado: ${fileName}`]
  for (const [name, rows] of Object.entries(sheets)) {
    const filled = rows.filter(isFilled)
    rowCount += filled.length
    if (filled.length > MAX_ROWS_PER_SHEET) truncated = true
    parts.push(`### Aba: ${name} (${filled.length} linhas)`)
    for (const row of filled.slice(0, MAX_ROWS_PER_SHEET)) {
      parts.push(Array.from(row, (cell) => String(cell ?? '').replace(/\s+/g, ' ').trim()).join(' | '))
    }
  }
  let text = parts.join('\n')
  if (text.length > MAX_PROMPT_CHARS) {
    text = text.slice(0, MAX_PROMPT_CHARS)
    truncated = true
  }
  if (truncated) {
    text += '\n[AVISO: o arquivo foi truncado; avise o usuário de que nem todas as linhas foram lidas.]'
  }
  return { text, truncated, rowCount }
}

export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  const sheets = await readSheets(file)
  const { text, truncated, rowCount } = sheetsToPromptText(file.name, sheets)
  if (rowCount === 0) throw new Error('O arquivo está vazio.')
  const sheetCount = Object.keys(sheets).length
  const base =
    extensionOf(file.name) === '.csv'
      ? `CSV · ${rowCount} ${rowCount === 1 ? 'linha' : 'linhas'}`
      : `Planilha · ${sheetCount} ${sheetCount === 1 ? 'aba' : 'abas'}`
  return { name: file.name, meta: truncated ? `${base} · truncado` : base, promptText: text }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/chat/attachments.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/chat/attachments.ts src/chat/attachments.test.ts
git commit -m "feat: read spreadsheet attachments into prompt text"
```

---

### Task 8: Ferramentas e loop do agente (`src/chat/`)

**Files:**
- Create: `src/chat/systemPrompt.ts`
- Create: `src/chat/tools.ts`
- Create: `src/chat/agent.ts`
- Test: `src/chat/tools.test.ts`
- Test: `src/chat/agent.test.ts`

**Interfaces:**
- Consumes:
  - de `src/domain/operations.ts`: `AssetOperation`, `PreviewRow`, `Workspace`, `runOperations(workspace, targetPortfolioId, operations): { workspace; errors: string[] }`, `describeOperations(workspace, targetPortfolioId, operations): PreviewRow[]`
  - de `src/domain/assets.ts`: `listAssets(data): Asset[]`, `isBuiltinCategory(name)`
  - de `src/lib/openrouter/client.ts`: `ChatMessage`, `AssistantMessage`, `ToolDefinition`, `ChatCompletionParams`, `createChatCompletion(params): Promise<AssistantMessage>`
- Produces:

```ts
// src/chat/systemPrompt.ts
export const SYSTEM_PROMPT: string

// src/chat/tools.ts
export type ProposalStatus = 'pending' | 'done' | 'dismissed' | 'failed'
export interface Proposal {
  id: string; portfolioId: string; portfolioName: string; summary: string
  operations: AssetOperation[]; rows: PreviewRow[]; status: ProposalStatus; error?: string
}
export interface ToolContext {
  workspace: Workspace                 // todas as carteiras + lista completa de categorias
  viewData: PortfolioData | null       // o que o usuário está vendo (pode ser o consolidado)
  viewLabel: string
  targetPortfolioId: string            // carteira onde as alterações serão gravadas
  allocationTargets: Record<string, number>
  createId: () => string
}
export interface ToolResult { content: string; proposal?: Proposal }
export const TOOL_DEFINITIONS: ToolDefinition[]
export function executeTool(name: string, rawArguments: string, context: ToolContext): ToolResult

// src/chat/agent.ts
export interface AgentTurnInput {
  apiKey: string; model: string; history: ChatMessage[]; userContent: string; toolContext: ToolContext
  complete?: (params: ChatCompletionParams) => Promise<AssistantMessage>   // padrão: createChatCompletion
  maxSteps?: number                                                        // padrão: 6
}
export interface AgentTurnResult { history: ChatMessage[]; reply: string; proposals: Proposal[] }
export function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult>
```

`history` nunca inclui a mensagem de sistema; `runAgentTurn` a coloca na frente a cada chamada. `executeTool` nunca lança: todo erro vira `content` JSON com `ok: false` para o modelo se corrigir.

- [ ] **Step 1: Criar `src/chat/systemPrompt.ts`**

```ts
export const SYSTEM_PROMPT = `Você é o Assistente do Dashboard Invest, um painel local de carteiras de investimento brasileiras.
Você ajuda a importar extratos, registrar compras, organizar ativos em categorias e explicar a alocação da carteira.

Regras de trabalho:
1. Antes de responder sobre a carteira ou de alterar algo que já existe, chame get_portfolio. Não invente posições, preços ou totais.
2. Toda alteração (importar arquivo, registrar compra, editar, remover ou reclassificar ativo, criar, renomear ou excluir categoria) deve ser feita com propose_changes. Essa ferramenta só mostra uma prévia: nada é salvo até o usuário clicar em Confirmar. Nunca diga que salvou; diga que a prévia está pronta para confirmação.
3. Se propose_changes devolver erros, corrija as operações e chame de novo, ou explique ao usuário o que falta.
4. Categorias embutidas: "Ações", "FIIs", "Renda Fixa" e "Tesouro Direto". Elas não podem ser renomeadas nem excluídas. Outras categorias (por exemplo "Cripto", "Exterior", "ETFs") são livres: se ainda não existir, crie com add_category na mesma proposta, antes das operações que a usam.
5. Classificação: ticker brasileiro terminado em 11 costuma ser FII, mas units (TAEE11, KLBN11, SANB11, BPAC11, ALUP11, ENGI11, SAPR11, IGTI11) são Ações. Títulos do Tesouro vão em "Tesouro Direto". CDB, LCI, LCA, CRI, CRA e debêntures vão em "Renda Fixa". Na dúvida, pergunte.
6. Planilhas e textos colados: identifique sozinho as colunas de ativo, quantidade e preço médio. Ignore linhas de total, subtotal e cabeçalhos repetidos. Converta números do formato brasileiro (1.234,56) para número (1234.56). Se só houver valor total, divida pela quantidade. Para Tesouro e Renda Fixa sem quantidade, use quantidade 1 e avgPrice igual ao valor aplicado.
7. Em upsert_asset, mode "add" soma à posição existente e recalcula o preço médio (compra ou importação que complementa a carteira). Use mode "set" só quando o usuário disser que os valores substituem a posição atual.
8. Se faltar um dado obrigatório (por exemplo o preço de uma compra), pergunte em vez de supor.
9. Se a mensagem trouxer um aviso de arquivo truncado, avise o usuário.
10. Responda em português do Brasil, em texto simples e curto, sem markdown. Para listas use linhas começando com "• ".
11. Você pode explicar a alocação atual e comparar com as metas que o usuário cadastrou. Não recomende comprar ou vender ativos específicos.`
```

- [ ] **Step 2: Escrever os testes das ferramentas**

`src/chat/tools.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyPortfolioData, type Portfolio, type PortfolioData } from '../store/useInvestmentStore'
import { TOOL_DEFINITIONS, executeTool, type ToolContext } from './tools'

const portfolio = (id: string, name: string, data: Partial<PortfolioData> = {}): Portfolio => ({
  id,
  name,
  data: { ...createEmptyPortfolioData(), ...data },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const hglg = { Ticker: 'HGLG11', Quantidade: 60, PrecoMedio: 150, Cotacao: 160, Posicao: 9600, Segmento: 'Logística' }
const itub = { Ticker: 'ITUB4', Quantidade: 100, PrecoMedio: 20, Cotacao: 24, Posicao: 2400, Segmento: 'Bancos' }

const context = (): ToolContext => {
  const main = portfolio('p1', 'Carteira Principal', { fiis: [hglg], acoes: [itub] })
  return {
    workspace: { portfolios: [main], categories: ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto', 'Cripto'] },
    viewData: main.data,
    viewLabel: 'Carteira Principal',
    targetPortfolioId: 'p1',
    allocationTargets: { fiis: 30, acoes: 40, renda_fixa: 30 },
    createId: () => 'prop-1',
  }
}

describe('TOOL_DEFINITIONS', () => {
  it('exposes exactly the read tool and the proposal tool', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.function.name)).toEqual(['get_portfolio', 'propose_changes'])
  })
})

describe('executeTool — get_portfolio', () => {
  it('returns totals, categories with shares, assets and targets', () => {
    const result = executeTool('get_portfolio', '{}', context())
    expect(result.proposal).toBeUndefined()
    const snapshot = JSON.parse(result.content)
    expect(snapshot).toMatchObject({
      portfolio: 'Carteira Principal',
      changesWillBeSavedTo: 'Carteira Principal',
      total: 12000,
      allocationTargetsPct: { fiis: 30, acoes: 40, renda_fixa: 30 },
    })
    expect(snapshot.categories).toContainEqual({ name: 'FIIs', builtin: true, value: 9600, sharePct: 80 })
    expect(snapshot.categories).toContainEqual({ name: 'Cripto', builtin: false, value: 0, sharePct: 0 })
    expect(snapshot.assets).toContainEqual({
      ticker: 'ITUB4',
      category: 'Ações',
      quantity: 100,
      avgPrice: 20,
      price: 24,
      value: 2400,
    })
  })

  it('accepts empty arguments', () => {
    expect(JSON.parse(executeTool('get_portfolio', '', context()).content).total).toBe(12000)
  })
})

describe('executeTool — propose_changes', () => {
  const args = (operations: unknown[], summary = 'Importar extrato') => JSON.stringify({ summary, operations })

  it('creates a pending proposal with preview rows and does not touch the workspace', () => {
    const ctx = context()
    const result = executeTool(
      'propose_changes',
      args([
        { type: 'upsert_asset', ticker: 'bbse3', category: 'Ações', quantity: 200, avgPrice: 33.1 },
        { type: 'upsert_asset', ticker: 'hglg11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'add' },
      ]),
      ctx,
    )
    expect(result.proposal).toEqual({
      id: 'prop-1',
      portfolioId: 'p1',
      portfolioName: 'Carteira Principal',
      summary: 'Importar extrato',
      status: 'pending',
      operations: [
        { type: 'upsert_asset', ticker: 'bbse3', category: 'Ações', quantity: 200, avgPrice: 33.1, mode: 'add' },
        { type: 'upsert_asset', ticker: 'hglg11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'add' },
      ],
      rows: [
        { label: 'BBSE3', category: 'Ações', quantity: 200, avgPrice: 33.1, mode: 'novo' },
        { label: 'HGLG11', category: 'FIIs', quantity: 20, avgPrice: 160.1, mode: 'somar' },
      ],
    })
    expect(JSON.parse(result.content)).toMatchObject({ ok: true, proposalId: 'prop-1', status: 'pending_user_confirmation' })
    expect(ctx.workspace.portfolios[0].data.acoes).toEqual([itub])
  })

  it.each([
    ['negative quantity', [{ type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: -1, avgPrice: 1 }], 'Quantidade inválida'],
    ['pt-BR number string', [{ type: 'upsert_asset', ticker: 'X', category: 'Ações', quantity: '1.234,56', avgPrice: 1 }], 'Quantidade inválida'],
    ['missing category', [{ type: 'upsert_asset', ticker: 'X', category: 'ETFs', quantity: 1, avgPrice: 1 }], 'não existe'],
    ['unknown operation type', [{ type: 'explode' }], 'tipo desconhecido'],
    ['unknown asset', [{ type: 'remove_asset', ticker: 'NADA3' }], 'não existe na carteira'],
  ])('returns errors to the model instead of a proposal: %s', (_label, operations, message) => {
    const result = executeTool('propose_changes', args(operations), context())
    expect(result.proposal).toBeUndefined()
    const body = JSON.parse(result.content)
    expect(body.ok).toBe(false)
    expect(body.errors.join(' ')).toContain(message)
  })

  it('requires at least one operation', () => {
    const body = JSON.parse(executeTool('propose_changes', args([]), context()).content)
    expect(body).toEqual({ ok: false, errors: ['Informe ao menos uma operação em "operations".'] })
  })

  it('reports malformed JSON arguments', () => {
    const result = executeTool('propose_changes', '{"summary": "x", "operations": [', context())
    expect(result.proposal).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({ ok: false, errors: ['Argumentos inválidos: não é um JSON válido.'] })
  })

  it('reports unknown tools', () => {
    expect(JSON.parse(executeTool('delete_everything', '{}', context()).content)).toEqual({
      ok: false,
      errors: ['Ferramenta desconhecida: delete_everything.'],
    })
  })

  it('names the portfolio that will receive the changes', () => {
    const ctx = context()
    ctx.workspace.portfolios.push(portfolio('p2', 'Aposentadoria'))
    ctx.targetPortfolioId = 'p2'
    const result = executeTool(
      'propose_changes',
      args([{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 30 }]),
      ctx,
    )
    expect(result.proposal).toMatchObject({ portfolioId: 'p2', portfolioName: 'Aposentadoria' })
    expect(result.proposal?.rows[0].mode).toBe('novo')
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/chat/tools.test.ts`
Expected: FAIL — `Failed to resolve import "./tools"`.

- [ ] **Step 4: Implementar `src/chat/tools.ts`**

```ts
import { isBuiltinCategory, listAssets } from '../domain/assets'
import {
  describeOperations,
  runOperations,
  type AssetOperation,
  type PreviewRow,
  type Workspace,
} from '../domain/operations'
import type { ToolDefinition } from '../lib/openrouter/client'
import type { PortfolioData } from '../store/useInvestmentStore'

export type ProposalStatus = 'pending' | 'done' | 'dismissed' | 'failed'

export interface Proposal {
  id: string
  portfolioId: string
  portfolioName: string
  summary: string
  operations: AssetOperation[]
  rows: PreviewRow[]
  status: ProposalStatus
  error?: string
}

export interface ToolContext {
  workspace: Workspace
  viewData: PortfolioData | null
  viewLabel: string
  targetPortfolioId: string
  allocationTargets: Record<string, number>
  createId: () => string
}

export interface ToolResult {
  content: string
  proposal?: Proposal
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_portfolio',
      description:
        'Lê a carteira que o usuário está vendo: total, categorias com valor e percentual, lista de ativos (ticker, categoria, quantidade, preço médio, cotação, valor) e metas de alocação. Somente leitura.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_changes',
      description:
        'Mostra ao usuário uma prévia de alterações em ativos e categorias. Nada é salvo até o usuário confirmar na interface. Se devolver erros, corrija e chame de novo.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description:
              'Uma ou duas frases para o usuário: de onde vieram os dados, como as colunas foram interpretadas e qualquer suposição feita.',
          },
          operations: {
            type: 'array',
            description: 'Operações aplicadas em ordem.',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['upsert_asset', 'remove_asset', 'move_asset', 'add_category', 'rename_category', 'remove_category'],
                },
                ticker: { type: 'string', description: 'upsert_asset, remove_asset, move_asset: código ou nome do ativo.' },
                category: { type: 'string', description: 'upsert_asset, move_asset: categoria de destino (precisa existir).' },
                quantity: { type: 'number', description: 'upsert_asset: quantidade, maior que zero.' },
                avgPrice: { type: 'number', description: 'upsert_asset: preço médio unitário em reais.' },
                mode: {
                  type: 'string',
                  enum: ['add', 'set'],
                  description: 'upsert_asset: "add" soma à posição existente (padrão); "set" substitui.',
                },
                name: { type: 'string', description: 'add_category, remove_category: nome da categoria.' },
                from: { type: 'string', description: 'rename_category: nome atual.' },
                to: { type: 'string', description: 'rename_category: novo nome.' },
                moveTo: {
                  type: 'string',
                  description: 'remove_category: categoria que recebe os ativos, obrigatória se a categoria não estiver vazia.',
                },
              },
              required: ['type'],
            },
          },
        },
        required: ['summary', 'operations'],
      },
    },
  },
]

const round2 = (value: number): number => Math.round(value * 100) / 100

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const failure = (errors: string[]): ToolResult => ({ content: JSON.stringify({ ok: false, errors }) })

function parseOperation(raw: any, index: number): AssetOperation | string {
  switch (raw?.type) {
    case 'upsert_asset':
      return {
        type: 'upsert_asset',
        ticker: text(raw.ticker),
        category: text(raw.category),
        quantity: typeof raw.quantity === 'number' ? raw.quantity : NaN,
        avgPrice: typeof raw.avgPrice === 'number' ? raw.avgPrice : NaN,
        mode: raw.mode === 'set' ? 'set' : 'add',
      }
    case 'remove_asset':
      return { type: 'remove_asset', ticker: text(raw.ticker) }
    case 'move_asset':
      return { type: 'move_asset', ticker: text(raw.ticker), category: text(raw.category) }
    case 'add_category':
      return { type: 'add_category', name: text(raw.name) }
    case 'rename_category':
      return { type: 'rename_category', from: text(raw.from), to: text(raw.to) }
    case 'remove_category':
      return { type: 'remove_category', name: text(raw.name), ...(text(raw.moveTo) ? { moveTo: text(raw.moveTo) } : {}) }
    default:
      return `Operação ${index + 1}: tipo desconhecido "${String(raw?.type)}".`
  }
}

function getPortfolio(context: ToolContext): ToolResult {
  const assets = listAssets(context.viewData)
  const total = assets.reduce((acc, a) => acc + a.value, 0)
  const byCategory = new Map<string, number>()
  for (const asset of assets) byCategory.set(asset.category, (byCategory.get(asset.category) || 0) + asset.value)
  const target = context.workspace.portfolios.find((p) => p.id === context.targetPortfolioId)
  return {
    content: JSON.stringify({
      portfolio: context.viewLabel,
      changesWillBeSavedTo: target?.name ?? null,
      total: round2(total),
      categories: context.workspace.categories.map((name) => {
        const value = byCategory.get(name) || 0
        return { name, builtin: isBuiltinCategory(name), value: round2(value), sharePct: total > 0 ? round2((value / total) * 100) : 0 }
      }),
      assets: assets.map((a) => ({
        ticker: a.ticker,
        category: a.category,
        quantity: a.quantity,
        avgPrice: round2(a.avgPrice),
        price: round2(a.price),
        value: round2(a.value),
      })),
      allocationTargetsPct: context.allocationTargets,
    }),
  }
}

function proposeChanges(args: any, context: ToolContext): ToolResult {
  const rawOperations: unknown[] = Array.isArray(args?.operations) ? args.operations : []
  if (rawOperations.length === 0) return failure(['Informe ao menos uma operação em "operations".'])

  const parsed = rawOperations.map(parseOperation)
  const parseErrors = parsed.filter((item): item is string => typeof item === 'string')
  if (parseErrors.length > 0) return failure(parseErrors)
  const operations = parsed as AssetOperation[]

  const { errors } = runOperations(context.workspace, context.targetPortfolioId, operations)
  if (errors.length > 0) return failure(errors)

  const target = context.workspace.portfolios.find((p) => p.id === context.targetPortfolioId)
  const proposal: Proposal = {
    id: context.createId(),
    portfolioId: context.targetPortfolioId,
    portfolioName: target?.name ?? '',
    summary: text(args?.summary),
    operations,
    rows: describeOperations(context.workspace, context.targetPortfolioId, operations),
    status: 'pending',
  }
  return {
    proposal,
    content: JSON.stringify({
      ok: true,
      proposalId: proposal.id,
      status: 'pending_user_confirmation',
      message: `Prévia exibida ao usuário. Nada foi salvo; ele precisa clicar em Confirmar. Destino: ${proposal.portfolioName}.`,
    }),
  }
}

export function executeTool(name: string, rawArguments: string, context: ToolContext): ToolResult {
  let args: unknown
  try {
    args = rawArguments.trim() === '' ? {} : JSON.parse(rawArguments)
  } catch {
    return failure(['Argumentos inválidos: não é um JSON válido.'])
  }
  if (name === 'get_portfolio') return getPortfolio(context)
  if (name === 'propose_changes') return proposeChanges(args, context)
  return failure([`Ferramenta desconhecida: ${name}.`])
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/chat/tools.test.ts`
Expected: PASS (13 testes).

- [ ] **Step 6: Escrever os testes do loop do agente**

`src/chat/agent.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { OpenRouterError, type AssistantMessage, type ChatCompletionParams } from '../lib/openrouter/client'
import { createEmptyPortfolioData } from '../store/useInvestmentStore'
import { runAgentTurn } from './agent'
import { SYSTEM_PROMPT } from './systemPrompt'
import { TOOL_DEFINITIONS, type ToolContext } from './tools'

const toolContext = (): ToolContext => ({
  workspace: {
    portfolios: [
      {
        id: 'p1',
        name: 'Carteira Principal',
        data: createEmptyPortfolioData(),
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    categories: ['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto'],
  },
  viewData: createEmptyPortfolioData(),
  viewLabel: 'Carteira Principal',
  targetPortfolioId: 'p1',
  allocationTargets: {},
  createId: () => 'prop-1',
})

const call = (id: string, name: string, args: unknown) => ({
  id,
  type: 'function' as const,
  function: { name, arguments: JSON.stringify(args) },
})

const scripted = (...replies: AssistantMessage[]) => {
  const complete = vi.fn<(params: ChatCompletionParams) => Promise<AssistantMessage>>()
  replies.forEach((reply) => complete.mockResolvedValueOnce(reply))
  return complete
}

const base = { apiKey: 'k', model: 'm/x', history: [], userContent: 'oi', toolContext: toolContext() }

describe('runAgentTurn', () => {
  it('returns the reply when the model answers without tools', async () => {
    const complete = scripted({ role: 'assistant', content: ' Olá! ' })
    const result = await runAgentTurn({ ...base, complete })
    expect(result.reply).toBe('Olá!')
    expect(result.proposals).toEqual([])
    expect(result.history).toEqual([
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: ' Olá! ' },
    ])
    expect(complete).toHaveBeenCalledWith({
      apiKey: 'k',
      model: 'm/x',
      tools: TOOL_DEFINITIONS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: 'oi' },
      ],
    })
  })

  it('keeps earlier history ahead of the new user message', async () => {
    const history = [
      { role: 'user' as const, content: 'antes' },
      { role: 'assistant' as const, content: 'resposta' },
    ]
    const complete = scripted({ role: 'assistant', content: 'ok' })
    const result = await runAgentTurn({ ...base, history, complete })
    expect(result.history.slice(0, 3)).toEqual([...history, { role: 'user', content: 'oi' }])
  })

  it('executes tool calls, feeds results back and collects proposals', async () => {
    const complete = scripted(
      { role: 'assistant', content: null, tool_calls: [call('c1', 'get_portfolio', {})] },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          call('c2', 'propose_changes', {
            summary: 'Compra',
            operations: [{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 30 }],
          }),
        ],
      },
      { role: 'assistant', content: 'Prévia pronta.' },
    )
    const result = await runAgentTurn({ ...base, complete })
    expect(complete).toHaveBeenCalledTimes(3)
    expect(result.reply).toBe('Prévia pronta.')
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0]).toMatchObject({ id: 'prop-1', status: 'pending' })
    expect(result.history.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant', 'tool', 'assistant'])
    expect(result.history[2]).toMatchObject({ role: 'tool', tool_call_id: 'c1' })
    const thirdCallMessages = complete.mock.calls[2][0].messages
    expect(thirdCallMessages[thirdCallMessages.length - 1]).toMatchObject({ role: 'tool', tool_call_id: 'c2' })
  })

  it('uses a default reply when the model ends with a proposal and no text', async () => {
    const complete = scripted(
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          call('c1', 'propose_changes', {
            summary: 's',
            operations: [{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 1, avgPrice: 1 }],
          }),
        ],
      },
      { role: 'assistant', content: null },
    )
    expect((await runAgentTurn({ ...base, complete })).reply).toBe('Confira a prévia abaixo antes de salvar.')
  })

  it('stops after maxSteps with an explanation', async () => {
    const looping: AssistantMessage = { role: 'assistant', content: null, tool_calls: [call('c', 'get_portfolio', {})] }
    const complete = vi.fn().mockResolvedValue(looping)
    const result = await runAgentTurn({ ...base, complete, maxSteps: 2 })
    expect(complete).toHaveBeenCalledTimes(2)
    expect(result.reply).toBe('Parei depois de várias etapas sem concluir. Tente reformular o pedido.')
  })

  it('propagates API errors to the caller', async () => {
    const complete = vi.fn().mockRejectedValue(new OpenRouterError('Invalid credentials', 401))
    await expect(runAgentTurn({ ...base, complete })).rejects.toMatchObject({ status: 401 })
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/chat/agent.test.ts`
Expected: FAIL — `Failed to resolve import "./agent"`.

- [ ] **Step 8: Implementar `src/chat/agent.ts`**

```ts
import {
  createChatCompletion,
  type AssistantMessage,
  type ChatCompletionParams,
  type ChatMessage,
} from '../lib/openrouter/client'
import { SYSTEM_PROMPT } from './systemPrompt'
import { TOOL_DEFINITIONS, executeTool, type Proposal, type ToolContext } from './tools'

export interface AgentTurnInput {
  apiKey: string
  model: string
  history: ChatMessage[]
  userContent: string
  toolContext: ToolContext
  complete?: (params: ChatCompletionParams) => Promise<AssistantMessage>
  maxSteps?: number
}

export interface AgentTurnResult {
  history: ChatMessage[]
  reply: string
  proposals: Proposal[]
}

export async function runAgentTurn({
  apiKey,
  model,
  history,
  userContent,
  toolContext,
  complete = createChatCompletion,
  maxSteps = 6,
}: AgentTurnInput): Promise<AgentTurnResult> {
  const messages: ChatMessage[] = [...history, { role: 'user', content: userContent }]
  const proposals: Proposal[] = []

  for (let step = 0; step < maxSteps; step++) {
    const assistant = await complete({
      apiKey,
      model,
      tools: TOOL_DEFINITIONS,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    })
    messages.push(assistant)

    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      const reply =
        assistant.content?.trim() ||
        (proposals.length > 0 ? 'Confira a prévia abaixo antes de salvar.' : 'O modelo não respondeu. Tente de novo.')
      return { history: messages, reply, proposals }
    }

    for (const toolCall of assistant.tool_calls) {
      const result = executeTool(toolCall.function.name, toolCall.function.arguments ?? '', toolContext)
      if (result.proposal) proposals.push(result.proposal)
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result.content })
    }
  }

  return { history: messages, reply: 'Parei depois de várias etapas sem concluir. Tente reformular o pedido.', proposals }
}
```

Atenção ao teste "feeds results back": `complete` recebe a cada chamada um **novo** array (`[system, ...messages]`), então `complete.mock.calls[2][0].messages` reflete o estado daquela chamada.

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run src/chat && npm run build`
Expected: todos os testes de `src/chat` passam; build ok.

- [ ] **Step 10: Commit**

```bash
git add src/chat/systemPrompt.ts src/chat/tools.ts src/chat/tools.test.ts src/chat/agent.ts src/chat/agent.test.ts
git commit -m "feat: add chat tools and agent loop with confirm-before-save proposals"
```

---

### Task 9: Store do chat (`src/store/useChatStore.ts`)

**Files:**
- Create: `src/store/useChatStore.ts`
- Test: `src/store/useChatStore.test.ts`

**Interfaces:**
- Consumes:
  - `runAgentTurn({ apiKey, model, history, userContent, toolContext }): Promise<{ history: ChatMessage[]; reply: string; proposals: Proposal[] }>` de `src/chat/agent.ts`
  - `prepareAttachment(file): Promise<{ name; meta; promptText }>` de `src/chat/attachments.ts`
  - `Proposal`, `ToolContext` de `src/chat/tools.ts`
  - `OpenRouterError` (campo `status`), `ChatMessage` de `src/lib/openrouter/client.ts`
  - `useAiSettingsStore` (`apiKey`, `model`, `markKeyStatus`)
  - `useInvestmentStore` (`portfolios`, `activePortfolioId`, `portfolio`, `assetCategories`, `settings.alvos`, `applyAssetOperations`), `resolveWritablePortfolioId`
  - `collectCategories` de `src/domain/assets.ts`
- Produces:

```ts
export interface ChatFile { name: string; meta: string }
export interface UiMessage { id: string; role: 'user' | 'assistant'; text: string; file?: ChatFile; proposals?: Proposal[]; isError?: boolean }
export function buildToolContext(): ToolContext
export const useChatStore // estado:
//   messages: UiMessage[]; history: ChatMessage[]; typing: boolean; draft: string
//   stagedFile: File | null; composeRequest: number; session: number
// ações:
//   setDraft(text: string): void
//   stageFile(file: File | null): void
//   requestCompose(text: string): void      // preenche o campo e pede foco (incrementa composeRequest)
//   newChat(): void
//   sendMessage(text: string): Promise<void>
//   confirmProposal(messageId: string, proposalId: string): void
//   dismissProposal(messageId: string, proposalId: string): void
```

O chat não é persistido: recarregar a página começa uma conversa nova.

- [ ] **Step 1: Escrever os testes que falham**

`src/store/useChatStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runAgentTurn } from '../chat/agent'
import type { Proposal } from '../chat/tools'
import { OpenRouterError } from '../lib/openrouter/client'
import { DEFAULT_MODEL } from '../lib/openrouter/models'
import { useAiSettingsStore } from './useAiSettingsStore'
import { buildToolContext, useChatStore } from './useChatStore'
import { useInvestmentStore } from './useInvestmentStore'

vi.mock('../chat/agent', () => ({ runAgentTurn: vi.fn() }))

const runTurn = vi.mocked(runAgentTurn)
const chat = () => useChatStore.getState()
const invest = () => useInvestmentStore.getState()

const proposal = (overrides: Partial<Proposal> = {}): Proposal => ({
  id: 'prop-1',
  portfolioId: 'default',
  portfolioName: 'Carteira Principal',
  summary: 'Compra',
  operations: [{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 30, mode: 'add' }],
  rows: [{ label: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 30, mode: 'novo' }],
  status: 'pending',
  ...overrides,
})

const seedProposal = (p: Proposal) =>
  useChatStore.setState({ messages: [{ id: 'm1', role: 'assistant', text: 'Prévia', proposals: [p] }] })

beforeEach(() => {
  runTurn.mockReset()
  useChatStore.setState(useChatStore.getInitialState(), true)
  invest().clearAllData()
  useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid', model: DEFAULT_MODEL })
})

describe('sendMessage', () => {
  it('appends the user message and the assistant reply and stores the API history', async () => {
    const history = [
      { role: 'user' as const, content: 'oi' },
      { role: 'assistant' as const, content: 'Olá!' },
    ]
    runTurn.mockResolvedValue({ history, reply: 'Olá!', proposals: [] })
    chat().setDraft('oi')
    await chat().sendMessage('  oi  ')

    expect(chat().messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'oi'],
      ['assistant', 'Olá!'],
    ])
    expect(chat()).toMatchObject({ history, typing: false, draft: '' })
    expect(runTurn).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-or-abc', model: DEFAULT_MODEL, history: [], userContent: 'oi' }),
    )
  })

  it('attaches proposals to the assistant message', async () => {
    runTurn.mockResolvedValue({ history: [], reply: 'Prévia pronta.', proposals: [proposal()] })
    await chat().sendMessage('Comprei 10 ITUB4 a 30')
    expect(chat().messages[1].proposals).toEqual([proposal()])
  })

  it('ignores empty messages and messages sent while a reply is pending', async () => {
    await chat().sendMessage('   ')
    useChatStore.setState({ typing: true })
    await chat().sendMessage('oi')
    expect(runTurn).not.toHaveBeenCalled()
    expect(chat().messages).toEqual([])
  })

  it('shows the typing state while waiting', async () => {
    let resolve: (value: Awaited<ReturnType<typeof runAgentTurn>>) => void = () => {}
    runTurn.mockReturnValue(new Promise((r) => (resolve = r)))
    const pending = chat().sendMessage('oi')
    expect(chat().typing).toBe(true)
    resolve({ history: [], reply: 'ok', proposals: [] })
    await pending
    expect(chat().typing).toBe(false)
  })

  it('on 401 marks the key invalid, removes the unsent message and restores the draft', async () => {
    runTurn.mockRejectedValue(new OpenRouterError('Invalid credentials', 401))
    await chat().sendMessage('Comprei 10 ITUB4 a 30')
    expect(useAiSettingsStore.getState().keyStatus).toBe('invalid')
    expect(chat().messages).toEqual([])
    expect(chat()).toMatchObject({ draft: 'Comprei 10 ITUB4 a 30', typing: false })
  })

  it('on 401 also restores the staged file', async () => {
    const file = new File(['Ativo;Cotas\nTAEE11;80\n'], 'posicao.csv')
    runTurn.mockRejectedValue(new OpenRouterError('Invalid credentials', 401))
    chat().stageFile(file)
    await chat().sendMessage('importa')
    expect(chat().stagedFile).toBe(file)
  })

  it.each([
    [new OpenRouterError('Insufficient credits', 402), 'Sua conta do OpenRouter está sem créditos para este modelo.'],
    [new OpenRouterError('Rate limited', 429), 'Limite de requisições do OpenRouter atingido. Aguarde um pouco e tente de novo.'],
    [new OpenRouterError('Model not found', 404), 'Erro do OpenRouter: Model not found'],
    [new TypeError('Failed to fetch'), 'Não consegui falar com o OpenRouter. Verifique sua conexão e tente de novo.'],
  ])('shows a readable error and keeps the key for other failures', async (error, expected) => {
    runTurn.mockRejectedValue(error)
    await chat().sendMessage('oi')
    expect(chat().messages[1]).toMatchObject({ role: 'assistant', text: expected, isError: true })
    expect(useAiSettingsStore.getState().keyStatus).toBe('valid')
    expect(chat().history).toEqual([])
  })

  it('sends the attachment content to the model and shows the file on the user message', async () => {
    runTurn.mockResolvedValue({ history: [], reply: 'ok', proposals: [] })
    chat().stageFile(new File(['Ativo;Cotas\nTAEE11;80\n'], 'posicao.csv'))
    await chat().sendMessage('')
    expect(chat().messages[0]).toMatchObject({
      text: 'Importe as posições deste arquivo.',
      file: { name: 'posicao.csv', meta: 'CSV · 2 linhas' },
    })
    expect(chat().stagedFile).toBeNull()
    const { userContent } = runTurn.mock.calls[0][0]
    expect(userContent).toContain('Importe as posições deste arquivo.')
    expect(userContent).toContain('Arquivo anexado: posicao.csv')
    expect(userContent).toContain('TAEE11 | 80')
  })

  it('reports an unreadable attachment without calling the model', async () => {
    chat().stageFile(new File(['x'], 'nota.pdf'))
    await chat().sendMessage('importa')
    expect(runTurn).not.toHaveBeenCalled()
    expect(chat().messages).toHaveLength(1)
    expect(chat().messages[0]).toMatchObject({ role: 'assistant', isError: true })
    expect(chat().messages[0].text).toContain('Formato não suportado')
    expect(chat().stagedFile).toBeNull()
  })

  it('drops a reply that arrives after "Nova conversa"', async () => {
    let resolve: (value: Awaited<ReturnType<typeof runAgentTurn>>) => void = () => {}
    runTurn.mockReturnValue(new Promise((r) => (resolve = r)))
    const pending = chat().sendMessage('oi')
    chat().newChat()
    resolve({ history: [{ role: 'user', content: 'oi' }], reply: 'tarde demais', proposals: [] })
    await pending
    expect(chat()).toMatchObject({ messages: [], history: [], typing: false })
  })
})

describe('buildToolContext', () => {
  it('targets the active portfolio', () => {
    expect(buildToolContext()).toMatchObject({ targetPortfolioId: 'default', viewLabel: 'Carteira Principal' })
  })

  it('targets the first portfolio and labels the view when showing all portfolios', () => {
    invest().addPortfolio('Aposentadoria')
    invest().setActivePortfolio('all')
    const context = buildToolContext()
    expect(context.targetPortfolioId).toBe('default')
    expect(context.viewLabel).toBe('Todas as carteiras (consolidado)')
    expect(context.workspace.categories).toEqual(expect.arrayContaining(['Ações', 'FIIs', 'Renda Fixa', 'Tesouro Direto']))
  })
})

describe('confirmProposal', () => {
  it('applies the operations, marks the proposal done and tells the user and the model', () => {
    seedProposal(proposal())
    chat().confirmProposal('m1', 'prop-1')

    expect(invest().portfolios[0].data.acoes[0]).toMatchObject({ Ticker: 'ITUB4', Quantidade: 10 })
    expect(chat().messages[0].proposals?.[0].status).toBe('done')
    expect(chat().messages[1]).toMatchObject({
      role: 'assistant',
      text: 'Pronto — 1 alteração salva em Carteira Principal. O gráfico e a lista já refletem a mudança.',
    })
    expect(chat().history).toEqual([
      { role: 'user', content: '(nota automática do app) O usuário confirmou a proposta prop-1; as alterações foram salvas.' },
    ])
  })

  it('does not apply the same proposal twice', () => {
    seedProposal(proposal())
    chat().confirmProposal('m1', 'prop-1')
    chat().confirmProposal('m1', 'prop-1')
    expect(invest().portfolios[0].data.acoes[0].Quantidade).toBe(10)
    expect(chat().messages).toHaveLength(2)
  })

  it('marks the proposal as failed and saves nothing when the data changed since the preview', () => {
    seedProposal(proposal({ operations: [{ type: 'remove_asset', ticker: 'ITUB4' }] }))
    const before = invest().portfolios
    chat().confirmProposal('m1', 'prop-1')
    const failed = chat().messages[0].proposals?.[0]
    expect(failed?.status).toBe('failed')
    expect(failed?.error).toContain('ITUB4')
    expect(invest().portfolios).toBe(before)
  })

  it('fails cleanly when the target portfolio was deleted', () => {
    seedProposal(proposal({ portfolioId: 'gone' }))
    chat().confirmProposal('m1', 'prop-1')
    expect(chat().messages[0].proposals?.[0]).toMatchObject({ status: 'failed' })
    expect(chat().messages[0].proposals?.[0].error).toContain('Carteira de destino não encontrada')
  })
})

describe('dismissProposal', () => {
  it('marks the proposal dismissed without saving', () => {
    seedProposal(proposal())
    chat().dismissProposal('m1', 'prop-1')
    expect(chat().messages[0].proposals?.[0].status).toBe('dismissed')
    expect(invest().portfolios[0].data.acoes).toEqual([])
    expect(chat().history).toEqual([
      { role: 'user', content: '(nota automática do app) O usuário descartou a proposta prop-1; nada foi salvo.' },
    ])
  })
})

describe('compose helpers', () => {
  it('fills the draft and asks for focus', () => {
    chat().requestCompose('Comprei ')
    expect(chat()).toMatchObject({ draft: 'Comprei ', composeRequest: 1 })
  })

  it('clears the conversation on newChat but keeps the draft', () => {
    useChatStore.setState({
      messages: [{ id: 'a', role: 'user', text: 'x' }],
      history: [{ role: 'user', content: 'x' }],
      draft: 'rascunho',
    })
    chat().newChat()
    expect(chat()).toMatchObject({ messages: [], history: [], typing: false, draft: 'rascunho' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/store/useChatStore.test.ts`
Expected: FAIL — `Failed to resolve import "./useChatStore"`.

- [ ] **Step 3: Implementar `src/store/useChatStore.ts`**

```ts
import { create } from 'zustand'
import { runAgentTurn } from '../chat/agent'
import { prepareAttachment } from '../chat/attachments'
import type { Proposal, ToolContext } from '../chat/tools'
import { collectCategories } from '../domain/assets'
import { OpenRouterError, type ChatMessage } from '../lib/openrouter/client'
import { useAiSettingsStore } from './useAiSettingsStore'
import { resolveWritablePortfolioId, useInvestmentStore } from './useInvestmentStore'

export interface ChatFile {
  name: string
  meta: string
}

export interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  file?: ChatFile
  proposals?: Proposal[]
  isError?: boolean
}

interface ChatStore {
  messages: UiMessage[]
  history: ChatMessage[]
  typing: boolean
  draft: string
  stagedFile: File | null
  composeRequest: number
  session: number
  setDraft: (text: string) => void
  stageFile: (file: File | null) => void
  requestCompose: (text: string) => void
  newChat: () => void
  sendMessage: (text: string) => Promise<void>
  confirmProposal: (messageId: string, proposalId: string) => void
  dismissProposal: (messageId: string, proposalId: string) => void
}

const DEFAULT_FILE_PROMPT = 'Importe as posições deste arquivo.'
const APP_NOTE = '(nota automática do app)'

const newId = () => crypto.randomUUID()

export function buildToolContext(): ToolContext {
  const state = useInvestmentStore.getState()
  const targetPortfolioId = resolveWritablePortfolioId(state.portfolios, state.activePortfolioId)
  const active = state.portfolios.find((p) => p.id === state.activePortfolioId)
  return {
    workspace: {
      portfolios: state.portfolios,
      categories: collectCategories(state.assetCategories, state.portfolios),
    },
    viewData: state.portfolio,
    viewLabel: active ? active.name : 'Todas as carteiras (consolidado)',
    targetPortfolioId,
    allocationTargets: state.settings.alvos,
    createId: newId,
  }
}

function errorText(error: unknown): string {
  if (error instanceof OpenRouterError) {
    if (error.status === 402) return 'Sua conta do OpenRouter está sem créditos para este modelo.'
    if (error.status === 429) return 'Limite de requisições do OpenRouter atingido. Aguarde um pouco e tente de novo.'
    return `Erro do OpenRouter: ${error.message}`
  }
  return 'Não consegui falar com o OpenRouter. Verifique sua conexão e tente de novo.'
}

export const useChatStore = create<ChatStore>()((set, get) => {
  const patchProposal = (messageId: string, proposalId: string, changes: Partial<Proposal>) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id !== messageId
          ? message
          : { ...message, proposals: message.proposals?.map((p) => (p.id === proposalId ? { ...p, ...changes } : p)) },
      ),
    }))

  const findPending = (messageId: string, proposalId: string): Proposal | undefined => {
    const found = get()
      .messages.find((m) => m.id === messageId)
      ?.proposals?.find((p) => p.id === proposalId)
    return found?.status === 'pending' ? found : undefined
  }

  const note = (content: string): ChatMessage => ({ role: 'user', content: `${APP_NOTE} ${content}` })

  return {
    messages: [],
    history: [],
    typing: false,
    draft: '',
    stagedFile: null,
    composeRequest: 0,
    session: 0,

    setDraft: (draft) => set({ draft }),
    stageFile: (stagedFile) => set({ stagedFile }),
    requestCompose: (draft) => set((state) => ({ draft, composeRequest: state.composeRequest + 1 })),
    newChat: () => set((state) => ({ messages: [], history: [], typing: false, session: state.session + 1 })),

    sendMessage: async (rawText) => {
      const { typing, stagedFile, session, history } = get()
      const typed = rawText.trim()
      if (typing || (typed === '' && !stagedFile)) return
      const text = typed || DEFAULT_FILE_PROMPT

      let file: ChatFile | undefined
      let userContent = text
      if (stagedFile) {
        try {
          const prepared = await prepareAttachment(stagedFile)
          file = { name: prepared.name, meta: prepared.meta }
          userContent = `${text}\n\n${prepared.promptText}`
        } catch (error) {
          set((state) => ({
            stagedFile: null,
            messages: [...state.messages, { id: newId(), role: 'assistant', text: (error as Error).message, isError: true }],
          }))
          return
        }
      }

      const userMessage: UiMessage = { id: newId(), role: 'user', text, ...(file ? { file } : {}) }
      set((state) => ({ messages: [...state.messages, userMessage], draft: '', stagedFile: null, typing: true }))

      const { apiKey, model } = useAiSettingsStore.getState()
      try {
        const result = await runAgentTurn({ apiKey, model, history, userContent, toolContext: buildToolContext() })
        if (get().session !== session) return
        set((state) => ({
          typing: false,
          history: result.history,
          messages: [
            ...state.messages,
            {
              id: newId(),
              role: 'assistant',
              text: result.reply,
              ...(result.proposals.length > 0 ? { proposals: result.proposals } : {}),
            },
          ],
        }))
      } catch (error) {
        if (get().session !== session) return
        if (error instanceof OpenRouterError && error.status === 401) {
          useAiSettingsStore.getState().markKeyStatus('invalid')
          set((state) => ({
            typing: false,
            draft: typed,
            stagedFile,
            messages: state.messages.filter((m) => m.id !== userMessage.id),
          }))
          return
        }
        set((state) => ({
          typing: false,
          messages: [...state.messages, { id: newId(), role: 'assistant', text: errorText(error), isError: true }],
        }))
      }
    },

    confirmProposal: (messageId, proposalId) => {
      const proposal = findPending(messageId, proposalId)
      if (!proposal) return
      try {
        useInvestmentStore.getState().applyAssetOperations(proposal.portfolioId, proposal.operations)
      } catch (error) {
        const message = (error as Error).message
        patchProposal(messageId, proposalId, { status: 'failed', error: message })
        set((state) => ({
          history: [...state.history, note(`A proposta ${proposalId} não pôde ser salva: ${message}`)],
        }))
        return
      }
      patchProposal(messageId, proposalId, { status: 'done' })
      const count = proposal.operations.length
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: newId(),
            role: 'assistant',
            text: `Pronto — ${count} ${count === 1 ? 'alteração salva' : 'alterações salvas'} em ${proposal.portfolioName}. O gráfico e a lista já refletem a mudança.`,
          },
        ],
        history: [...state.history, note(`O usuário confirmou a proposta ${proposalId}; as alterações foram salvas.`)],
      }))
    },

    dismissProposal: (messageId, proposalId) => {
      if (!findPending(messageId, proposalId)) return
      patchProposal(messageId, proposalId, { status: 'dismissed' })
      set((state) => ({
        history: [...state.history, note(`O usuário descartou a proposta ${proposalId}; nada foi salvo.`)],
      }))
    },
  }
})
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/store/useChatStore.test.ts && npm run build`
Expected: todos os testes do arquivo passam; build ok.

- [ ] **Step 5: Commit**

```bash
git add src/store/useChatStore.ts src/store/useChatStore.test.ts
git commit -m "feat: add chat store with send, confirm and dismiss flows"
```

---

### Task 10: Formulário de chave e seletor de modelo

**Files:**
- Create: `src/hooks/useKeyRevalidation.ts`
- Create: `src/components/home/ApiKeyGate.tsx`
- Create: `src/components/home/ModelPicker.tsx`
- Test: `src/components/home/ApiKeyGate.test.tsx`
- Test: `src/components/home/ModelPicker.test.tsx`

**Interfaces:**
- Consumes: `validateKey(apiKey): Promise<'valid' | 'invalid'>` (lança em erro de rede/HTTP); `useAiSettingsStore` (`apiKey`, `keyStatus`, `model`, `setApiKey(key, status)`, `markKeyStatus(status)`, `clearApiKey()`, `setModel(model)`); `MODEL_PRESETS`, `shortModelName`.
- Produces: `useKeyRevalidation(): void`, `<ApiKeyGate />`, `<ModelPicker />` (todos sem props).

- [ ] **Step 1: Escrever os testes que falham**

`src/components/home/ApiKeyGate.test.tsx`:

```tsx
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyRevalidation } from '../../hooks/useKeyRevalidation'
import { validateKey } from '../../lib/openrouter/client'
import { DEFAULT_MODEL } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { ApiKeyGate } from './ApiKeyGate'

vi.mock('../../lib/openrouter/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/openrouter/client')>()),
  validateKey: vi.fn(),
}))

const validate = vi.mocked(validateKey)
const settings = () => useAiSettingsStore.getState()

beforeEach(() => {
  validate.mockReset()
  useAiSettingsStore.setState({ apiKey: '', keyStatus: 'missing', model: DEFAULT_MODEL })
})

describe('ApiKeyGate', () => {
  it('saves a key that OpenRouter accepts', async () => {
    validate.mockResolvedValue('valid')
    render(<ApiKeyGate />)
    await userEvent.type(screen.getByLabelText('Chave da API do OpenRouter'), ' sk-or-abc ')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar chave' }))
    await waitFor(() => expect(settings()).toMatchObject({ apiKey: 'sk-or-abc', keyStatus: 'valid' }))
    expect(validate).toHaveBeenCalledWith('sk-or-abc')
  })

  it('rejects an invalid key without saving it', async () => {
    validate.mockResolvedValue('invalid')
    render(<ApiKeyGate />)
    await userEvent.type(screen.getByLabelText('Chave da API do OpenRouter'), 'bad')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar chave' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Chave inválida. Confira e tente novamente.')
    expect(settings()).toMatchObject({ apiKey: '', keyStatus: 'missing' })
  })

  it('explains when validation could not run', async () => {
    validate.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<ApiKeyGate />)
    await userEvent.type(screen.getByLabelText('Chave da API do OpenRouter'), 'sk-or-abc')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar chave' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível validar a chave agora')
    expect(settings().apiKey).toBe('')
  })

  it('tells the user when the saved key was refused', () => {
    useAiSettingsStore.setState({ apiKey: 'old', keyStatus: 'invalid' })
    render(<ApiKeyGate />)
    expect(screen.getByRole('alert')).toHaveTextContent('A chave salva foi recusada pelo OpenRouter')
  })

  it('keeps the save button disabled while the field is empty', () => {
    render(<ApiKeyGate />)
    expect(screen.getByRole('button', { name: 'Salvar chave' })).toBeDisabled()
  })
})

describe('useKeyRevalidation', () => {
  it('validates a saved key of unknown status', async () => {
    validate.mockResolvedValue('invalid')
    useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'unknown' })
    renderHook(() => useKeyRevalidation())
    await waitFor(() => expect(settings().keyStatus).toBe('invalid'))
  })

  it('leaves the status unknown when the check cannot run', async () => {
    validate.mockRejectedValue(new TypeError('Failed to fetch'))
    useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'unknown' })
    renderHook(() => useKeyRevalidation())
    await waitFor(() => expect(validate).toHaveBeenCalled())
    expect(settings().keyStatus).toBe('unknown')
  })

  it('does nothing when there is no key or the status is already known', () => {
    renderHook(() => useKeyRevalidation())
    useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid' })
    renderHook(() => useKeyRevalidation())
    expect(validate).not.toHaveBeenCalled()
  })
})
```

`src/components/home/ModelPicker.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_MODEL } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { ModelPicker } from './ModelPicker'

const settings = () => useAiSettingsStore.getState()

beforeEach(() => {
  useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid', model: DEFAULT_MODEL })
})

describe('ModelPicker', () => {
  it('shows the short name of the current model and opens the list on click', async () => {
    render(<ModelPicker />)
    expect(screen.getByRole('button', { name: /space-bunny-alpha/ })).toBeInTheDocument()
    expect(screen.queryByText('Modelos via OpenRouter')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /space-bunny-alpha/ }))
    expect(screen.getByText('Modelos via OpenRouter')).toBeInTheDocument()
  })

  it('switches to a preset and closes', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /space-bunny-alpha/ }))
    await userEvent.click(screen.getByRole('button', { name: /deepseek\/deepseek-r1/ }))
    expect(settings().model).toBe('deepseek/deepseek-r1')
    expect(screen.queryByText('Modelos via OpenRouter')).not.toBeInTheDocument()
  })

  it('accepts a custom model id', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /space-bunny-alpha/ }))
    await userEvent.type(screen.getByLabelText('Outro modelo'), 'meta-llama/llama-4{Enter}')
    expect(settings().model).toBe('meta-llama/llama-4')
  })

  it('lets the user replace the API key', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /space-bunny-alpha/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Trocar chave da API' }))
    expect(settings()).toMatchObject({ apiKey: '', keyStatus: 'missing' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/home`
Expected: FAIL — imports de `./ApiKeyGate`, `./ModelPicker` e `../../hooks/useKeyRevalidation` não resolvem.

- [ ] **Step 3: Implementar `src/hooks/useKeyRevalidation.ts`**

```ts
import { useEffect } from 'react'
import { validateKey } from '../lib/openrouter/client'
import { useAiSettingsStore } from '../store/useAiSettingsStore'

/** Revalida, uma vez por carregamento, a chave salva de uma sessão anterior. */
export function useKeyRevalidation(): void {
  const apiKey = useAiSettingsStore((s) => s.apiKey)
  const keyStatus = useAiSettingsStore((s) => s.keyStatus)
  const markKeyStatus = useAiSettingsStore((s) => s.markKeyStatus)

  useEffect(() => {
    if (keyStatus !== 'unknown' || !apiKey) return
    let cancelled = false
    validateKey(apiKey)
      .then((result) => {
        if (!cancelled) markKeyStatus(result)
      })
      .catch(() => {
        // Sem rede ou OpenRouter fora do ar: mantém "unknown" e deixa o chat tentar.
      })
    return () => {
      cancelled = true
    }
  }, [apiKey, keyStatus, markKeyStatus])
}
```

- [ ] **Step 4: Implementar `src/components/home/ApiKeyGate.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { validateKey } from '../../lib/openrouter/client'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'

export const ApiKeyGate = () => {
  const keyStatus = useAiSettingsStore((s) => s.keyStatus)
  const setApiKey = useAiSettingsStore((s) => s.setApiKey)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const key = value.trim()
    if (!key || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await validateKey(key)
      if (result === 'valid') setApiKey(key, 'valid')
      else setError('Chave inválida. Confira e tente novamente.')
    } catch {
      setError('Não foi possível validar a chave agora. Verifique sua conexão e tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const refused = keyStatus === 'invalid' && !error

  return (
    <form
      onSubmit={submit}
      className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 flex flex-col items-center justify-center gap-5 text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <KeyRound size={22} />
      </div>
      <div className="max-w-sm">
        <h4 className="text-xl font-black tracking-tight">Conecte sua chave do OpenRouter</h4>
        <p className="mt-2 text-[13px] text-white/40">
          O assistente usa modelos via OpenRouter. A chave fica salva apenas neste navegador e é enviada somente para
          openrouter.ai.
        </p>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-2">
        <input
          aria-label="Chave da API do OpenRouter"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-or-v1-…"
          className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-primary/50"
        />
        {(error || refused) && (
          <p role="alert" className="text-xs font-bold text-red-400">
            {error ?? 'A chave salva foi recusada pelo OpenRouter. Informe uma nova.'}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || value.trim() === ''}
          className="px-4 py-3 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-wide hover:bg-emerald-600 disabled:bg-white/10 disabled:text-white/30 transition-colors"
        >
          {busy ? 'Validando…' : 'Salvar chave'}
        </button>
      </div>
      <a
        href="https://openrouter.ai/keys"
        target="_blank"
        rel="noreferrer"
        className="text-[11px] font-bold text-primary hover:text-emerald-300"
      >
        Criar uma chave em openrouter.ai/keys
      </a>
    </form>
  )
}
```

- [ ] **Step 5: Implementar `src/components/home/ModelPicker.tsx`**

```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { MODEL_PRESETS, shortModelName } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'

export const ModelPicker = () => {
  const model = useAiSettingsStore((s) => s.model)
  const setModel = useAiSettingsStore((s) => s.setModel)
  const clearApiKey = useAiSettingsStore((s) => s.clearApiKey)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const choose = (id: string) => {
    setModel(id)
    setCustom('')
    setOpen(false)
  }

  const onCustomKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && custom.trim() !== '') {
      event.preventDefault()
      choose(custom)
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={model}
        className="flex items-center gap-2 px-3 py-1.5 min-w-0 max-w-[200px] bg-black/20 border border-white/5 rounded-xl text-white hover:border-primary/30 transition-colors"
      >
        <span className="w-[7px] h-[7px] rounded-full bg-primary shrink-0" />
        <span className="text-[11px] font-bold truncate">{shortModelName(model)}</span>
        <ChevronDown size={12} className="text-white/30 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 min-w-[260px] bg-[#0a0a0a] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-50">
          <div className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/30">
            Modelos via OpenRouter
          </div>
          {MODEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => choose(preset.id)}
              className={`w-full flex justify-between items-center gap-3 text-left px-3 py-2 rounded-lg transition-colors ${
                preset.id === model ? 'bg-primary text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-[11px] font-bold">{preset.id}</span>
              <span className="text-[10px] font-semibold opacity-60">{preset.note}</span>
            </button>
          ))}
          <div className="mt-1.5 pt-1.5 border-t border-white/5 flex flex-col gap-1.5">
            <input
              aria-label="Outro modelo"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={onCustomKeyDown}
              placeholder="Outro modelo: provedor/nome + Enter"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white placeholder:text-white/30 outline-none focus:border-primary/50"
            />
            <button
              type="button"
              onClick={() => {
                clearApiKey()
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold text-white/60 hover:bg-white/5 hover:text-white transition-colors"
            >
              Trocar chave da API
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/components/home && npm run build`
Expected: 12 testes passam (8 em `ApiKeyGate.test.tsx`, 4 em `ModelPicker.test.tsx`); build ok.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useKeyRevalidation.ts src/components/home/ApiKeyGate.tsx src/components/home/ApiKeyGate.test.tsx src/components/home/ModelPicker.tsx src/components/home/ModelPicker.test.tsx
git commit -m "feat: add OpenRouter key gate and model picker"
```

---

### Task 11: Painel do chat (mensagens, prévia, campo de envio)

**Files:**
- Create: `src/components/home/chatHelpers.ts`
- Create: `src/components/home/ProposalCard.tsx`
- Create: `src/components/home/MessageList.tsx`
- Create: `src/components/home/Composer.tsx`
- Create: `src/components/home/ChatPanel.tsx`
- Test: `src/components/home/ChatPanel.test.tsx`

**Interfaces:**
- Consumes:
  - `useChatStore`: estado `messages: UiMessage[]`, `typing`, `draft`, `stagedFile`, `composeRequest`; ações `setDraft`, `stageFile`, `requestCompose`, `newChat`, `sendMessage`, `confirmProposal(messageId, proposalId)`, `dismissProposal(messageId, proposalId)`
  - `Proposal` (`id`, `portfolioName`, `summary`, `rows: PreviewRow[]`, `status`, `error?`) de `src/chat/tools.ts`; `PreviewMode` de `src/domain/operations.ts`
  - `useAiSettingsStore` (`keyStatus`, `model`), `useKeyRevalidation()`, `<ApiKeyGate />`, `<ModelPicker />`, `shortModelName`
  - `collectCategories`, `categoryColor`, `brl`, `num`, `ACCEPTED_EXTENSIONS`
- Produces:
  - `CHAT_FILE_INPUT_ID: string`, `CHAT_HELPERS: { title: string; desc: string; run: () => void }[]`
  - `<ProposalCard messageId={string} proposal={Proposal} />`
  - `<MessageList />`, `<Composer />`, `<ChatPanel />` (sem props)

- [ ] **Step 1: Escrever os testes que falham**

`src/components/home/ChatPanel.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Proposal } from '../../chat/tools'
import { DEFAULT_MODEL } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'
import { ChatPanel } from './ChatPanel'

const chat = () => useChatStore.getState()

const proposal = (overrides: Partial<Proposal> = {}): Proposal => ({
  id: 'prop-1',
  portfolioId: 'default',
  portfolioName: 'Carteira Principal',
  summary: 'Colunas mapeadas: Papel → Ticker.',
  operations: [{ type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 30, mode: 'add' }],
  rows: [{ label: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 30, mode: 'novo' }],
  status: 'pending',
  ...overrides,
})

beforeEach(() => {
  useChatStore.setState(useChatStore.getInitialState(), true)
  useInvestmentStore.getState().clearAllData()
  useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid', model: DEFAULT_MODEL })
})

describe('ChatPanel', () => {
  it.each(['missing', 'invalid'] as const)('asks for the key when the key is %s', (keyStatus) => {
    useAiSettingsStore.setState({ apiKey: keyStatus === 'missing' ? '' : 'old', keyStatus })
    render(<ChatPanel />)
    expect(screen.getByLabelText('Chave da API do OpenRouter')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Pergunte algo ou cole os dados da sua corretora…')).not.toBeInTheDocument()
  })

  it('shows the empty state with helper cards when the key is valid', () => {
    render(<ChatPanel />)
    expect(screen.getByText('Como posso ajudar com sua carteira?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar compra/ })).toBeInTheDocument()
    expect(
      screen.getByText('Nada é salvo sem sua confirmação. Respostas podem conter erros — confira os valores.'),
    ).toBeInTheDocument()
  })

  it('fills the composer from the "Registrar compra" helper', async () => {
    render(<ChatPanel />)
    await userEvent.click(screen.getByRole('button', { name: /Registrar compra/ }))
    expect(screen.getByPlaceholderText('Pergunte algo ou cole os dados da sua corretora…')).toHaveValue(
      'Comprei 100 BBSE3 a 33,10',
    )
  })

  it('sends on Enter and keeps Shift+Enter for a new line', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    useChatStore.setState({ sendMessage })
    render(<ChatPanel />)
    const field = screen.getByPlaceholderText('Pergunte algo ou cole os dados da sua corretora…')
    await userEvent.type(field, 'linha 1{Shift>}{Enter}{/Shift}linha 2')
    expect(sendMessage).not.toHaveBeenCalled()
    await userEvent.type(field, '{Enter}')
    expect(sendMessage).toHaveBeenCalledWith('linha 1\nlinha 2')
  })

  it('disables sending when there is nothing to send', () => {
    render(<ChatPanel />)
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('stages an attached file and lets the user remove it', async () => {
    render(<ChatPanel />)
    const file = new File(['Ativo;Cotas\nTAEE11;80\n'], 'posicao.csv', { type: 'text/csv' })
    await userEvent.upload(screen.getByLabelText('Anexar planilha'), file)
    expect(chat().stagedFile).toBe(file)
    expect(screen.getByText('posicao.csv')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Remover anexo' }))
    expect(chat().stagedFile).toBeNull()
  })

  it('renders user and assistant messages, the attached file and the typing indicator', () => {
    useChatStore.setState({
      typing: true,
      messages: [
        { id: 'u1', role: 'user', text: 'Importa o extrato', file: { name: 'extrato.xlsx', meta: 'Planilha · 3 abas' } },
        { id: 'a1', role: 'assistant', text: 'Encontrei 4 posições.' },
      ],
    })
    render(<ChatPanel />)
    expect(screen.getByText('Importa o extrato')).toBeInTheDocument()
    expect(screen.getByText('extrato.xlsx')).toBeInTheDocument()
    expect(screen.getByText('Planilha · 3 abas')).toBeInTheDocument()
    expect(screen.getByText('Encontrei 4 posições.')).toBeInTheDocument()
    expect(screen.getByText('space-bunny-alpha está analisando…')).toBeInTheDocument()
    expect(screen.queryByText('Como posso ajudar com sua carteira?')).not.toBeInTheDocument()
  })

  it('shows a pending proposal and saves it on confirm', async () => {
    useChatStore.setState({ messages: [{ id: 'a1', role: 'assistant', text: 'Confira:', proposals: [proposal()] }] })
    render(<ChatPanel />)
    const card = screen.getByTestId('proposal-prop-1')
    expect(within(card).getByText('ITUB4')).toBeInTheDocument()
    expect(within(card).getByText('novo')).toBeInTheDocument()
    expect(within(card).getByText('Colunas mapeadas: Papel → Ticker.')).toBeInTheDocument()
    expect(within(card).getByText('→ Carteira Principal')).toBeInTheDocument()

    await userEvent.click(within(card).getByRole('button', { name: 'Confirmar' }))
    expect(useInvestmentStore.getState().portfolios[0].data.acoes[0]).toMatchObject({ Ticker: 'ITUB4', Quantidade: 10 })
    expect(within(card).getByText('Salvo em Carteira Principal')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
  })

  it('dismisses a proposal without saving', async () => {
    useChatStore.setState({ messages: [{ id: 'a1', role: 'assistant', text: 'Confira:', proposals: [proposal()] }] })
    render(<ChatPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.getByText('Descartado')).toBeInTheDocument()
    expect(useInvestmentStore.getState().portfolios[0].data.acoes).toEqual([])
  })

  it('shows why a proposal could not be saved', () => {
    useChatStore.setState({
      messages: [
        {
          id: 'a1',
          role: 'assistant',
          text: 'Confira:',
          proposals: [proposal({ status: 'failed', error: 'Operação 1 (remove_asset): O ativo ITUB4 não existe na carteira.' })],
        },
      ],
    })
    render(<ChatPanel />)
    expect(screen.getByText(/Não foi salvo/)).toHaveTextContent('O ativo ITUB4 não existe na carteira.')
  })

  it('starts a new conversation', async () => {
    useChatStore.setState({ messages: [{ id: 'a1', role: 'assistant', text: 'Olá' }] })
    render(<ChatPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Nova conversa' }))
    expect(chat().messages).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/home/ChatPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./ChatPanel"`.

- [ ] **Step 3: Criar `src/components/home/chatHelpers.ts`**

```ts
import { useChatStore } from '../../store/useChatStore'

export const CHAT_FILE_INPUT_ID = 'chat-file-input'

export interface ChatHelper {
  title: string
  desc: string
  run: () => void
}

export const CHAT_HELPERS: ChatHelper[] = [
  {
    title: 'Importar planilha',
    desc: 'XP, Rico, Nu, BTG, B3 — qualquer formato',
    run: () => document.getElementById(CHAT_FILE_INPUT_ID)?.click(),
  },
  {
    title: 'Registrar compra',
    desc: 'Ex.: "Comprei 100 BBSE3 a 33,10"',
    run: () => useChatStore.getState().requestCompose('Comprei 100 BBSE3 a 33,10'),
  },
  {
    title: 'Analisar alocação',
    desc: 'Peso de cada categoria na carteira',
    run: () => void useChatStore.getState().sendMessage('Como está minha alocação por categoria?'),
  },
  {
    title: 'Rebalancear',
    desc: 'Quanto aportar para chegar na meta',
    run: () => void useChatStore.getState().sendMessage('Como rebalancear para minha meta?'),
  },
]
```

- [ ] **Step 4: Criar `src/components/home/ProposalCard.tsx`**

```tsx
import { useMemo } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import type { Proposal } from '../../chat/tools'
import { collectCategories } from '../../domain/assets'
import type { PreviewMode } from '../../domain/operations'
import { categoryColor } from '../../domain/portfolioView'
import { brl, num } from '../../lib/format'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'

const CHIP: Record<PreviewMode, string> = {
  novo: 'bg-emerald-500/15 text-emerald-400',
  'nova categoria': 'bg-emerald-500/15 text-emerald-400',
  somar: 'bg-indigo-500/15 text-indigo-400',
  substituir: 'bg-amber-500/15 text-amber-400',
  mover: 'bg-amber-500/15 text-amber-400',
  renomear: 'bg-amber-500/15 text-amber-400',
  remover: 'bg-red-500/15 text-red-400',
  'excluir categoria': 'bg-red-500/15 text-red-400',
}

interface Props {
  messageId: string
  proposal: Proposal
}

export const ProposalCard = ({ messageId, proposal }: Props) => {
  const assetCategories = useInvestmentStore((s) => s.assetCategories)
  const portfolios = useInvestmentStore((s) => s.portfolios)
  const confirmProposal = useChatStore((s) => s.confirmProposal)
  const dismissProposal = useChatStore((s) => s.dismissProposal)
  const categories = useMemo(() => collectCategories(assetCategories, portfolios), [assetCategories, portfolios])

  return (
    <div
      data-testid={`proposal-${proposal.id}`}
      className="border border-white/10 rounded-[20px] bg-black/20 overflow-hidden"
    >
      <div className="flex justify-between items-center gap-2 px-4 py-3 border-b border-white/5">
        <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Prévia de alterações</span>
        <span className="text-[10px] font-bold text-white/40 truncate">→ {proposal.portfolioName}</span>
      </div>

      {proposal.rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,.6fr)_minmax(0,.9fr)_auto] gap-2 items-center px-4 py-2.5 border-b border-white/5 text-xs"
        >
          <span className="font-black truncate">{row.label}</span>
          <span className="flex items-center gap-1.5 min-w-0 text-white/60 font-semibold text-[11px]">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: categoryColor(row.category, categories) }}
            />
            <span className="truncate">{row.category}</span>
          </span>
          <span className="text-right text-white/70 font-bold">
            {row.quantity === undefined ? '' : num(row.quantity)}
          </span>
          <span className="text-right text-white/70 font-bold">
            {row.avgPrice === undefined ? '' : brl(row.avgPrice)}
          </span>
          <span
            className={`justify-self-end px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${CHIP[row.mode]}`}
          >
            {row.mode}
          </span>
        </div>
      ))}

      {proposal.summary && (
        <div className="px-4 py-2.5 text-[11px] text-white/40 font-semibold leading-relaxed">{proposal.summary}</div>
      )}

      {proposal.status === 'pending' && (
        <div className="flex gap-2 px-4 pb-3.5">
          <button
            type="button"
            onClick={() => confirmProposal(messageId, proposal.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-wide hover:bg-emerald-600 transition-colors"
          >
            <Check size={14} />
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => dismissProposal(messageId, proposal.id)}
            className="px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 text-white/60 text-[11px] font-black uppercase tracking-wide hover:text-white hover:bg-white/10 transition-colors"
          >
            Descartar
          </button>
        </div>
      )}
      {proposal.status === 'done' && (
        <div className="flex items-center gap-1.5 px-4 pb-3.5 text-emerald-400 text-[11px] font-black uppercase tracking-wide">
          <CheckCircle2 size={14} />
          Salvo em {proposal.portfolioName}
        </div>
      )}
      {proposal.status === 'dismissed' && (
        <div className="px-4 pb-3.5 text-white/30 text-[11px] font-black uppercase tracking-wide">Descartado</div>
      )}
      {proposal.status === 'failed' && (
        <div className="px-4 pb-3.5 text-red-400 text-[11px] font-bold leading-relaxed whitespace-pre-wrap">
          Não foi salvo: {proposal.error} Peça uma nova prévia.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Criar `src/components/home/MessageList.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { Bot, FileSpreadsheet } from 'lucide-react'
import { shortModelName } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { useChatStore, type UiMessage } from '../../store/useChatStore'
import { CHAT_HELPERS } from './chatHelpers'
import { ProposalCard } from './ProposalCard'

const BotAvatar = () => (
  <div className="w-7 h-7 rounded-[9px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
    <Bot size={15} />
  </div>
)

const UserMessage = ({ message }: { message: UiMessage }) => (
  <div className="flex flex-col items-end gap-1.5">
    {message.file && (
      <div className="flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-[14px] bg-white/5 border border-white/10">
        <div className="w-8 h-8 rounded-[10px] bg-primary/15 text-primary flex items-center justify-center">
          <FileSpreadsheet size={16} />
        </div>
        <div>
          <div className="text-xs font-bold">{message.file.name}</div>
          <div className="text-[10px] text-white/40 font-semibold">{message.file.meta}</div>
        </div>
      </div>
    )}
    <div className="max-w-[80%] px-4 py-2.5 rounded-[20px] bg-white/[0.07] text-[13px] leading-relaxed whitespace-pre-wrap break-words">
      {message.text}
    </div>
  </div>
)

const AssistantMessage = ({ message }: { message: UiMessage }) => (
  <div className="flex gap-3 items-start">
    <BotAvatar />
    <div className="flex-1 min-w-0 flex flex-col gap-3 pt-1">
      <div
        className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
          message.isError ? 'text-red-400' : 'text-white/85'
        }`}
      >
        {message.text}
      </div>
      {message.proposals?.map((proposal) => (
        <ProposalCard key={proposal.id} messageId={message.id} proposal={proposal} />
      ))}
    </div>
  </div>
)

export const MessageList = () => {
  const messages = useChatStore((s) => s.messages)
  const typing = useChatStore((s) => s.typing)
  const model = useAiSettingsStore((s) => s.model)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, typing])

  const isEmpty = messages.length === 0 && !typing

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
      {isEmpty && (
        <div className="h-full flex flex-col items-center justify-center gap-6 text-center max-w-[520px] mx-auto">
          <div>
            <h4 className="text-2xl font-black tracking-tight">Como posso ajudar com sua carteira?</h4>
            <p className="mt-2 text-[13px] text-white/40">
              Envie qualquer extrato ou planilha de corretora — eu identifico as colunas, classifico os ativos e mostro
              uma prévia antes de salvar.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
            {CHAT_HELPERS.map((helper) => (
              <button
                key={helper.title}
                type="button"
                onClick={helper.run}
                className="text-left p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-white flex flex-col gap-1.5 hover:bg-white/5 hover:border-primary/30 transition-colors"
              >
                <span className="text-xs font-black">{helper.title}</span>
                <span className="text-[11px] text-white/40 font-semibold leading-snug">{helper.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 max-w-[640px] mx-auto">
        {messages.map((message) =>
          message.role === 'user' ? (
            <UserMessage key={message.id} message={message} />
          ) : (
            <AssistantMessage key={message.id} message={message} />
          ),
        )}
        {typing && (
          <div className="flex gap-3 items-center">
            <BotAvatar />
            <span className="text-xs text-white/40 font-semibold">{shortModelName(model)} está analisando…</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Criar `src/components/home/Composer.tsx`**

```tsx
import { useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import { ArrowUp, FileSpreadsheet, Paperclip, X } from 'lucide-react'
import { ACCEPTED_EXTENSIONS } from '../../chat/attachments'
import { useChatStore } from '../../store/useChatStore'
import { CHAT_FILE_INPUT_ID, CHAT_HELPERS } from './chatHelpers'

export const Composer = () => {
  const draft = useChatStore((s) => s.draft)
  const typing = useChatStore((s) => s.typing)
  const stagedFile = useChatStore((s) => s.stagedFile)
  const composeRequest = useChatStore((s) => s.composeRequest)
  const hasMessages = useChatStore((s) => s.messages.length > 0)
  const setDraft = useChatStore((s) => s.setDraft)
  const stageFile = useChatStore((s) => s.stageFile)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (composeRequest > 0) textareaRef.current?.focus()
  }, [composeRequest])

  const canSend = !typing && (draft.trim() !== '' || stagedFile !== null)

  const send = () => {
    if (canSend) void sendMessage(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) stageFile(file)
    event.target.value = ''
  }

  return (
    <div className="px-6 pb-5 flex flex-col gap-2.5">
      {hasMessages && (
        <div className="flex gap-2 flex-wrap max-w-[640px] w-full mx-auto">
          {CHAT_HELPERS.map((helper) => (
            <button
              key={helper.title}
              type="button"
              onClick={helper.run}
              className="px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/60 text-[11px] font-bold whitespace-nowrap hover:text-white hover:border-primary/40 hover:bg-primary/[0.08] transition-colors"
            >
              {helper.title}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-[640px] w-full mx-auto bg-white/5 border border-white/10 rounded-3xl pt-3 pr-3 pb-2.5 pl-[18px] flex flex-col gap-2">
        {stagedFile && (
          <div className="self-start flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <FileSpreadsheet size={14} className="text-primary shrink-0" />
            <span className="text-[11px] font-bold truncate max-w-[220px]">{stagedFile.name}</span>
            <button
              type="button"
              aria-label="Remover anexo"
              onClick={() => stageFile(null)}
              className="p-0.5 rounded-md text-white/40 hover:text-white hover:bg-white/10"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Pergunte algo ou cole os dados da sua corretora…"
          className="w-full resize-none bg-transparent border-none outline-none text-white text-[13px] leading-normal py-1 placeholder:text-white/30"
        />
        <div className="flex justify-between items-center">
          <label
            title="Anexar planilha (.xlsx, .xls, .csv)"
            className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full border border-white/10 text-white/60 cursor-pointer hover:text-white hover:bg-white/5 transition-colors"
          >
            <Paperclip size={16} />
            <span className="text-[11px] font-bold">Anexar</span>
            <input
              id={CHAT_FILE_INPUT_ID}
              aria-label="Anexar planilha"
              type="file"
              className="hidden"
              accept={ACCEPTED_EXTENSIONS.join(',')}
              onChange={onFile}
            />
          </label>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label="Enviar"
            title="Enviar"
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center bg-primary text-white disabled:bg-white/10 disabled:text-white/30 transition-colors"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>

      <div className="text-center text-[10px] text-white/25 font-semibold">
        Nada é salvo sem sua confirmação. Respostas podem conter erros — confira os valores.
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Criar `src/components/home/ChatPanel.tsx`**

```tsx
import { Bot, SquarePen } from 'lucide-react'
import { useKeyRevalidation } from '../../hooks/useKeyRevalidation'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { useChatStore } from '../../store/useChatStore'
import { ApiKeyGate } from './ApiKeyGate'
import { Composer } from './Composer'
import { MessageList } from './MessageList'
import { ModelPicker } from './ModelPicker'

export const ChatPanel = () => {
  const keyStatus = useAiSettingsStore((s) => s.keyStatus)
  const newChat = useChatStore((s) => s.newChat)
  useKeyRevalidation()

  const locked = keyStatus === 'missing' || keyStatus === 'invalid'

  return (
    <section className="bg-card border border-white/10 rounded-[32px] flex flex-col min-h-0 shadow-2xl relative">
      <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-white/5 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bot size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black tracking-tight text-white/90">Assistente</h3>
            <div className="text-[11px] text-white/40 font-semibold truncate">
              Importa, organiza e analisa sua carteira
            </div>
          </div>
        </div>
        {!locked && (
          <div className="flex items-center gap-2 ml-auto min-w-0">
            <ModelPicker />
            <button
              type="button"
              onClick={newChat}
              title="Nova conversa"
              aria-label="Nova conversa"
              className="w-[34px] h-[34px] flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <SquarePen size={16} />
            </button>
          </div>
        )}
      </div>

      {locked ? (
        <ApiKeyGate />
      ) : (
        <>
          <MessageList />
          <Composer />
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/components/home && npm run build`
Expected: todos os testes de `src/components/home` passam (12 novos em `ChatPanel.test.tsx`); build ok.

- [ ] **Step 9: Commit**

```bash
git add src/components/home/chatHelpers.ts src/components/home/ProposalCard.tsx src/components/home/MessageList.tsx src/components/home/Composer.tsx src/components/home/ChatPanel.tsx src/components/home/ChatPanel.test.tsx
git commit -m "feat: add chat panel with proposal preview and composer"
```

---

### Task 12: Painel da carteira e atualização de cotações

**Files:**
- Create: `src/hooks/useQuoteRefresh.ts`
- Create: `src/components/home/PortfolioPanel.tsx`
- Test: `src/components/home/PortfolioPanel.test.tsx`

**Interfaces:**
- Consumes:
  - `fetchQuotes(symbols: string[], isManualLoad?: boolean): Promise<QuoteData[]>` de `src/services/brapi.ts` (já existe)
  - `useInvestmentStore`: `portfolio`, `portfolios`, `assetCategories`, `customLists`, `updatePortfolioPrices(quotes)`, `addHistoryEntry(total)`
  - `listAssets`, `collectCategories` de `src/domain/assets.ts`
  - `buildPortfolioView(assets, categories, filter)`, `donutBackground(slices)`, `ALL_FILTER` de `src/domain/portfolioView.ts`
  - `brl`, `pct`, `num` de `src/lib/format.ts`
  - `useChatStore.getState().requestCompose(text)`
- Produces: `useQuoteRefresh(): void`, `<PortfolioPanel />` (sem props).

`useQuoteRefresh` substitui o `handleRefresh` do `Dashboard.tsx` antigo: busca cotações ao montar, a cada 5 minutos e sempre que o conjunto de tickers muda (por exemplo, depois de confirmar uma importação).

- [ ] **Step 1: Escrever os testes que falham**

`src/components/home/PortfolioPanel.test.tsx`:

```tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchQuotes } from '../../services/brapi'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'
import { PortfolioPanel } from './PortfolioPanel'

vi.mock('../../services/brapi', () => ({ fetchQuotes: vi.fn() }))

const quotes = vi.mocked(fetchQuotes)
const invest = () => useInvestmentStore.getState()

const seed = () =>
  invest().applyAssetOperations('default', [
    { type: 'upsert_asset', ticker: 'ITUB4', category: 'Ações', quantity: 10, avgPrice: 60, mode: 'add' },
    { type: 'upsert_asset', ticker: 'WEGE3', category: 'Ações', quantity: 10, avgPrice: 20, mode: 'add' },
    { type: 'upsert_asset', ticker: 'HGLG11', category: 'FIIs', quantity: 10, avgPrice: 20, mode: 'add' },
  ])

beforeEach(() => {
  quotes.mockReset()
  quotes.mockResolvedValue([])
  useChatStore.setState(useChatStore.getInitialState(), true)
  invest().clearAllData()
})

describe('PortfolioPanel', () => {
  it('invites the user to the chat when the portfolio is empty', () => {
    render(<PortfolioPanel />)
    expect(screen.getByText('Nenhum ativo ainda')).toBeInTheDocument()
  })

  it('shows category pills with their share and every asset sorted by value', () => {
    seed()
    render(<PortfolioPanel />)
    expect(screen.getByTestId('pill-Ações')).toHaveTextContent('80,0%')
    expect(screen.getByTestId('pill-FIIs')).toHaveTextContent('20,0%')
    expect(screen.getAllByTestId('asset-row').map((row) => within(row).getByTestId('asset-ticker').textContent)).toEqual([
      'ITUB4',
      'WEGE3',
      'HGLG11',
    ])
    expect(screen.getByText('3 ativos')).toBeInTheDocument()
    expect(screen.getByText('% da carteira por categoria')).toBeInTheDocument()
  })

  it('filters by category from a pill and recomputes allocation inside it', async () => {
    seed()
    render(<PortfolioPanel />)
    await userEvent.click(screen.getByTestId('pill-Ações'))
    const rows = screen.getAllByTestId('asset-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('75,0%')
    expect(screen.getByText('% dentro de Ações')).toBeInTheDocument()
    expect(screen.getByText('Aloc. cat.')).toBeInTheDocument()
  })

  it('filters by category from the chart legend', async () => {
    seed()
    render(<PortfolioPanel />)
    await userEvent.click(screen.getByTestId('legend-FIIs'))
    expect(screen.getAllByTestId('asset-row')).toHaveLength(1)
  })

  it('sends "Adicionar" to the chat composer', async () => {
    seed()
    render(<PortfolioPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(useChatStore.getState()).toMatchObject({ draft: 'Comprei ', composeRequest: 1 })
  })

  it('refreshes quotes for stocks and funds and applies them', async () => {
    seed()
    quotes.mockResolvedValue([
      { symbol: 'ITUB4', shortName: 'Itaú', regularMarketPrice: 70, regularMarketChangePercent: 0, logourl: '', sector: 'Bancos' },
    ])
    render(<PortfolioPanel />)
    await waitFor(() => expect(invest().portfolios[0].data.acoes[0].Cotacao).toBe(70))
    expect(quotes.mock.calls[0][0].sort()).toEqual(['HGLG11', 'ITUB4', 'WEGE3'])
  })

  it('does not ask for quotes when there is nothing quotable', () => {
    render(<PortfolioPanel />)
    expect(quotes).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/home/PortfolioPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./PortfolioPanel"`.

- [ ] **Step 3: Implementar `src/hooks/useQuoteRefresh.ts`**

```ts
import { useEffect, useRef } from 'react'
import { fetchQuotes } from '../services/brapi'
import { useInvestmentStore } from '../store/useInvestmentStore'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

function quotableTickers(): string[] {
  const { portfolio, customLists } = useInvestmentStore.getState()
  const fromPortfolio = [
    ...(portfolio?.acoes || []),
    ...(portfolio?.fiis || []),
    ...(portfolio?.manualAssets || []),
  ].map((asset: any) => asset.Ticker)
  const fromLists = (customLists || []).flatMap((list: any) => (list.items || []).map((item: any) => item.ticker))
  return Array.from(new Set<string>([...fromPortfolio, ...fromLists].filter(Boolean))).sort()
}

/** Busca cotações ao montar, a cada 5 minutos e quando o conjunto de tickers muda. */
export function useQuoteRefresh(): void {
  const tickerKey = useInvestmentStore(() => quotableTickers().join(','))
  const busy = useRef(false)

  useEffect(() => {
    const refresh = async () => {
      const tickers = quotableTickers()
      if (busy.current || tickers.length === 0) return
      busy.current = true
      try {
        const quotes = await fetchQuotes(tickers)
        if (quotes.length > 0) {
          const store = useInvestmentStore.getState()
          store.updatePortfolioPrices(quotes)
          store.addHistoryEntry(useInvestmentStore.getState().portfolio?.total_live || 0)
        }
      } catch (error) {
        console.error('Erro ao atualizar cotações:', error)
      } finally {
        busy.current = false
      }
    }

    void refresh()
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [tickerKey])
}
```

- [ ] **Step 4: Implementar `src/components/home/PortfolioPanel.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { collectCategories, listAssets } from '../../domain/assets'
import { ALL_FILTER, buildPortfolioView, donutBackground } from '../../domain/portfolioView'
import { useQuoteRefresh } from '../../hooks/useQuoteRefresh'
import { brl, num, pct } from '../../lib/format'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'

const CARD = 'bg-card border border-white/10 rounded-[32px] p-6 shadow-2xl'
const ROW_GRID = 'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,.9fr)_minmax(0,.8fr)_minmax(0,1.2fr)] gap-2'
const DONUT_MASK = 'radial-gradient(farthest-side, transparent 69.5%, #000 70%)'

const wholeBrl = (value: number) => brl(value).replace(/,\d+$/, '')
const signedPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2).replace('.', ',')}%`

export const PortfolioPanel = () => {
  const portfolio = useInvestmentStore((s) => s.portfolio)
  const portfolios = useInvestmentStore((s) => s.portfolios)
  const assetCategories = useInvestmentStore((s) => s.assetCategories)
  const [requestedFilter, setFilter] = useState(ALL_FILTER)
  useQuoteRefresh()

  const view = useMemo(
    () => buildPortfolioView(listAssets(portfolio), collectCategories(assetCategories, portfolios), requestedFilter),
    [portfolio, portfolios, assetCategories, requestedFilter],
  )
  const isAll = view.filter === ALL_FILTER

  if (view.rows.length === 0 && isAll) {
    return (
      <section className={`${CARD} flex flex-col items-center justify-center gap-4 text-center min-h-0`}>
        <Wallet size={48} className="text-white/20" />
        <h3 className="text-xl font-black text-white">Nenhum ativo ainda</h3>
        <p className="text-sm text-white/40 max-w-sm">
          Envie uma planilha ou registre uma compra no chat para ver sua carteira aqui.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 min-h-0">
      <div className="flex flex-wrap gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl shrink-0">
        {view.pills.map((pill) => {
          const active = pill.label === view.filter
          return (
            <button
              key={pill.label}
              type="button"
              data-testid={`pill-${pill.label}`}
              onClick={() => setFilter(pill.label)}
              className={`flex-[1_0_auto] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap transition-colors ${
                active ? 'bg-primary text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="text-xs font-bold">{pill.label}</span>
              <span className="text-[10px] font-black opacity-70">
                {pill.share === null ? wholeBrl(pill.value) : pct(pill.share)}
              </span>
            </button>
          )
        })}
      </div>

      <div className={`${CARD} shrink-0`}>
        <div className="flex justify-between items-center gap-3 mb-4">
          <h3 className="text-lg font-black tracking-tight text-white/90">Composição</h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/30 text-right">
            {isAll ? '% da carteira por categoria' : `% dentro de ${view.filter}`}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-5 items-center justify-center">
          <div className="relative w-[200px] h-[200px] shrink-0">
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: donutBackground(view.slices), mask: DONUT_MASK, WebkitMask: DONUT_MASK }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-xs text-white/30 uppercase font-black tracking-tight">{view.filter}</div>
              <div className="text-lg font-black text-white/90">{brl(view.base)}</div>
            </div>
          </div>
          <div className="flex-[1_1_200px] min-w-0 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-1.5">
            {view.slices.map((slice) => (
              <button
                key={slice.name}
                type="button"
                data-testid={`legend-${slice.name}`}
                disabled={!slice.selectable}
                onClick={() => setFilter(slice.name)}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] text-white text-left enabled:hover:bg-white/5 disabled:cursor-default"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: slice.color }} />
                  <span className="text-[13px] font-black text-white/80 truncate">{slice.name}</span>
                </span>
                <span className="flex flex-col items-end shrink-0">
                  <span className="text-[13px] font-black text-white/90">
                    {pct(view.base > 0 ? (slice.value / view.base) * 100 : 0)}
                  </span>
                  <span className="text-[11px] text-white/30 font-bold tracking-tighter">{brl(slice.value)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`${CARD} flex-1 min-h-0 flex flex-col`}>
        <div className="flex justify-between items-center gap-3 mb-2">
          <div className="flex items-baseline gap-2.5 whitespace-nowrap min-w-0">
            <h3 className="text-lg font-black tracking-tight text-white/90">Ativos Detalhados</h3>
            <span className="text-[11px] font-bold text-white/30">
              {view.rows.length} {view.rows.length === 1 ? 'ativo' : 'ativos'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => useChatStore.getState().requestCompose('Comprei ')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary/20 transition-colors"
          >
            <Plus size={16} />
            <span className="text-xs font-black uppercase tracking-tight">Adicionar</span>
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          <div className="min-w-[520px]">
            <div
              className={`${ROW_GRID} px-2 py-3.5 border-b border-white/5 text-xs text-white/40 uppercase font-black tracking-widest sticky top-0 bg-card`}
            >
              <span>Ativo</span>
              <span>Cotação</span>
              <span>{isAll ? 'Aloc.' : 'Aloc. cat.'}</span>
              <span className="text-right">Rent.</span>
              <span className="text-right">Valor</span>
            </div>
            {view.rows.map((row) => (
              <div
                key={row.key}
                data-testid="asset-row"
                className={`${ROW_GRID} px-2 py-3.5 border-b border-white/5 items-center text-sm hover:bg-white/5`}
              >
                <div className="min-w-0">
                  <div data-testid="asset-ticker" className="font-black tracking-tight truncate">
                    {row.ticker}
                  </div>
                  <div className="text-[11px] text-white/20 font-bold truncate">{row.subtitle}</div>
                </div>
                <div>
                  <div className="font-bold text-white/90">{brl(row.price)}</div>
                  <div className="text-[10px] text-white/20">PM: {brl(row.avgPrice)}</div>
                </div>
                <div className="flex flex-col gap-[5px]">
                  <span className="font-bold text-primary/80">{pct(row.allocation)}</span>
                  <span className="h-[3px] rounded-sm bg-white/5 overflow-hidden max-w-[72px]">
                    <span
                      className="block h-full rounded-sm bg-primary"
                      style={{ width: `${Math.min(100, row.allocation)}%` }}
                    />
                  </span>
                </div>
                <div className={`text-right font-bold ${row.returnPct >= 0 ? 'text-primary' : 'text-red-500'}`}>
                  {signedPct(row.returnPct)}
                </div>
                <div className="text-right">
                  <div className="font-black text-white/90">{brl(row.value)}</div>
                  <div className="text-[11px] text-white/20 font-medium">{num(row.quantity)} un.</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/components/home/PortfolioPanel.test.tsx && npm run build`
Expected: 7 testes passam; build ok.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useQuoteRefresh.ts src/components/home/PortfolioPanel.tsx src/components/home/PortfolioPanel.test.tsx
git commit -m "feat: add portfolio panel with category filter and quote refresh"
```

---

### Task 13: Nova página principal e remoção do fluxo antigo de importação

**Files:**
- Create: `src/components/home/HomePage.tsx`
- Test: `src/components/Sidebar.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/DataManagement.tsx`
- Modify: `src/store/useInvestmentStore.ts`
- Delete: `src/components/Dashboard.tsx`, `src/components/ImportModal.tsx`, `src/utils/parser.ts`, `src/utils/universalParser.ts`

**Interfaces:**
- Consumes: `<ChatPanel />`, `<PortfolioPanel />`, `useChatStore.getState().stageFile(file)`.
- Produces: `<HomePage />` (sem props), renderizado quando `activeTab === 'dashboard'`.

- [ ] **Step 1: Escrever o teste que falha (Sidebar entrega o arquivo ao chat)**

`src/components/Sidebar.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useChatStore } from '../store/useChatStore'
import { useInvestmentStore } from '../store/useInvestmentStore'
import { Sidebar } from './Sidebar'

beforeEach(() => {
  useChatStore.setState(useChatStore.getInitialState(), true)
  useInvestmentStore.getState().clearAllData()
})

describe('Sidebar', () => {
  it('hands an imported spreadsheet to the chat and opens the dashboard', async () => {
    useInvestmentStore.getState().setActiveTab('history')
    const { container } = render(<Sidebar />)
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"][accept=".csv,.xlsx,.xls"]')
    expect(inputs.length).toBeGreaterThanOrEqual(2)

    const file = new File(['Ativo;Cotas\nTAEE11;80\n'], 'posicao.csv', { type: 'text/csv' })
    await userEvent.upload(inputs[0], file)

    expect(useChatStore.getState().stagedFile).toBe(file)
    expect(useInvestmentStore.getState().activeTab).toBe('dashboard')
  })

  it('no longer exports importConfig in the backup payload', () => {
    expect('importConfig' in useInvestmentStore.getState()).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/Sidebar.test.tsx`
Expected: FAIL — o upload abre o `ImportModal` em vez de preencher `stagedFile`, e `importConfig` ainda existe no store.

- [ ] **Step 3: Criar `src/components/home/HomePage.tsx`**

```tsx
import { ChatPanel } from './ChatPanel'
import { PortfolioPanel } from './PortfolioPanel'

export const HomePage = () => (
  <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6 overflow-hidden">
    <div className="flex-1 min-h-0 grid gap-6 overflow-y-auto custom-scrollbar [grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr))] [grid-auto-rows:minmax(640px,1fr)]">
      <ChatPanel />
      <PortfolioPanel />
    </div>
  </div>
)
```

- [ ] **Step 4: Ligar a página em `src/App.tsx`**

Troque a linha

```tsx
import { Dashboard } from './components/Dashboard'
```

por

```tsx
import { HomePage } from './components/home/HomePage'
```

e a linha

```tsx
            {activeTab === 'dashboard' && <Dashboard />}
```

por

```tsx
            {activeTab === 'dashboard' && <HomePage />}
```

- [ ] **Step 5: Atualizar `src/components/Sidebar.tsx`**

(a) Imports: remova `import { ImportModal } from './ImportModal';` e adicione

```tsx
import { useChatStore } from '../store/useChatStore';
```

(b) Na desestruturação de `useInvestmentStore()`, remova a linha `importConfig,`.

(c) Remova estes dois estados:

```tsx
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedXlsxFile, setSelectedXlsxFile] = useState<File | null>(null);
```

(d) Substitua `handleFileUpload` inteiro por:

```tsx
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      useChatStore.getState().stageFile(file);
      setActiveTab('dashboard');
      setIsMobileMenuOpen(false);
      e.target.value = '';
    }
  };
```

(e) Em `handleExportBackup`, remova a linha `importConfig,` do objeto `data`.

(f) Em `navItemsContent`, substitua o bloco

```tsx
      <NavItem
        icon={<Upload size={18} />}
        label="Importar Planilha"
        active={isImportModalOpen}
        onClick={() => {
          setSelectedXlsxFile(null);
          setIsImportModalOpen(true);
          setIsMobileMenuOpen(false);
        }}
      />
```

por

```tsx
      <label className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-semibold text-white/50 hover:text-white hover:bg-white/5 cursor-pointer">
        <Upload size={18} />
        <span className="truncate">Importar Planilha</span>
        <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
      </label>
```

(g) No fim do JSX, remova o bloco inteiro:

```tsx
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setSelectedXlsxFile(null);
        }}
        initialFile={selectedXlsxFile}
      />
```

- [ ] **Step 6: Remover `importConfig` de `src/components/DataManagement.tsx`**

(a) No `useEffect`, remova `importConfig,` da desestruturação de `store` e a linha `importConfig,` do objeto `data`.

(b) Em `handleClearAll`, remova do objeto `emptyData` o bloco:

```tsx
        importConfig: {
          sections: [
            { id: 'fiis', name: 'Fundos Imobiliários', trigger: 'Fundos Listados', type: 'fiis', mapping: { ticker: 0, position: 1, allocation: 2, price: 6, quantity: 7 } },
            { id: 'acoes', name: 'Ações', trigger: 'Renda Variável Brasil', type: 'acoes', mapping: { ticker: 0, position: 1, allocation: 2, price: 5, quantity: 6 } },
            { id: 'tesouro', name: 'Tesouro Direto', trigger: 'Tesouro Direto', type: 'tesouro', mapping: { ticker: 0, position: 1, allocation: 2, price: 3, quantity: 4 } },
            { id: 'renda_fixa', name: 'Renda Fixa', trigger: 'Renda Fixa', type: 'renda_fixa', mapping: { ticker: 0, position: 1, allocation: 2, price: 3, quantity: 8, extra: 7 } }
          ]
        },
```

- [ ] **Step 7: Remover `importConfig` de `src/store/useInvestmentStore.ts`**

Remova:

(a) As interfaces `ColumnMapping`, `SectionConfig` e `ImportConfig` (do `export interface ColumnMapping {` até o `}` que fecha `ImportConfig`).

(b) Em `interface InvestmentStore`, as três linhas:

```ts
  importConfig: ImportConfig
  setImportConfig: (config: ImportConfig) => void
  autoBuildImportSections: (sheetName: string, mapping: { tickerCol: number; quantityCol: number; priceCol: number; categoryCol: number | null }, parsedData: PortfolioData) => void
```

(c) No estado inicial, o bloco `importConfig: { sections: [ ... ] },` (logo depois de `contributionAmount: 1000,`).

(d) Em `loadBackup`, o bloco `importConfig: data.importConfig || { sections: [ ... ] },`.

(e) A linha `setImportConfig: (importConfig) => set({ importConfig }),`.

(f) A ação inteira `autoBuildImportSections: (sheetName, mapping, parsedData) => set((state) => { ... }),`.

(g) Em `clearAllData`, o bloco final `importConfig: { sections: [ ... ] }` e a vírgula que sobrar depois de `contributionAmount: 1000`.

Backups antigos que ainda tragam `importConfig` continuam carregando: `loadBackup` simplesmente ignora o campo.

- [ ] **Step 8: Apagar os arquivos substituídos**

```bash
git rm src/components/Dashboard.tsx src/components/ImportModal.tsx src/utils/parser.ts src/utils/universalParser.ts
```

- [ ] **Step 9: Confirmar que não sobrou referência**

Run: `grep -rnE "importConfig|ImportModal|universalParser|utils/parser|autoBuildImportSections|components/Dashboard" src`
Expected: a única linha é a do teste `src/components/Sidebar.test.tsx` (`'importConfig' in ...`).

- [ ] **Step 10: Rodar tudo**

Run: `npm test && npm run build`
Expected: todos os testes passam, inclusive os 2 de `Sidebar.test.tsx`; build termina com `✓ built in`.

- [ ] **Step 11: Commit**

```bash
git add -A src
git commit -m "feat: replace dashboard with chat + portfolio home and remove legacy import flow"
```

---

### Task 14: Documentação e verificação no navegador

**Files:**
- Create: `docs/openrouter.md`
- Modify: `README.md`
- Modify: `README.pt-BR.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: o app completo das tarefas anteriores.
- Produces: documentação; nenhuma API nova.

- [ ] **Step 1: Criar `docs/openrouter.md`**

```markdown
# Assistente (OpenRouter)

A página principal é dividida em dois painéis: o **Assistente** (chat) e a **carteira** (composição e ativos).

## Chave da API

- Crie uma chave em https://openrouter.ai/keys e cole no formulário do Assistente.
- A chave é validada em `GET https://openrouter.ai/api/v1/key` e salva apenas no `localStorage` do navegador (item `ai-settings`). Ela não entra no backup JSON.
- Se o OpenRouter recusar a chave (HTTP 401), o formulário volta a aparecer e a mensagem que você estava enviando é preservada.
- Para trocar a chave: menu do modelo → **Trocar chave da API**.

## Modelo

O padrão é `stealth/space-bunny-alpha`. O menu do modelo lista alguns predefinidos e aceita qualquer ID do OpenRouter que suporte *tool calling*.

## O que o Assistente faz

| Pedido | Exemplo |
| --- | --- |
| Importar planilha | Anexe um `.xlsx`, `.xls` ou `.csv` de qualquer corretora |
| Registrar compra | "Comprei 100 BBSE3 a 33,10" |
| Corrigir ou remover ativo | "Remove o MXRF11", "O preço médio de ITUB4 é 28,40" |
| Reclassificar | "TAEE11 é ação, não FII" |
| Gerenciar categorias | "Cria a categoria ETFs e move IVVB11 para ela" |
| Analisar | "Como está minha alocação?", "Como rebalancear para minha meta?" |

Toda alteração aparece primeiro como **prévia**. Nada é salvo até você clicar em **Confirmar**.

## Categorias

`Ações`, `FIIs`, `Renda Fixa` e `Tesouro Direto` são embutidas e não podem ser renomeadas ou excluídas. Qualquer outra categoria é livre.

## Limites

- Arquivos são lidos no navegador e enviados como texto ao modelo: até 300 linhas por aba e 60 000 caracteres no total. Acima disso o arquivo é truncado e o Assistente avisa.
- PDF não é suportado.
- A conversa não é salva: recarregar a página começa uma nova.
- Com a visão "Todas as carteiras" ativa, as alterações são gravadas na primeira carteira; o cartão de prévia mostra o destino.

## Código

| Arquivo | Papel |
| --- | --- |
| `src/lib/openrouter/client.ts` | Chamadas HTTP ao OpenRouter |
| `src/chat/tools.ts` | Ferramentas `get_portfolio` e `propose_changes` |
| `src/chat/agent.ts` | Loop de tool calling |
| `src/chat/attachments.ts` | Leitura de planilhas |
| `src/domain/operations.ts` | Validação e aplicação das operações |
| `src/store/useChatStore.ts` | Estado do chat, confirmar e descartar |
```

- [ ] **Step 2: Atualizar `.env.example`**

Substitua o conteúdo inteiro por:

```
# Token da brapi.dev — usado para cotações e P/L
VITE_BRAPI_API_KEY=
```

(A linha `GEMINI_API_KEY` não é usada pelo app. A chave do OpenRouter não vai em `.env`: é informada na interface.)

- [ ] **Step 3: Atualizar `README.md`**

(a) Na tabela de Features, troque a linha `| **Dashboard** | ... |` por:

```markdown
| **Dashboard** | Split view: an AI assistant (OpenRouter) that imports spreadsheets and manages assets and categories through confirm-before-save previews, next to the portfolio composition chart and detailed asset table. |
```

(b) Substitua a seção `### Universal spreadsheet import` inteira (do título até a linha `A sample file is available at ...`, inclusive) por:

```markdown
### Assistant-driven import

There is no column-mapping wizard. Attach any `.csv`, `.xlsx` or `.xls` broker export in the chat and the model:

- works out which columns hold the ticker, quantity and average price;
- classifies each asset (including `…11` tickers that are units, not FIIs);
- shows a preview of every change, which is only saved after you click **Confirmar**.

You need your own [OpenRouter](https://openrouter.ai/keys) API key; it is stored only in your browser. See [`docs/openrouter.md`](./docs/openrouter.md). A sample file is available at `public/modelo_importacao.xlsx`.
```

(c) Em "Tech stack", acrescente o item:

```markdown
- **OpenRouter** (chat completions with tool calling) for the assistant, **Vitest** + Testing Library for tests
```

(d) Em "Scripts", acrescente `npm test` (roda a suíte uma vez) e `npm run test:watch`.

(e) Em "Data and privacy", acrescente o parágrafo:

```markdown
The assistant sends your messages, attached spreadsheet contents and a summary of the portfolio you are viewing to OpenRouter and the model provider you select. Nothing else leaves the browser.
```

(f) Em "Project structure", remova as linhas de `ImportModal.tsx` e `universalParser.ts`, troque a de `Dashboard.tsx` por `home/` (`# Chat + portfolio home page`) e acrescente `src/chat/`, `src/domain/` e `src/lib/openrouter/` com uma descrição de uma linha cada.

- [ ] **Step 4: Atualizar `README.pt-BR.md`**

Faça as mesmas seis mudanças do Step 3, em português. Para (a) e (b) use:

```markdown
| **Dashboard** | Tela dividida: um assistente de IA (OpenRouter) que importa planilhas e gerencia ativos e categorias com prévia e confirmação, ao lado do gráfico de composição e da tabela de ativos. |
```

```markdown
### Importação pelo assistente

Não há mais assistente de mapeamento de colunas. Anexe no chat qualquer exportação `.csv`, `.xlsx` ou `.xls` da corretora e o modelo:

- descobre quais colunas têm o ticker, a quantidade e o preço médio;
- classifica cada ativo (inclusive tickers `…11` que são units, não FIIs);
- mostra uma prévia de cada alteração, que só é salva depois de você clicar em **Confirmar**.

Você precisa de uma chave própria do [OpenRouter](https://openrouter.ai/keys); ela fica salva apenas no seu navegador. Veja [`docs/openrouter.md`](./docs/openrouter.md). Há um modelo de exemplo em `public/modelo_importacao.xlsx`.
```

Para (e):

```markdown
O assistente envia suas mensagens, o conteúdo das planilhas anexadas e um resumo da carteira em exibição para o OpenRouter e para o provedor do modelo escolhido. Nada mais sai do navegador.
```

- [ ] **Step 5: Verificação automática final**

Run: `npm test && npm run build`
Expected: todos os testes passam; build termina com `✓ built in`.

- [ ] **Step 6: Verificação no navegador, sem chave**

Run: `npm run dev` e abra `http://localhost:5173`.

Confira, sem informar chave nenhuma:
1. A aba Dashboard mostra dois painéis lado a lado em tela larga e empilhados abaixo de ~1100px de largura.
2. O painel esquerdo mostra "Conecte sua chave do OpenRouter"; o direito mostra a carteira (ou "Nenhum ativo ainda").
3. Digitar uma chave qualquer inválida (por exemplo `teste`) e clicar em "Salvar chave" mostra "Chave inválida. Confira e tente novamente." e o formulário continua.
4. As outras abas (Estratégia, Projeção, Plano Mensal, Preço Médio, Imposto de Renda, Financiamento, Histórico, Menu de Dados) abrem sem erro no console.
5. "Importar Planilha" na barra lateral abre o seletor de arquivo; depois de escolher um arquivo o app volta para o Dashboard.

- [ ] **Step 7: Verificação no navegador, com chave (feita pela pessoa)**

Quem executa o plano **não** deve digitar a chave do usuário. Peça para a pessoa informar a própria chave do OpenRouter na interface e conferir:
1. Depois de salvar a chave, aparece "Como posso ajudar com sua carteira?" com os quatro atalhos.
2. Anexar `public/modelo_importacao.xlsx` e enviar gera uma prévia; "Confirmar" atualiza o gráfico e a lista; "Descartar" não altera nada.
3. "Comprei 100 BBSE3 a 33,10" gera uma prévia de uma linha com o selo `novo` (ou `somar`, se o ativo já existir).
4. "Cria a categoria ETFs e move BBSE3 para ela" gera uma prévia com `nova categoria` e `mover`; depois de confirmar, surge a pílula "ETFs".
5. "Como está minha alocação por categoria?" responde com percentuais que batem com as pílulas.
6. Recarregar a página mantém a chave (sem pedir de novo) e começa uma conversa nova.
7. Menu do modelo → "Trocar chave da API" volta para o formulário.

- [ ] **Step 8: Commit**

```bash
git add docs/openrouter.md README.md README.pt-BR.md .env.example
git commit -m "docs: document the OpenRouter assistant and chat-driven import"
```
