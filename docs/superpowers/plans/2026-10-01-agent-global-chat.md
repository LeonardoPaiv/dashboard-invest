# Assistente global: mais ferramentas, chat flutuante, conversas salvas e navegação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O assistente passa a ler e configurar tudo o que o app guarda localmente (carteiras, metas, aporte, plano mensal, financiamento, projeção), fica disponível em todas as páginas num botão flutuante no canto inferior direito, salva as conversas e consegue levar o usuário para a página dos dados em que mexeu.

**Architecture:** O padrão atual continua: o modelo nunca escreve nos stores. Leituras são ferramentas diretas; escritas viram uma **proposta** com prévia, validada por funções puras em `src/domain/` e aplicada só no clique em Confirmar. Entram duas famílias novas: `propose_settings` (operações de configuração validadas por `src/domain/settingsOperations.ts` sobre um `SettingsSnapshot` lido/escrito por `src/chat/appState.ts`) e `navigate` (efeito imediato, só muda a página/carteira exibida). O `useChatStore` ganha persistência (`conversations`) e o estado do painel flutuante; a conversa em uso continua nos campos `messages`/`history` de sempre, e um `subscribe` a copia para a lista salva.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Zustand 4 (persist), Tailwind 3, lucide-react, Vitest 2 + jsdom + Testing Library. Nenhuma dependência nova.

**Spec:** não há documento separado. Fonte: pedido do usuário em 2026-10-01 ("estender o que o agente consegue fazer; os dados são todos locais, então ele pode configurar tudo; deixar no canto inferior direito; salvar os chats; ao clicar abre o chat relevante; ao interagir com dados de outra página, redirecionar"). Decisões de design tomadas neste plano:

- **Onde o chat aparece.** No Dashboard o chat continua ancorado ao lado da carteira (layout atual). Em todas as outras páginas aparece um botão flutuante no canto inferior direito que abre o mesmo chat num painel flutuante. Só uma instância do chat fica montada por vez.
- **"Chat relevante".** Cada conversa guarda a página em que foi usada por último. Clicar no botão flutuante abre a conversa mais recente daquela página; se não houver, começa uma nova. Um menu "Conversas" lista todas e permite trocar ou apagar.
- **Redirecionamento.** (a) O modelo pode chamar `navigate`. (b) Ao confirmar uma proposta, o app vai para a página dona daqueles dados. Em ambos os casos, fora do Dashboard o painel flutuante abre sozinho com a mesma conversa.
- **Fora do escopo:** listas personalizadas (`customLists`, sem UI hoje), ativos do exterior do módulo de IR (estado local não salvo), edição de `historicalTransactions`, troca de modelo/chave pelo agente, conversas no backup JSON.

## Global Constraints

- Nada é salvo sem confirmação do usuário no cartão de prévia. Exceções explícitas: `navigate` (trocar de página e de carteira exibida) tem efeito imediato.
- A chave do OpenRouter nunca aparece em resultado de ferramenta, em conversa salva nem no backup.
- Persistência das conversas: `localStorage`, chave `chat-conversations`. Máximo de 30 conversas (as mais recentes). Falha ao gravar (cota) não pode quebrar o chat.
- Categorias embutidas (`Ações`, `FIIs`, `Renda Fixa`, `Tesouro Direto`) e todas as regras do `propose_changes` existente não mudam.
- Interface e mensagens em português do Brasil. Identificadores de código em inglês.
- IDs de página (valores de `activeTab`), exatos: `dashboard`, `strategy`, `projection`, `plano-mensal`, `preco-medio`, `imposto-renda`, `financiamento`, `history`, `data-management`.
- Verificação de cada tarefa: `npm test` e `npm run build`. `npm run lint` **não** funciona neste repo; não use.
- O `tsc` do build cobre `src/**`, inclusive testes, com `noUnusedLocals` e `noUnusedParameters`. Não deixe import ou variável sem uso.
- Testes existentes continuam passando; quando uma fixture de `ToolContext` precisar dos campos novos, atualize a fixture, não afrouxe o tipo.
- Commits no branch `feat/agent-global-chat`, um por tarefa, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Dados mudaram entre a prévia e o Confirmar** (item do plano mensal removido à mão, carteira excluída, proposta salva de uma sessão anterior): a proposta de configuração é reexecutada sobre o estado atual; se falhar, o cartão mostra o erro e nada é gravado. Teste na Task 4.
2. **Modelo manda valores malformados** (`"1.234,56"` como string, campo desconhecido em `params`, metas que não somam 100, prazo fracionado): vira erro devolvido ao modelo, sem prévia e sem exceção. Testes na Task 2 e Task 4.
3. **`localStorage` cheio ou indisponível** ao salvar conversas: a mensagem é enviada e respondida normalmente; só a gravação é perdida. Teste na Task 6.
4. **Trocar de conversa com resposta pendente**: o clique no botão flutuante não troca de conversa enquanto `typing` for verdadeiro; trocar pelo menu descarta a resposta atrasada em vez de colá-la na conversa errada. Testes na Task 6.
5. **Excluir a única carteira / excluir a carteira ativa pelo agente**: a única carteira não pode ser excluída; excluir a ativa passa a exibir a primeira restante. Testes na Task 2.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/domain/pages.ts` (novo) | Registro das páginas: id, rótulo, descrição. |
| `src/domain/settingsOperations.ts` (novo) | Tipos `SettingsSnapshot`/`SettingsOperation`, validação e aplicação pura, linhas de prévia, página dona de cada operação. |
| `src/store/useProjectionStore.ts` (novo) | Parâmetros da Projeção, persistidos. |
| `src/chat/appState.ts` (novo) | Cola: lê os stores para um `SettingsSnapshot` e grava de volta. |
| `src/chat/conversations.ts` (novo) | Funções puras das conversas salvas (título, salvar, escolher a relevante, enxugar para o disco). |
| `src/chat/tools.ts` | Ferramentas novas: `navigate`, `get_app_data`, `propose_settings`; `portfolio` opcional em `propose_changes`. |
| `src/chat/agent.ts`, `src/chat/systemPrompt.ts` | Contexto por chamada de ferramenta; prompt com a página atual e as regras novas. |
| `src/store/useChatStore.ts` | `goTo`, confirmação de propostas de configuração, conversas persistidas, estado do painel. |
| `src/components/home/ProposalCard.tsx` | Linhas "antes → depois" para propostas de configuração. |
| `src/components/home/ChatPanel.tsx` | Variante flutuante, botão fechar, menu de conversas. |
| `src/components/home/ConversationMenu.tsx` (novo) | Lista de conversas salvas. |
| `src/components/home/FloatingChat.tsx` (novo) | Botão flutuante + painel. |
| `src/App.tsx`, `src/components/Projection.tsx`, `src/components/DataManagement.tsx` | Montagem e integrações pontuais. |

---

### Task 1: Registro de páginas e ferramenta `navigate`

**Files:**
- Create: `src/domain/pages.ts`, `src/domain/pages.test.ts`
- Modify: `src/chat/tools.ts`, `src/chat/agent.ts`, `src/chat/systemPrompt.ts`, `src/store/useChatStore.ts`
- Test: `src/chat/tools.test.ts`, `src/chat/agent.test.ts`, `src/store/useChatStore.test.ts`

**Interfaces:**
- Produces:
  - `PAGES`, `type PageId`, `isPageId(value: unknown): value is PageId`, `pageLabel(id: string): string` em `src/domain/pages.ts`
  - `ToolContext` ganha `currentPage: PageId`, `navigate: (page: PageId) => void`, `selectPortfolio: (portfolioId: string) => void`
  - `buildSystemPrompt(page: PageId): string` em `src/chat/systemPrompt.ts`
  - `AgentTurnInput.toolContext: ToolContext | (() => ToolContext)`
  - `useChatStore.getState().goTo(page: PageId): void`

- [ ] **Step 1: Criar `src/domain/pages.ts`**

```ts
export const PAGES = [
  { id: 'dashboard', label: 'Dashboard', about: 'carteira, ativos, categorias e gráfico de alocação' },
  { id: 'strategy', label: 'Estratégia', about: 'metas de alocação, texto da estratégia, valor do aporte e rebalanceamento' },
  { id: 'projection', label: 'Projeção', about: 'simulação de juros compostos (aporte mensal, taxa anual, anos)' },
  { id: 'plano-mensal', label: 'Plano Mensal', about: 'receitas, despesas e categorias do orçamento mensal' },
  { id: 'preco-medio', label: 'Preço Médio', about: 'cálculo de preço médio a partir das negociações da B3' },
  { id: 'imposto-renda', label: 'Imposto de Renda', about: 'apoio à declaração com base nas negociações importadas' },
  { id: 'financiamento', label: 'Financiamento', about: 'simulador de financiamento imobiliário e amortizações extras' },
  { id: 'history', label: 'Histórico', about: 'fechamentos mensais salvos do plano mensal' },
  { id: 'data-management', label: 'Menu de Dados', about: 'backup, restauração e limpeza dos dados locais' },
] as const

export type PageId = (typeof PAGES)[number]['id']

export const isPageId = (value: unknown): value is PageId => PAGES.some((page) => page.id === value)

export const pageLabel = (id: string): string => PAGES.find((page) => page.id === id)?.label ?? id
```

- [ ] **Step 2: Testes de `pages` (`src/domain/pages.test.ts`)**

```ts
import { describe, expect, it } from 'vitest'
import { PAGES, isPageId, pageLabel } from './pages'

describe('pages', () => {
  it('lists every tab the app renders', () => {
    expect(PAGES.map((p) => p.id)).toEqual([
      'dashboard', 'strategy', 'projection', 'plano-mensal', 'preco-medio',
      'imposto-renda', 'financiamento', 'history', 'data-management',
    ])
  })
  it('recognises page ids and falls back to the raw id for labels', () => {
    expect(isPageId('financiamento')).toBe(true)
    expect(isPageId('nope')).toBe(false)
    expect(isPageId(undefined)).toBe(false)
    expect(pageLabel('plano-mensal')).toBe('Plano Mensal')
    expect(pageLabel('nope')).toBe('nope')
  })
})
```

- [ ] **Step 3: Testes que falham para `navigate` (acrescentar em `src/chat/tools.test.ts`)**

Primeiro atualize a fixture `context()` desse arquivo (e a `toolContext()` de `src/chat/agent.test.ts`) acrescentando `currentPage: 'dashboard'`, `navigate: vi.fn()`, `selectPortfolio: vi.fn()`. Troque o teste "exposes exactly the read tool and the proposal tool" para esperar `['get_portfolio', 'propose_changes', 'navigate']`.

```ts
describe('executeTool — navigate', () => {
  it('navigates to a known page', () => {
    const ctx = context()
    const result = executeTool('navigate', '{"page":"financiamento"}', ctx)
    expect(ctx.navigate).toHaveBeenCalledWith('financiamento')
    expect(ctx.selectPortfolio).not.toHaveBeenCalled()
    expect(JSON.parse(result.content)).toEqual({ ok: true, page: 'financiamento', label: 'Financiamento' })
  })
  it('switches the displayed portfolio by name, case-insensitively, and accepts "todas"', () => {
    const ctx = context()
    executeTool('navigate', '{"page":"dashboard","portfolio":"carteira principal"}', ctx)
    expect(ctx.selectPortfolio).toHaveBeenCalledWith('p1')
    executeTool('navigate', '{"page":"dashboard","portfolio":"Todas"}', ctx)
    expect(ctx.selectPortfolio).toHaveBeenLastCalledWith('all')
  })
  it('rejects unknown pages and portfolios without side effects', () => {
    const ctx = context()
    expect(JSON.parse(executeTool('navigate', '{"page":"lua"}', ctx).content).ok).toBe(false)
    const bad = JSON.parse(executeTool('navigate', '{"page":"dashboard","portfolio":"Inexistente"}', ctx).content)
    expect(bad).toEqual({ ok: false, errors: ['Carteira "Inexistente" não encontrada.'] })
    expect(ctx.navigate).not.toHaveBeenCalled()
    expect(ctx.selectPortfolio).not.toHaveBeenCalled()
  })
})
```

Run: `npx vitest run src/chat/tools.test.ts` — Expected: FAIL (ferramenta desconhecida / campos faltando).

- [ ] **Step 4: Implementar em `src/chat/tools.ts`**

Imports: `import { PAGES, isPageId, pageLabel, type PageId } from '../domain/pages'`. Acrescente a `ToolContext`:

```ts
  currentPage: PageId
  navigate: (page: PageId) => void
  selectPortfolio: (portfolioId: string) => void
```

Acrescente a `TOOL_DEFINITIONS` (depois de `propose_changes`):

```ts
  {
    type: 'function',
    function: {
      name: 'navigate',
      description:
        'Leva o usuário para outra página do app e, se informado, troca a carteira exibida. Use quando o assunto ou a alteração pertence a outra página. Efeito imediato, sem confirmação.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: PAGES.map((page) => page.id),
            description: PAGES.map((page) => `${page.id}: ${page.about}`).join('; '),
          },
          portfolio: {
            type: 'string',
            description: 'Opcional: nome da carteira a exibir, ou "todas" para a visão consolidada.',
          },
        },
        required: ['page'],
      },
    },
  },
```

Função e despacho:

```ts
function navigateTo(args: any, context: ToolContext): ToolResult {
  if (!isPageId(args?.page)) {
    return failure([`Página desconhecida: "${String(args?.page)}". Use uma de: ${PAGES.map((p) => p.id).join(', ')}.`])
  }
  const wanted = text(args?.portfolio)
  let portfolioId: string | undefined
  let portfolioName: string | undefined
  if (wanted) {
    if (['todas', 'all'].includes(wanted.toLowerCase())) {
      portfolioId = 'all'
      portfolioName = 'Todas as carteiras'
    } else {
      const found = context.workspace.portfolios.find((p) => p.name.trim().toLowerCase() === wanted.toLowerCase())
      if (!found) return failure([`Carteira "${wanted}" não encontrada.`])
      portfolioId = found.id
      portfolioName = found.name
    }
  }
  if (portfolioId) context.selectPortfolio(portfolioId)
  context.navigate(args.page)
  return {
    content: JSON.stringify({
      ok: true,
      page: args.page,
      label: pageLabel(args.page),
      ...(portfolioName ? { portfolio: portfolioName } : {}),
    }),
  }
}
```

Em `executeTool`: `if (name === 'navigate') return navigateTo(args, context)`.

- [ ] **Step 5: Prompt com a página atual (`src/chat/systemPrompt.ts`)**

Acrescente ao fim do texto de `SYSTEM_PROMPT` a regra:

```
12. O app tem várias páginas. Use navigate para levar o usuário à página do assunto quando ele pedir para ver algo ou quando a conversa mudar para dados de outra página. Não navegue sem motivo.
```

E exporte:

```ts
import { PAGES, pageLabel, type PageId } from '../domain/pages'

export const buildSystemPrompt = (page: PageId): string =>
  `${SYSTEM_PROMPT}\n\nPáginas do app: ${PAGES.map((p) => `${p.id} (${p.label}: ${p.about})`).join('; ')}.\nO usuário está agora na página "${pageLabel(page)}" (${page}).`
```

- [ ] **Step 6: Contexto por chamada em `src/chat/agent.ts`**

`AgentTurnInput.toolContext` passa a ser `ToolContext | (() => ToolContext)`. Dentro de `runAgentTurn`:

```ts
  const resolveContext = (): ToolContext => (typeof toolContext === 'function' ? toolContext() : toolContext)
```

No laço, o system prompt vira `buildSystemPrompt(resolveContext().currentPage)` (no lugar de `SYSTEM_PROMPT`) e a execução vira `executeTool(name, toolCall.function.arguments ?? '', resolveContext())`. Assim, depois de um `navigate` que troca de carteira, o `get_portfolio` seguinte já vê a carteira nova.

Em `src/chat/agent.test.ts`, troque a expectativa `{ role: 'system', content: SYSTEM_PROMPT }` por `{ role: 'system', content: buildSystemPrompt('dashboard') }` e acrescente:

```ts
  it('resolves a tool-context factory again for every tool call', async () => {
    const factory = vi.fn(toolContext)
    const complete = scripted(
      { role: 'assistant', content: null, tool_calls: [call('c1', 'get_portfolio', {}), call('c2', 'get_portfolio', {})] },
      { role: 'assistant', content: 'ok' },
    )
    await runAgentTurn({ ...base, toolContext: factory, complete })
    expect(factory.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
```

- [ ] **Step 7: `goTo` e contexto no `src/store/useChatStore.ts`**

Na interface `ChatStore`: `goTo: (page: PageId) => void`. Implementação:

```ts
    goTo: (page) => useInvestmentStore.getState().setActiveTab(page),
```

Em `buildToolContext`, acrescente:

```ts
    currentPage: isPageId(state.activeTab) ? state.activeTab : 'dashboard',
    navigate: (page) => useChatStore.getState().goTo(page),
    selectPortfolio: (id) => useInvestmentStore.getState().setActivePortfolio(id),
```

Em `sendMessage`, passe a fábrica: `toolContext: buildToolContext` (sem os parênteses). Ajuste o teste existente que verifica o argumento de `runTurn` se ele comparar `toolContext` por valor.

Teste novo em `src/store/useChatStore.test.ts`:

```ts
describe('buildToolContext — navigation', () => {
  it('reports the current page and navigates through the store', () => {
    invest().setActiveTab('history')
    const ctx = buildToolContext()
    expect(ctx.currentPage).toBe('history')
    ctx.navigate('financiamento')
    expect(invest().activeTab).toBe('financiamento')
    ctx.selectPortfolio('all')
    expect(invest().activePortfolioId).toBe('all')
  })
})
```

- [ ] **Step 8: Verificar e commitar**

Run: `npm test && npm run build` — Expected: tudo passa.

```bash
git add -A && git commit -m "feat: page registry and navigate tool for the assistant"
```

---

### Task 2: Operações de configuração (domínio puro)

**Files:**
- Create: `src/domain/settingsOperations.ts`
- Test: `src/domain/settingsOperations.test.ts`

**Interfaces:**
- Consumes: `PageId` de `src/domain/pages.ts`; `Portfolio`, `MonthlyPlan`, `MonthlyItem`, `createEmptyPortfolioData` de `src/store/useInvestmentStore`; `FinancingParameters`, `ExtraAmortizationConfig` de `src/types/financing`; `FINANCING_PRESETS` de `src/store/useFinancingStore`; `brl`, `num` de `src/lib/format`.
- Produces (tudo exportado de `src/domain/settingsOperations.ts`):

```ts
export interface ProjectionParams { monthlyContribution: number; annualRate: number; years: number }
export interface AllocationTargets { fiis: number; acoes: number; renda_fixa: number }

export interface SettingsSnapshot {
  portfolios: Portfolio[]
  activePortfolioId: string
  settings: { estrategia: string; alvos: AllocationTargets }
  contributionAmount: number
  monthlyPlan: MonthlyPlan
  financing: { params: FinancingParameters; extraConfig: ExtraAmortizationConfig; selectedPresetId: string | null }
  projection: ProjectionParams
}

export const SETTINGS_OPERATION_TYPES = [
  'create_portfolio', 'rename_portfolio', 'delete_portfolio',
  'set_allocation_targets', 'set_strategy_text', 'set_contribution',
  'add_monthly_item', 'update_monthly_item', 'remove_monthly_item', 'add_monthly_category',
  'update_financing', 'apply_financing_preset', 'update_extra_amortization', 'add_lump_sum', 'remove_lump_sum',
  'set_projection',
] as const
export type SettingsOperationType = (typeof SETTINGS_OPERATION_TYPES)[number]

/** Vem do modelo: só `type` é garantido; cada campo é validado ao aplicar. */
export interface SettingsOperation { type: SettingsOperationType; [field: string]: unknown }

export interface SettingsPreviewRow { label: string; before?: string; after?: string; mode: 'criar' | 'alterar' | 'remover' }

export interface SettingsRunResult { snapshot: SettingsSnapshot; errors: string[]; rows: SettingsPreviewRow[] }

export function runSettingsOperations(
  snapshot: SettingsSnapshot,
  operations: SettingsOperation[],
  createId?: () => string, // padrão: crypto.randomUUID
): SettingsRunResult

export function pageOfOperations(operations: SettingsOperation[]): PageId // página da última operação
```

Campos de cada operação e regras (mensagens exatas entre aspas; `{…}` é interpolação):

| type | campos | regras e erro | página |
|---|---|---|---|
| `create_portfolio` | `name` | vazio → "Nome da carteira vazio."; já existe (sem diferenciar maiúsculas) → "A carteira \"{name}\" já existe."; a nova vira a ativa | `dashboard` |
| `rename_portfolio` | `portfolio`, `name` | não achou → "Carteira \"{portfolio}\" não encontrada."; nome novo vazio ou já usado → mesmos erros de cima | `dashboard` |
| `delete_portfolio` | `portfolio` | não achou → idem; só existe uma → "Não é possível excluir a única carteira."; se era a ativa, a ativa passa a ser a primeira restante | `dashboard` |
| `set_allocation_targets` | `fiis`, `acoes`, `renda_fixa` | cada um número finito 0–100, senão "Metas inválidas: informe fiis, acoes e renda_fixa como números entre 0 e 100."; soma fora de 100 ± 0,1 → "As metas precisam somar 100% (soma atual: {soma})." | `strategy` |
| `set_strategy_text` | `text` | não é string ou > 5000 caracteres → "Texto da estratégia inválido." | `strategy` |
| `set_contribution` | `amount` | número finito ≥ 0, senão "Valor do aporte inválido." | `strategy` |
| `add_monthly_item` | `kind` (`income`\|`expense`), `name`, `value`, `category?` | kind inválido → "Informe kind como \"income\" (receita) ou \"expense\" (despesa)."; nome vazio → "Nome do item vazio."; `value` não é número finito > 0 → "Valor inválido para {name}."; já existe item com o nome naquele tipo → "Já existe uma {receita\|despesa} chamada \"{name}\"; use update_monthly_item para alterá-la."; categoria vazia vira `Outros`; categoria nova é acrescentada a `monthlyPlan.categories` | `plano-mensal` |
| `update_monthly_item` | `kind`, `name`, `newName?`, `value?`, `category?` | não achou → "Não existe {receita\|despesa} chamada \"{name}\"."; mais de um com o nome → "Há mais de um item chamado \"{name}\"; ajuste direto no Plano Mensal."; nenhum campo para mudar → "Nada a alterar em {name}."; valida `value` e `newName` como no add | `plano-mensal` |
| `remove_monthly_item` | `kind`, `name` | mesmos erros de localizar | `plano-mensal` |
| `add_monthly_category` | `name` | vazio → "Nome de categoria vazio."; já existe → "A categoria \"{name}\" já existe no plano mensal." | `plano-mensal` |
| `update_financing` | `params` (objeto parcial) | ver "Campos do financiamento"; ao final, `downPayment >= propertyValue` → "A entrada precisa ser menor que o valor do imóvel."; zera `selectedPresetId` | `financiamento` |
| `apply_financing_preset` | `presetId` | desconhecido → "Preset desconhecido: \"{id}\". Use um de: {ids}."; aplica como `applyPreset` do store | `financiamento` |
| `update_extra_amortization` | `config` (objeto parcial, sem `lumpSums`) | ver "Campos da amortização extra"; ao final `periodStartMonth > periodEndMonth` → "O mês inicial precisa ser menor ou igual ao mês final." | `financiamento` |
| `add_lump_sum` | `month`, `amount`, `recalculation?`, `description?` | `month` inteiro 1–480, senão "Mês inválido para o aporte avulso."; `amount` número finito > 0, senão "Valor inválido para o aporte avulso."; `recalculation` padrão `prazo`, outro valor → "recalculation: use \"prazo\" ou \"parcela\"."; `description` padrão "Aporte avulso" | `financiamento` |
| `remove_lump_sum` | `month` | nenhum aporte naquele mês → "Não há aporte avulso no mês {month}."; remove todos daquele mês | `financiamento` |
| `set_projection` | `monthlyContribution?`, `annualRate?`, `years?` | ver "Campos da projeção" | `projection` |

Campos validados por tabela (campo desconhecido → `Campo desconhecido em {o quê}: "{campo}".`; objeto ausente/vazio → `Informe os campos de {o quê} a alterar.`; nenhum valor diferente do atual → `Nada a alterar em {o quê}: os valores já são esses.`):

- **Campos do financiamento** (`o quê` = "financiamento"). Números `[mín, máx]`: `propertyValue` [1, 1e9] "Valor do imóvel"; `appraisalValue` [1, 1e9] "Valor de avaliação"; `downPayment` [0, 1e9] "Entrada"; `termMonths` [12, 480] inteiro "Prazo (meses)"; `annualInterestRateNominal` [0, 100] "Juros nominais (% a.a.)"; `monthlyIndexerRate` [0, 10] "Indexador (% a.m.)"; `itbiPercent` [0, 20] "ITBI (%)"; `registryFeePercent` [0, 20] "Cartório (%)"; `appraisalFeeFixed` [0, 1e6] "Tarifa de avaliação"; `borrowerAge` [18, 80] inteiro "Idade do proponente"; `dfiMonthlyRate` [0, 5] "DFI (% a.m.)"; `tcaMonthlyFixed` [0, 1e4] "Tarifa de administração"; `customMipRate` [0, 5] "MIP personalizado (% a.m.)"; `monthlyGrossIncome` [0, 1e9] "Renda bruta mensal". Booleanos: `useCustomAppraisal` "Avaliação diferente da compra"; `financeInitialExpenses` "Financiar custas iniciais"; `applySFHDiscount` "Desconto SFH em cartório"; `useCustomMipRate` "Usar MIP personalizado". Enums: `amortizationType` (`SAC`, `PRICE`) "Sistema de amortização"; `indexerType` (`TR`, `IPCA`, `POUPANCA`, `PREFIXADO`) "Indexador".
- **Campos da amortização extra** (`o quê` = "amortização extra"): `enabled` booleano "Amortização extra ativa"; `mode` enum (`constant`, `target_installment`, `time_period`, `lump_sum`) "Modo de amortização"; `recalculation` enum (`prazo`, `parcela`) "Recalcular"; `monthlyAmount` [0, 1e9] "Aporte mensal extra"; `targetInstallment` [0, 1e9] "Parcela alvo"; `periodStartMonth` [1, 480] inteiro "Mês inicial"; `periodEndMonth` [1, 480] inteiro "Mês final".
- **Campos da projeção** (`o quê` = "projeção"): `monthlyContribution` [0, 1e9] "Aporte mensal"; `annualRate` [0, 100] "Taxa anual (%)"; `years` [1, 60] inteiro "Anos".

Erros de campo: número → `{rótulo}: valor inválido ({valor}); use um número{ inteiro} entre {mín} e {máx}.`; booleano → `{rótulo}: use true ou false.`; enum → `{rótulo}: use um de {valores separados por ", "}.`

Erros agregados por `runSettingsOperations` no formato `Operação {n} ({type}): {mensagem}` (igual a `runOperations`). Tipo fora de `SETTINGS_OPERATION_TYPES` → `Tipo de operação desconhecido.` Operações com erro não alteram o snapshot acumulado; as seguintes continuam sendo avaliadas.

Linhas de prévia: uma por valor alterado. Formatação: booleano → `sim`/`não`; número → `num(valor)`; dinheiro do plano mensal, aporte e carteira → `brl(valor)`; texto da estratégia cortado em 60 caracteres com `…`. Exemplos: `{ label: 'Carteira Viagem', after: 'vazia', mode: 'criar' }`; `{ label: 'Carteira Viagem', before: '3 ativos · R$ 1.200,00', mode: 'remover' }`; `{ label: 'Meta FIIs', before: '33,3%', after: '40%', mode: 'alterar' }` (rótulos `Meta FIIs`, `Meta Ações`, `Meta Renda Fixa`, valores como `num(v) + '%'`); `{ label: 'Despesa Aluguel', after: 'R$ 2.000,00 · Moradia', mode: 'criar' }`; `{ label: 'Prazo (meses)', before: '360', after: '300', mode: 'alterar' }`; `{ label: 'Aporte avulso mês 12', after: 'R$ 10.000,00 · prazo', mode: 'criar' }`; `{ label: 'Preset de financiamento', after: 'Tabela Price (Banco Privado)', mode: 'alterar' }`.

- [ ] **Step 1: Escrever os testes (`src/domain/settingsOperations.test.ts`)**

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyPortfolioData, type Portfolio } from '../store/useInvestmentStore'
import type { ExtraAmortizationConfig, FinancingParameters } from '../types/financing'
import { pageOfOperations, runSettingsOperations, type SettingsOperation, type SettingsSnapshot } from './settingsOperations'

const portfolio = (id: string, name: string): Portfolio => ({
  id, name, color: '#6366f1', data: createEmptyPortfolioData(),
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})

const params: FinancingParameters = {
  propertyValue: 500000, appraisalValue: 500000, useCustomAppraisal: false, downPayment: 100000, termMonths: 360,
  annualInterestRateNominal: 10, amortizationType: 'SAC', indexerType: 'TR', monthlyIndexerRate: 0.08,
  financeInitialExpenses: false, itbiPercent: 3, registryFeePercent: 1, appraisalFeeFixed: 3500, applySFHDiscount: true,
  borrowerAge: 32, dfiMonthlyRate: 0.01, tcaMonthlyFixed: 25, useCustomMipRate: false, customMipRate: 0.028,
  monthlyGrossIncome: 16000,
}
const extraConfig: ExtraAmortizationConfig = {
  enabled: false, mode: 'constant', recalculation: 'prazo', monthlyAmount: 1500, targetInstallment: 2000,
  periodStartMonth: 1, periodEndMonth: 60, lumpSums: [],
}

const snapshot = (overrides: Partial<SettingsSnapshot> = {}): SettingsSnapshot => ({
  portfolios: [portfolio('p1', 'Carteira Principal'), portfolio('p2', 'Viagem')],
  activePortfolioId: 'p1',
  settings: { estrategia: '', alvos: { fiis: 33.3, acoes: 33.3, renda_fixa: 33.4 } },
  contributionAmount: 1000,
  monthlyPlan: {
    incomes: [{ id: 'i1', name: 'Salário', value: 8000, category: 'Salário' }],
    expenses: [{ id: 'e1', name: 'Aluguel', value: 2000, category: 'Aluguel' }],
    categories: ['Salário', 'Aluguel', 'Outros'],
  },
  financing: { params, extraConfig, selectedPresetId: 'sfh_caixa_sac' },
  projection: { monthlyContribution: 1000, annualRate: 10, years: 10 },
  ...overrides,
})

const run = (ops: SettingsOperation[], base = snapshot()) => runSettingsOperations(base, ops, () => 'new-id')
const firstError = (ops: SettingsOperation[], base = snapshot()) => run(ops, base).errors[0]

describe('portfolios', () => {
  it('creates a portfolio and makes it the active one', () => {
    const { snapshot: next, errors, rows } = run([{ type: 'create_portfolio', name: ' Cripto ' }])
    expect(errors).toEqual([])
    expect(next.portfolios.map((p) => [p.id, p.name])).toContainEqual(['new-id', 'Cripto'])
    expect(next.activePortfolioId).toBe('new-id')
    expect(rows).toEqual([{ label: 'Carteira Cripto', after: 'vazia', mode: 'criar' }])
  })
  it('rejects empty and duplicate names', () => {
    expect(firstError([{ type: 'create_portfolio', name: ' ' }])).toBe('Operação 1 (create_portfolio): Nome da carteira vazio.')
    expect(firstError([{ type: 'create_portfolio', name: 'viagem' }])).toBe('Operação 1 (create_portfolio): A carteira "viagem" já existe.')
  })
  it('renames by current name', () => {
    const { snapshot: next, rows } = run([{ type: 'rename_portfolio', portfolio: 'viagem', name: 'Férias' }])
    expect(next.portfolios[1].name).toBe('Férias')
    expect(rows).toEqual([{ label: 'Carteira', before: 'Viagem', after: 'Férias', mode: 'alterar' }])
  })
  it('deletes a portfolio and moves the active view off it', () => {
    const { snapshot: next, rows } = run([{ type: 'delete_portfolio', portfolio: 'Carteira Principal' }])
    expect(next.portfolios.map((p) => p.id)).toEqual(['p2'])
    expect(next.activePortfolioId).toBe('p2')
    expect(rows[0]).toMatchObject({ label: 'Carteira Carteira Principal', mode: 'remover' })
  })
  it('keeps the consolidated view when deleting under "all"', () => {
    const { snapshot: next } = run([{ type: 'delete_portfolio', portfolio: 'Viagem' }], snapshot({ activePortfolioId: 'all' }))
    expect(next.activePortfolioId).toBe('all')
  })
  it('refuses to delete the only portfolio or an unknown one', () => {
    const one = snapshot({ portfolios: [portfolio('p1', 'Carteira Principal')] })
    expect(firstError([{ type: 'delete_portfolio', portfolio: 'Carteira Principal' }], one)).toBe(
      'Operação 1 (delete_portfolio): Não é possível excluir a única carteira.',
    )
    expect(firstError([{ type: 'delete_portfolio', portfolio: 'X' }])).toBe('Operação 1 (delete_portfolio): Carteira "X" não encontrada.')
  })
})

describe('strategy', () => {
  it('sets targets that add up to 100', () => {
    const { snapshot: next, rows } = run([{ type: 'set_allocation_targets', fiis: 40, acoes: 40, renda_fixa: 20 }])
    expect(next.settings.alvos).toEqual({ fiis: 40, acoes: 40, renda_fixa: 20 })
    expect(rows).toContainEqual({ label: 'Meta FIIs', before: '33,3%', after: '40%', mode: 'alterar' })
    expect(rows).toHaveLength(3)
  })
  it('rejects targets that do not add up or are not numbers', () => {
    expect(firstError([{ type: 'set_allocation_targets', fiis: 50, acoes: 40, renda_fixa: 20 }])).toBe(
      'Operação 1 (set_allocation_targets): As metas precisam somar 100% (soma atual: 110).',
    )
    expect(firstError([{ type: 'set_allocation_targets', fiis: '40', acoes: 40, renda_fixa: 20 }])).toMatch(/Metas inválidas/)
  })
  it('sets the strategy text and the contribution', () => {
    const { snapshot: next, errors } = run([
      { type: 'set_strategy_text', text: 'Foco em dividendos' },
      { type: 'set_contribution', amount: 2500 },
    ])
    expect(errors).toEqual([])
    expect(next.settings.estrategia).toBe('Foco em dividendos')
    expect(next.contributionAmount).toBe(2500)
  })
  it('rejects a contribution sent as a formatted string', () => {
    expect(firstError([{ type: 'set_contribution', amount: '1.234,56' }])).toBe('Operação 1 (set_contribution): Valor do aporte inválido.')
  })
})

describe('monthly plan', () => {
  it('adds an item, creating its category when needed', () => {
    const { snapshot: next, rows } = run([{ type: 'add_monthly_item', kind: 'expense', name: 'Academia', value: 120, category: 'Saúde' }])
    expect(next.monthlyPlan.expenses).toContainEqual({ id: 'new-id', name: 'Academia', value: 120, category: 'Saúde' })
    expect(next.monthlyPlan.categories).toContain('Saúde')
    expect(rows).toContainEqual({ label: 'Despesa Academia', after: 'R$ 120,00 · Saúde', mode: 'criar' })
  })
  it('defaults the category to Outros and rejects duplicates and bad values', () => {
    expect(run([{ type: 'add_monthly_item', kind: 'income', name: 'Freela', value: 500 }]).snapshot.monthlyPlan.incomes[1].category).toBe('Outros')
    expect(firstError([{ type: 'add_monthly_item', kind: 'expense', name: 'aluguel', value: 10 }])).toMatch(/Já existe uma despesa chamada "aluguel"/)
    expect(firstError([{ type: 'add_monthly_item', kind: 'expense', name: 'Luz', value: -1 }])).toBe('Operação 1 (add_monthly_item): Valor inválido para Luz.')
    expect(firstError([{ type: 'add_monthly_item', kind: 'x', name: 'Luz', value: 1 }])).toMatch(/Informe kind/)
  })
  it('updates and removes an item by name', () => {
    const { snapshot: next, errors } = run([
      { type: 'update_monthly_item', kind: 'expense', name: 'aluguel', value: 2300 },
      { type: 'remove_monthly_item', kind: 'income', name: 'Salário' },
    ])
    expect(errors).toEqual([])
    expect(next.monthlyPlan.expenses[0]).toMatchObject({ id: 'e1', name: 'Aluguel', value: 2300 })
    expect(next.monthlyPlan.incomes).toEqual([])
  })
  it('reports missing and ambiguous items', () => {
    expect(firstError([{ type: 'remove_monthly_item', kind: 'expense', name: 'Luz' }])).toBe(
      'Operação 1 (remove_monthly_item): Não existe despesa chamada "Luz".',
    )
    const twice = snapshot()
    twice.monthlyPlan.expenses.push({ id: 'e2', name: 'Aluguel', value: 1, category: 'Outros' })
    expect(firstError([{ type: 'update_monthly_item', kind: 'expense', name: 'Aluguel', value: 5 }], twice)).toMatch(/Há mais de um item/)
  })
  it('adds a category once', () => {
    expect(run([{ type: 'add_monthly_category', name: 'Pets' }]).snapshot.monthlyPlan.categories).toContain('Pets')
    expect(firstError([{ type: 'add_monthly_category', name: 'outros' }])).toMatch(/já existe no plano mensal/)
  })
})

describe('financing', () => {
  it('patches parameters, clears the preset and previews each change', () => {
    const { snapshot: next, rows, errors } = run([{ type: 'update_financing', params: { termMonths: 300, amortizationType: 'PRICE', applySFHDiscount: false } }])
    expect(errors).toEqual([])
    expect(next.financing.params).toMatchObject({ termMonths: 300, amortizationType: 'PRICE', applySFHDiscount: false, propertyValue: 500000 })
    expect(next.financing.selectedPresetId).toBeNull()
    expect(rows).toEqual([
      { label: 'Prazo (meses)', before: '360', after: '300', mode: 'alterar' },
      { label: 'Sistema de amortização', before: 'SAC', after: 'PRICE', mode: 'alterar' },
      { label: 'Desconto SFH em cartório', before: 'sim', after: 'não', mode: 'alterar' },
    ])
  })
  it('rejects unknown fields, out-of-range, fractional and string values', () => {
    expect(firstError([{ type: 'update_financing', params: { foo: 1 } }])).toBe('Operação 1 (update_financing): Campo desconhecido em financiamento: "foo".')
    expect(firstError([{ type: 'update_financing', params: { termMonths: 360.5 } }])).toMatch(/Prazo \(meses\): valor inválido \(360.5\); use um número inteiro entre 12 e 480\./)
    expect(firstError([{ type: 'update_financing', params: { propertyValue: '600.000,00' } }])).toMatch(/Valor do imóvel: valor inválido/)
    expect(firstError([{ type: 'update_financing', params: { indexerType: 'CDI' } }])).toMatch(/Indexador: use um de TR, IPCA, POUPANCA, PREFIXADO\./)
    expect(firstError([{ type: 'update_financing', params: { useCustomMipRate: 'yes' } }])).toMatch(/use true ou false/)
    expect(firstError([{ type: 'update_financing' }])).toMatch(/Informe os campos de financiamento a alterar\./)
    expect(firstError([{ type: 'update_financing', params: { termMonths: 360 } }])).toMatch(/Nada a alterar em financiamento/)
  })
  it('requires the down payment to stay below the property value', () => {
    expect(firstError([{ type: 'update_financing', params: { downPayment: 500000 } }])).toMatch(/A entrada precisa ser menor que o valor do imóvel\./)
  })
  it('applies a preset', () => {
    const { snapshot: next, rows } = run([{ type: 'apply_financing_preset', presetId: 'price_banco_privado' }])
    expect(next.financing.selectedPresetId).toBe('price_banco_privado')
    expect(next.financing.params).toMatchObject({ propertyValue: 600000, amortizationType: 'PRICE' })
    expect(rows).toEqual([{ label: 'Preset de financiamento', after: 'Tabela Price (Banco Privado)', mode: 'alterar' }])
    expect(firstError([{ type: 'apply_financing_preset', presetId: 'x' }])).toMatch(/Preset desconhecido: "x"/)
  })
  it('patches the extra amortization config and guards the period', () => {
    const { snapshot: next } = run([{ type: 'update_extra_amortization', config: { enabled: true, monthlyAmount: 2000 } }])
    expect(next.financing.extraConfig).toMatchObject({ enabled: true, monthlyAmount: 2000, lumpSums: [] })
    expect(firstError([{ type: 'update_extra_amortization', config: { periodStartMonth: 80 } }])).toMatch(/mês inicial precisa ser menor ou igual/)
    expect(firstError([{ type: 'update_extra_amortization', config: { lumpSums: [] } }])).toMatch(/Campo desconhecido em amortização extra: "lumpSums"/)
  })
  it('adds and removes lump sums by month', () => {
    const added = run([{ type: 'add_lump_sum', month: 12, amount: 10000 }])
    expect(added.snapshot.financing.extraConfig.lumpSums).toEqual([
      { id: 'new-id', month: 12, amount: 10000, recalculation: 'prazo', description: 'Aporte avulso' },
    ])
    expect(added.rows).toEqual([{ label: 'Aporte avulso mês 12', after: 'R$ 10.000,00 · prazo', mode: 'criar' }])
    const removed = run([{ type: 'remove_lump_sum', month: 12 }], added.snapshot)
    expect(removed.snapshot.financing.extraConfig.lumpSums).toEqual([])
    expect(firstError([{ type: 'remove_lump_sum', month: 3 }])).toBe('Operação 1 (remove_lump_sum): Não há aporte avulso no mês 3.')
    expect(firstError([{ type: 'add_lump_sum', month: 0, amount: 1 }])).toMatch(/Mês inválido/)
    expect(firstError([{ type: 'add_lump_sum', month: 1, amount: 0 }])).toMatch(/Valor inválido para o aporte avulso/)
  })
})

describe('projection and run semantics', () => {
  it('patches projection parameters', () => {
    const { snapshot: next, rows } = run([{ type: 'set_projection', annualRate: 12, years: 20 }])
    expect(next.projection).toEqual({ monthlyContribution: 1000, annualRate: 12, years: 20 })
    expect(rows).toHaveLength(2)
    expect(firstError([{ type: 'set_projection', years: 0 }])).toMatch(/Anos: valor inválido/)
  })
  it('keeps going after an error and never mutates its input', () => {
    const base = snapshot()
    const frozen = JSON.stringify(base)
    const { snapshot: next, errors } = run(
      [{ type: 'set_contribution', amount: -1 }, { type: 'set_contribution', amount: 700 }, { type: 'nope' } as unknown as SettingsOperation],
      base,
    )
    expect(errors).toEqual([
      'Operação 1 (set_contribution): Valor do aporte inválido.',
      'Operação 3 (nope): Tipo de operação desconhecido.',
    ])
    expect(next.contributionAmount).toBe(700)
    expect(JSON.stringify(base)).toBe(frozen)
  })
  it('names the page that owns the last operation', () => {
    expect(pageOfOperations([{ type: 'set_contribution', amount: 1 }])).toBe('strategy')
    expect(pageOfOperations([{ type: 'set_contribution', amount: 1 }, { type: 'add_lump_sum', month: 1, amount: 1 }])).toBe('financiamento')
    expect(pageOfOperations([{ type: 'create_portfolio', name: 'x' }])).toBe('dashboard')
    expect(pageOfOperations([{ type: 'add_monthly_category', name: 'x' }])).toBe('plano-mensal')
    expect(pageOfOperations([{ type: 'set_projection', years: 5 }])).toBe('projection')
  })
})
```

Run: `npx vitest run src/domain/settingsOperations.test.ts` — Expected: FAIL (módulo não existe).

- [ ] **Step 2: Implementar `src/domain/settingsOperations.ts`**

Esqueleto obrigatório (complete os `case` restantes seguindo a tabela de regras acima; cada `case` devolve `{ snapshot, rows }` ou lança `Error` com a mensagem exata):

```ts
import { brl, num } from '../lib/format'
import { FINANCING_PRESETS } from '../store/useFinancingStore'
import { createEmptyPortfolioData, type MonthlyItem, type MonthlyPlan, type Portfolio } from '../store/useInvestmentStore'
import type { ExtraAmortizationConfig, FinancingParameters } from '../types/financing'
import type { PageId } from './pages'

// ...tipos exportados exatamente como no bloco "Produces"...

const PORTFOLIO_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#3b82f6']

type FieldRule = { label: string } & (
  | { kind: 'number'; min: number; max: number; integer?: boolean }
  | { kind: 'boolean' }
  | { kind: 'enum'; values: readonly string[] }
)

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const isNum = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const show = (value: unknown): string =>
  typeof value === 'boolean' ? (value ? 'sim' : 'não') : typeof value === 'number' ? num(value) : String(value ?? '—')

function patchFields<T extends object>(
  current: T,
  patch: unknown,
  rules: Record<string, FieldRule>,
  what: string,
): { next: T; rows: SettingsPreviewRow[] } {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length === 0) {
    throw new Error(`Informe os campos de ${what} a alterar.`)
  }
  const next: Record<string, unknown> = { ...current }
  const rows: SettingsPreviewRow[] = []
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const rule = Object.prototype.hasOwnProperty.call(rules, key) ? rules[key] : undefined
    if (!rule) throw new Error(`Campo desconhecido em ${what}: "${key}".`)
    if (rule.kind === 'number') {
      if (!isNum(value) || value < rule.min || value > rule.max || (rule.integer && !Number.isInteger(value))) {
        throw new Error(
          `${rule.label}: valor inválido (${String(value)}); use um número${rule.integer ? ' inteiro' : ''} entre ${rule.min} e ${rule.max}.`,
        )
      }
    } else if (rule.kind === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`${rule.label}: use true ou false.`)
    } else if (typeof value !== 'string' || !rule.values.includes(value)) {
      throw new Error(`${rule.label}: use um de ${rule.values.join(', ')}.`)
    }
    const before = (current as Record<string, unknown>)[key]
    if (before === value) continue
    rows.push({ label: rule.label, before: show(before), after: show(value), mode: 'alterar' })
    next[key] = value
  }
  if (rows.length === 0) throw new Error(`Nada a alterar em ${what}: os valores já são esses.`)
  return { next: next as T, rows }
}

const OPERATION_PAGE: Record<SettingsOperationType, PageId> = {
  create_portfolio: 'dashboard', rename_portfolio: 'dashboard', delete_portfolio: 'dashboard',
  set_allocation_targets: 'strategy', set_strategy_text: 'strategy', set_contribution: 'strategy',
  add_monthly_item: 'plano-mensal', update_monthly_item: 'plano-mensal', remove_monthly_item: 'plano-mensal',
  add_monthly_category: 'plano-mensal',
  update_financing: 'financiamento', apply_financing_preset: 'financiamento', update_extra_amortization: 'financiamento',
  add_lump_sum: 'financiamento', remove_lump_sum: 'financiamento',
  set_projection: 'projection',
}

export function pageOfOperations(operations: SettingsOperation[]): PageId {
  const last = operations[operations.length - 1]
  return (last && OPERATION_PAGE[last.type]) || 'dashboard'
}

export function runSettingsOperations(
  snapshot: SettingsSnapshot,
  operations: SettingsOperation[],
  createId: () => string = () => crypto.randomUUID(),
): SettingsRunResult {
  let current = snapshot
  const errors: string[] = []
  const rows: SettingsPreviewRow[] = []
  operations.forEach((op, index) => {
    try {
      const result = applyOne(current, op, createId)
      current = result.snapshot
      rows.push(...result.rows)
    } catch (error) {
      errors.push(`Operação ${index + 1} (${String(op?.type)}): ${(error as Error).message}`)
    }
  })
  return { snapshot: current, errors, rows }
}
```

`applyOne(snapshot, op, createId)` é um `switch (op.type)` com `default: throw new Error('Tipo de operação desconhecido.')`. Nunca mute `snapshot`: sempre espalhe (`{ ...s, monthlyPlan: { ...s.monthlyPlan, expenses: [...] } }`). `set_projection` usa `patchFields(s.projection, { monthlyContribution, annualRate, years } só com as chaves presentes em op, PROJECTION_RULES, 'projeção')`. `update_financing` usa `patchFields(s.financing.params, op.params, FINANCING_RULES, 'financiamento')`. `apply_financing_preset` replica `applyPreset` de `src/store/useFinancingStore.ts:220`.

- [ ] **Step 3: Verificar e commitar**

Run: `npx vitest run src/domain/settingsOperations.test.ts && npm run build` — Expected: PASS.

```bash
git add -A && git commit -m "feat: pure settings operations for the assistant"
```

---

### Task 3: Projeção num store persistido

**Files:**
- Create: `src/store/useProjectionStore.ts`, `src/store/useProjectionStore.test.ts`
- Modify: `src/components/Projection.tsx:19-28`

**Interfaces:**
- Consumes: `ProjectionParams` de `src/domain/settingsOperations.ts`.
- Produces: `useProjectionStore` com estado `ProjectionParams` (`monthlyContribution`, `annualRate`, `years`) e `setProjection(partial: Partial<ProjectionParams>): void`. Padrões: 1000, 10, 10. Chave de persistência: `projection-settings`.

- [ ] **Step 1: Teste (`src/store/useProjectionStore.test.ts`)**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectionStore } from './useProjectionStore'

beforeEach(() => useProjectionStore.setState(useProjectionStore.getInitialState(), true))

describe('useProjectionStore', () => {
  it('starts with the defaults the page always used', () => {
    expect(useProjectionStore.getState()).toMatchObject({ monthlyContribution: 1000, annualRate: 10, years: 10 })
  })
  it('patches parameters and persists them', () => {
    useProjectionStore.getState().setProjection({ years: 25 })
    expect(useProjectionStore.getState()).toMatchObject({ monthlyContribution: 1000, annualRate: 10, years: 25 })
    expect(JSON.parse(localStorage.getItem('projection-settings')!).state.years).toBe(25)
  })
})
```

- [ ] **Step 2: Implementar o store**

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectionParams } from '../domain/settingsOperations'

interface ProjectionStore extends ProjectionParams {
  setProjection: (partial: Partial<ProjectionParams>) => void
}

export const useProjectionStore = create<ProjectionStore>()(
  persist(
    (set) => ({
      monthlyContribution: 1000,
      annualRate: 10,
      years: 10,
      setProjection: (partial) => set(partial),
    }),
    { name: 'projection-settings' },
  ),
)
```

- [ ] **Step 3: Ligar `src/components/Projection.tsx`**

Leia o arquivo inteiro antes. Troque os três `useState` numéricos (`monthlyContribution`, `annualRate`, `years`) por leitura do store e mantenha os nomes dos setters para não mexer no resto do componente:

```ts
  const monthlyContribution = useProjectionStore((s) => s.monthlyContribution)
  const annualRate = useProjectionStore((s) => s.annualRate)
  const years = useProjectionStore((s) => s.years)
  const setProjection = useProjectionStore((s) => s.setProjection)
  const setMonthlyContribution = (value: number) => setProjection({ monthlyContribution: value })
  const setAnnualRate = (value: number) => setProjection({ annualRate: value })
  const setYears = (value: number) => setProjection({ years: value })
```

Os estados de texto dos inputs começam com os valores do store (`useState(monthlyContribution.toString())` etc.) e precisam acompanhar mudanças vindas de fora (o assistente) sem atrapalhar a digitação — só reescreva o texto quando o número que ele representa for diferente do valor do store:

```ts
  useEffect(() => {
    setMonthlyContributionInput((text) => (Number(text.replace(',', '.')) === monthlyContribution ? text : monthlyContribution.toString()))
    setAnnualRateInput((text) => (Number(text.replace(',', '.')) === annualRate ? text : annualRate.toString()))
    setYearsInput((text) => (Number(text.replace(',', '.')) === years ? text : years.toString()))
  }, [monthlyContribution, annualRate, years])
```

Se o botão "restaurar" do componente recolocar os padrões, ele deve chamar `setProjection({ monthlyContribution: 1000, annualRate: 10, years: 10 })`. `initialCapital` continua local (vem do total da carteira).

- [ ] **Step 4: Verificar e commitar**

Run: `npm test && npm run build` — Expected: PASS.

```bash
git add -A && git commit -m "feat: persist projection parameters in a store"
```

---

### Task 4: Ferramentas `get_app_data` e `propose_settings`, e confirmação

**Files:**
- Create: `src/chat/appState.ts`, `src/chat/appState.test.ts`
- Modify: `src/chat/tools.ts`, `src/chat/systemPrompt.ts`, `src/store/useChatStore.ts`
- Test: `src/chat/tools.test.ts`, `src/chat/agent.test.ts` (fixture), `src/store/useChatStore.test.ts`

**Interfaces:**
- Consumes: Task 1 (`PageId`, `pageLabel`, `goTo`), Task 2 (`SettingsSnapshot`, `SettingsOperation`, `SettingsPreviewRow`, `SETTINGS_OPERATION_TYPES`, `runSettingsOperations`, `pageOfOperations`), Task 3 (`useProjectionStore`), `simulateFinancing(params, extraConfig)` de `src/utils/financingEngine.ts`.
- Produces:
  - `readSettingsSnapshot(): SettingsSnapshot` e `writeSettingsSnapshot(next: SettingsSnapshot): void` em `src/chat/appState.ts`
  - `ToolContext` ganha `app: SettingsSnapshot` e `monthlyHistory: { date: string; totalIncome: number; totalExpense: number; savings: number }[]`
  - `Proposal` ganha `page?: PageId` e `settings?: { operations: SettingsOperation[]; rows: SettingsPreviewRow[] }`. Em propostas de configuração: `portfolioId: ''`, `portfolioName: pageLabel(page)`, `operations: []`, `rows: []`.
  - Ferramentas `get_app_data` e `propose_settings`; `propose_changes` aceita `portfolio` (nome) opcional e passa a preencher `page: 'dashboard'`.

- [ ] **Step 1: Teste e implementação de `src/chat/appState.ts`**

```ts
// src/chat/appState.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useFinancingStore } from '../store/useFinancingStore'
import { useInvestmentStore } from '../store/useInvestmentStore'
import { useProjectionStore } from '../store/useProjectionStore'
import { readSettingsSnapshot, writeSettingsSnapshot } from './appState'

beforeEach(() => {
  useInvestmentStore.getState().clearAllData()
  useFinancingStore.getState().resetToDefaults()
  useProjectionStore.setState(useProjectionStore.getInitialState(), true)
})

describe('appState', () => {
  it('reads every configurable area of the app', () => {
    const snap = readSettingsSnapshot()
    expect(snap.portfolios).toHaveLength(1)
    expect(snap).toMatchObject({
      activePortfolioId: 'default',
      contributionAmount: 1000,
      projection: { monthlyContribution: 1000, annualRate: 10, years: 10 },
    })
    expect(snap.financing.params.termMonths).toBe(360)
    expect(snap.monthlyPlan.categories).toContain('Outros')
  })
  it('writes a snapshot back to the three stores and refreshes the derived view', () => {
    const snap = readSettingsSnapshot()
    const extra = { ...snap.portfolios[0], id: 'p2', name: 'Viagem' }
    writeSettingsSnapshot({
      ...snap,
      portfolios: [...snap.portfolios, extra],
      activePortfolioId: 'p2',
      contributionAmount: 2500,
      financing: { ...snap.financing, params: { ...snap.financing.params, termMonths: 300 }, selectedPresetId: null },
      projection: { monthlyContribution: 500, annualRate: 8, years: 30 },
    })
    const invest = useInvestmentStore.getState()
    expect(invest.portfolios.map((p) => p.name)).toEqual(['Carteira Principal', 'Viagem'])
    expect(invest.activePortfolioId).toBe('p2')
    expect(invest.portfolio).toBe(invest.portfolios[1].data)
    expect(invest.contributionAmount).toBe(2500)
    expect(useFinancingStore.getState()).toMatchObject({ selectedPresetId: null, params: { termMonths: 300 } })
    expect(useProjectionStore.getState()).toMatchObject({ monthlyContribution: 500, annualRate: 8, years: 30 })
  })
})
```

```ts
// src/chat/appState.ts
import type { SettingsSnapshot } from '../domain/settingsOperations'
import { useFinancingStore } from '../store/useFinancingStore'
import { useInvestmentStore } from '../store/useInvestmentStore'
import { useProjectionStore } from '../store/useProjectionStore'

export function readSettingsSnapshot(): SettingsSnapshot {
  const invest = useInvestmentStore.getState()
  const financing = useFinancingStore.getState()
  const projection = useProjectionStore.getState()
  return {
    portfolios: invest.portfolios,
    activePortfolioId: invest.activePortfolioId,
    settings: invest.settings,
    contributionAmount: invest.contributionAmount,
    monthlyPlan: invest.monthlyPlan,
    financing: { params: financing.params, extraConfig: financing.extraConfig, selectedPresetId: financing.selectedPresetId },
    projection: {
      monthlyContribution: projection.monthlyContribution,
      annualRate: projection.annualRate,
      years: projection.years,
    },
  }
}

export function writeSettingsSnapshot(next: SettingsSnapshot): void {
  useInvestmentStore.setState({
    portfolios: next.portfolios,
    settings: next.settings,
    contributionAmount: next.contributionAmount,
    monthlyPlan: next.monthlyPlan,
  })
  // recalcula a visão derivada `portfolio`
  useInvestmentStore.getState().setActivePortfolio(next.activePortfolioId)
  useFinancingStore.setState({ ...next.financing })
  useProjectionStore.setState({ ...next.projection })
}
```

- [ ] **Step 2: Testes que falham das ferramentas (`src/chat/tools.test.ts`)**

Atualize as fixtures (`context()` aqui e `toolContext()` em `agent.test.ts`) com `app` (um `SettingsSnapshot` válido cujas `portfolios` são as mesmas do `workspace`; reaproveite os literais `params`/`extraConfig` do teste da Task 2) e `monthlyHistory: []`. A lista de ferramentas esperada passa a ser `['get_portfolio', 'propose_changes', 'navigate', 'get_app_data', 'propose_settings']`.

```ts
describe('executeTool — get_app_data', () => {
  it('returns only the requested sections', () => {
    const data = JSON.parse(executeTool('get_app_data', '{"sections":["plano_mensal","projecao"]}', context()).content)
    expect(Object.keys(data).sort()).toEqual(['currentPage', 'plano_mensal', 'projecao'])
    expect(data.plano_mensal).toMatchObject({ totalIncome: 8000, totalExpense: 2000, balance: 6000 })
    expect(data.projecao).toMatchObject({ monthlyContribution: 1000, annualRate: 10, years: 10 })
    expect(typeof data.projecao.estimatedFinalValue).toBe('number')
  })
  it('returns every section when none is requested and summarises the financing', () => {
    const data = JSON.parse(executeTool('get_app_data', '{}', context()).content)
    expect(Object.keys(data).sort()).toEqual(['carteiras', 'currentPage', 'estrategia', 'financiamento', 'historico', 'plano_mensal', 'projecao'])
    expect(data.carteiras).toEqual([{ name: 'Carteira Principal', active: true, assets: 2, total: 12000 }])
    expect(data.financiamento.params.termMonths).toBe(360)
    expect(data.financiamento.summary.financedAmount).toBeGreaterThan(0)
    expect(data.financiamento.presets.map((p: { id: string }) => p.id)).toContain('mcmv_social')
  })
  it('rejects unknown sections', () => {
    expect(JSON.parse(executeTool('get_app_data', '{"sections":["senha"]}', context()).content).ok).toBe(false)
  })
})

describe('executeTool — propose_settings', () => {
  it('builds a pending settings proposal with preview rows and the owning page', () => {
    const result = executeTool(
      'propose_settings',
      JSON.stringify({ summary: 'Prazo menor.', operations: [{ type: 'update_financing', params: { termMonths: 300 } }] }),
      context(),
    )
    expect(result.proposal).toMatchObject({
      id: 'prop-1', status: 'pending', page: 'financiamento', portfolioId: '', portfolioName: 'Financiamento',
      summary: 'Prazo menor.', operations: [], rows: [],
      settings: {
        operations: [{ type: 'update_financing', params: { termMonths: 300 } }],
        rows: [{ label: 'Prazo (meses)', before: '360', after: '300', mode: 'alterar' }],
      },
    })
    expect(JSON.parse(result.content)).toMatchObject({ ok: true, proposalId: 'prop-1', status: 'pending_user_confirmation' })
  })
  it('returns validation errors to the model without a proposal', () => {
    const result = executeTool(
      'propose_settings',
      JSON.stringify({ summary: 'x', operations: [{ type: 'set_contribution', amount: '1.234,56' }, { type: 'voar' }, 7] }),
      context(),
    )
    expect(result.proposal).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({
      ok: false,
      errors: ['Operação 2: tipo desconhecido "voar".', 'Operação 3: tipo desconhecido "7".'],
    })
    const second = executeTool('propose_settings', JSON.stringify({ summary: 'x', operations: [{ type: 'set_contribution', amount: '1.234,56' }] }), context())
    expect(JSON.parse(second.content).errors).toEqual(['Operação 1 (set_contribution): Valor do aporte inválido.'])
    expect(JSON.parse(executeTool('propose_settings', '{"summary":"x","operations":[]}', context()).content).ok).toBe(false)
  })
})

describe('executeTool — propose_changes with an explicit portfolio', () => {
  it('targets the named portfolio and tags the dashboard page', () => {
    const ctx = context()
    ctx.workspace.portfolios.push(portfolio('p2', 'Viagem'))
    const args = { summary: 's', portfolio: 'viagem', operations: [{ type: 'upsert_asset', ticker: 'PETR4', category: 'Ações', quantity: 1, avgPrice: 30 }] }
    const result = executeTool('propose_changes', JSON.stringify(args), ctx)
    expect(result.proposal).toMatchObject({ portfolioId: 'p2', portfolioName: 'Viagem', page: 'dashboard' })
    const missing = executeTool('propose_changes', JSON.stringify({ ...args, portfolio: 'Nada' }), ctx)
    expect(JSON.parse(missing.content)).toEqual({ ok: false, errors: ['Carteira "Nada" não encontrada.'] })
  })
})
```

Run: `npx vitest run src/chat/tools.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implementar em `src/chat/tools.ts`**

Definições (acrescentar a `TOOL_DEFINITIONS`, nesta ordem, depois de `navigate`):

```ts
  {
    type: 'function',
    function: {
      name: 'get_app_data',
      description:
        'Lê os dados locais do app fora da lista de ativos: carteiras, estratégia (metas, aporte), plano mensal, histórico de fechamentos, financiamento (parâmetros, amortização extra, resumo calculado) e projeção. Somente leitura.',
      parameters: {
        type: 'object',
        properties: {
          sections: {
            type: 'array',
            items: { type: 'string', enum: ['carteiras', 'estrategia', 'plano_mensal', 'historico', 'financiamento', 'projecao'] },
            description: 'Seções desejadas. Omita para receber todas.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_settings',
      description:
        'Mostra ao usuário uma prévia de alterações de configuração (carteiras, metas, aporte, plano mensal, financiamento, projeção). Nada é salvo até o usuário confirmar. Se devolver erros, corrija e chame de novo.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Uma ou duas frases explicando a alteração e qualquer suposição feita.' },
          operations: {
            type: 'array',
            description: 'Operações aplicadas em ordem.',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: [...SETTINGS_OPERATION_TYPES] },
                name: { type: 'string', description: 'create_portfolio, rename_portfolio: novo nome. *_monthly_item: nome do item. add_monthly_category: nome.' },
                portfolio: { type: 'string', description: 'rename_portfolio, delete_portfolio: nome atual da carteira.' },
                fiis: { type: 'number', description: 'set_allocation_targets: meta em %.' },
                acoes: { type: 'number', description: 'set_allocation_targets: meta em %.' },
                renda_fixa: { type: 'number', description: 'set_allocation_targets: meta em %. As três somam 100.' },
                text: { type: 'string', description: 'set_strategy_text: texto da estratégia.' },
                amount: { type: 'number', description: 'set_contribution: aporte em reais. add_lump_sum: valor do aporte avulso.' },
                kind: { type: 'string', enum: ['income', 'expense'], description: '*_monthly_item: receita (income) ou despesa (expense).' },
                value: { type: 'number', description: 'add_monthly_item, update_monthly_item: valor mensal em reais.' },
                category: { type: 'string', description: 'add_monthly_item, update_monthly_item: categoria do orçamento.' },
                newName: { type: 'string', description: 'update_monthly_item: novo nome do item.' },
                params: {
                  type: 'object',
                  description:
                    'update_financing: só os campos a mudar. Números: propertyValue, appraisalValue, downPayment, termMonths, annualInterestRateNominal, monthlyIndexerRate, itbiPercent, registryFeePercent, appraisalFeeFixed, borrowerAge, dfiMonthlyRate, tcaMonthlyFixed, customMipRate, monthlyGrossIncome. Booleanos: useCustomAppraisal, financeInitialExpenses, applySFHDiscount, useCustomMipRate. amortizationType: SAC|PRICE. indexerType: TR|IPCA|POUPANCA|PREFIXADO.',
                },
                presetId: { type: 'string', description: 'apply_financing_preset: id de um preset listado por get_app_data.' },
                config: {
                  type: 'object',
                  description:
                    'update_extra_amortization: só os campos a mudar. enabled (booleano), mode: constant|target_installment|time_period|lump_sum, recalculation: prazo|parcela, monthlyAmount, targetInstallment, periodStartMonth, periodEndMonth.',
                },
                month: { type: 'number', description: 'add_lump_sum, remove_lump_sum: mês da parcela (1 = primeira).' },
                recalculation: { type: 'string', enum: ['prazo', 'parcela'], description: 'add_lump_sum: reduzir prazo (padrão) ou parcela.' },
                description: { type: 'string', description: 'add_lump_sum: rótulo do aporte.' },
                monthlyContribution: { type: 'number', description: 'set_projection: aporte mensal.' },
                annualRate: { type: 'number', description: 'set_projection: taxa anual em %.' },
                years: { type: 'number', description: 'set_projection: horizonte em anos.' },
              },
              required: ['type'],
            },
          },
        },
        required: ['summary', 'operations'],
      },
    },
  },
```

Em `propose_changes`, acrescente a propriedade `portfolio: { type: 'string', description: 'Opcional: nome da carteira de destino. Padrão: a carteira que o usuário está vendo.' }` ao lado de `summary`.

Funções:

```ts
const SECTIONS_ALL = ['carteiras', 'estrategia', 'plano_mensal', 'historico', 'financiamento', 'projecao'] as const

function getAppData(args: any, context: ToolContext): ToolResult {
  try {
    const requested: unknown[] = Array.isArray(args?.sections) && args.sections.length > 0 ? args.sections : [...SECTIONS_ALL]
    const unknown = requested.filter((s) => !SECTIONS_ALL.includes(s as (typeof SECTIONS_ALL)[number]))
    if (unknown.length > 0) return failure([`Seção desconhecida: ${unknown.map(String).join(', ')}. Use: ${SECTIONS_ALL.join(', ')}.`])
    const { app } = context
    const out: Record<string, unknown> = { currentPage: context.currentPage }
    const sum = (items: { value: number }[]) => items.reduce((acc, item) => acc + (Number(item.value) || 0), 0)
    for (const section of requested as (typeof SECTIONS_ALL)[number][]) {
      if (section === 'carteiras') {
        out.carteiras = app.portfolios.map((p) => ({
          name: p.name,
          active: p.id === app.activePortfolioId,
          assets: listAssets(p.data).length,
          total: round2(listAssets(p.data).reduce((acc, a) => acc + a.value, 0)),
        }))
      } else if (section === 'estrategia') {
        out.estrategia = { text: app.settings.estrategia, targetsPct: app.settings.alvos, contributionAmount: app.contributionAmount }
      } else if (section === 'plano_mensal') {
        const item = ({ name, value, category }: { name: string; value: number; category: string }) => ({ name, value, category })
        const totalIncome = round2(sum(app.monthlyPlan.incomes))
        const totalExpense = round2(sum(app.monthlyPlan.expenses))
        out.plano_mensal = {
          incomes: app.monthlyPlan.incomes.map(item),
          expenses: app.monthlyPlan.expenses.map(item),
          categories: app.monthlyPlan.categories,
          totalIncome,
          totalExpense,
          balance: round2(totalIncome - totalExpense),
        }
      } else if (section === 'historico') {
        out.historico = context.monthlyHistory
      } else if (section === 'financiamento') {
        const { params, extraConfig, selectedPresetId } = app.financing
        const { summary } = simulateFinancing(params, extraConfig)
        out.financiamento = {
          params,
          extraConfig,
          selectedPresetId,
          presets: FINANCING_PRESETS.map((p) => ({ id: p.id, name: p.name, description: p.description })),
          summary: {
            financedAmount: round2(summary.financedAmount),
            firstInstallment: round2(summary.firstInstallment),
            lastInstallment: round2(summary.lastInstallment),
            totalPaid: round2(summary.totalPaid),
            totalInterest: round2(summary.totalInterest),
            actualMonthsToPayoff: summary.actualMonthsToPayoff,
            monthsSaved: summary.monthsSaved,
            cetAnnualEstimated: round2(summary.cetAnnualEstimated),
            incomeCommitmentPercent: round2(summary.incomeCommitmentPercent),
          },
        }
      } else {
        const { monthlyContribution, annualRate, years } = app.projection
        const initialCapital = listAssets(context.viewData).reduce((acc, a) => acc + a.value, 0)
        const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1
        let total = initialCapital
        for (let month = 0; month < years * 12; month++) total = total * (1 + monthlyRate) + monthlyContribution
        out.projecao = { monthlyContribution, annualRate, years, initialCapital: round2(initialCapital), estimatedFinalValue: round2(total) }
      }
    }
    return { content: JSON.stringify(out) }
  } catch {
    return failure(['Erro interno ao executar a ferramenta.'])
  }
}

function proposeSettings(args: any, context: ToolContext): ToolResult {
  try {
    const raw: unknown[] = Array.isArray(args?.operations) ? args.operations : []
    if (raw.length === 0) return failure(['Informe ao menos uma operação em "operations".'])
    const known = (value: unknown): value is SettingsOperation =>
      value !== null && typeof value === 'object' && !Array.isArray(value) &&
      (SETTINGS_OPERATION_TYPES as readonly unknown[]).includes((value as { type?: unknown }).type)
    const shapeErrors = raw.flatMap((item, index) =>
      known(item) ? [] : [`Operação ${index + 1}: tipo desconhecido "${String((item as { type?: unknown } | null)?.type ?? item)}".`],
    )
    if (shapeErrors.length > 0) return failure(shapeErrors)
    const operations = raw as SettingsOperation[]

    const { errors, rows } = runSettingsOperations(context.app, operations)
    if (errors.length > 0) return failure(errors)

    const page = pageOfOperations(operations)
    const proposal: Proposal = {
      id: context.createId(),
      portfolioId: '',
      portfolioName: pageLabel(page),
      summary: text(args?.summary),
      operations: [],
      rows: [],
      status: 'pending',
      page,
      settings: { operations, rows },
    }
    return {
      proposal,
      content: JSON.stringify({
        ok: true,
        proposalId: proposal.id,
        status: 'pending_user_confirmation',
        message: `Prévia exibida ao usuário. Nada foi salvo; ele precisa clicar em Confirmar. Ao confirmar, o app abre a página ${proposal.portfolioName}.`,
      }),
    }
  } catch {
    return failure(['Erro interno ao executar a ferramenta.'])
  }
}
```

(O teste espera `"7"` para o item `7`: `String(item?.type ?? item)` cobre objeto sem `type` e valores primitivos; ajuste a expressão para compilar sem `any` solto se preferir, mantendo as mensagens dos testes.)

Em `proposeChanges`: resolva o destino antes de `runOperations`:

```ts
    const wanted = text(args?.portfolio)
    const named = wanted ? context.workspace.portfolios.find((p) => p.name.trim().toLowerCase() === wanted.toLowerCase()) : undefined
    if (wanted && !named) return failure([`Carteira "${wanted}" não encontrada.`])
    const targetId = named?.id ?? context.targetPortfolioId
```

use `targetId` no lugar de `context.targetPortfolioId` no resto da função e acrescente `page: 'dashboard'` à proposta. Despacho em `executeTool`: `get_app_data` → `getAppData`, `propose_settings` → `proposeSettings`.

- [ ] **Step 4: Prompt (`src/chat/systemPrompt.ts`)**

Troque a primeira linha de apresentação por:

```
Você é o Assistente do Dashboard Invest, um painel local de finanças pessoais e carteiras de investimento brasileiras.
Você ajuda a importar extratos, registrar compras, organizar ativos e também a configurar o resto do app: carteiras, metas de alocação, aporte, plano mensal, simulador de financiamento e projeção.
```

E acrescente as regras (depois da 12):

```
13. Para dados que não são a lista de ativos (carteiras, metas, aporte, plano mensal, histórico, financiamento, projeção), leia com get_app_data antes de responder ou alterar. Peça só as seções necessárias.
14. Alterações nesses dados são feitas com propose_settings, que também só mostra uma prévia. Use propose_changes apenas para ativos e categorias de ativos. Não misture os dois assuntos numa mesma proposta; faça uma chamada para cada.
15. Em propose_settings envie números como número (2500, não "2.500,00") e só os campos que mudam. Metas de alocação sempre somam 100.
16. Excluir carteira apaga todos os ativos dela: só proponha se o usuário pediu de forma explícita, e diga isso no summary.
17. Depois que o usuário confirma uma prévia, o app abre sozinho a página daqueles dados; não chame navigate para isso.
```

Na regra 2 existente, troque "Toda alteração (importar arquivo, ...)" por "Toda alteração em ativos (importar arquivo, ...)", mantendo o resto.

- [ ] **Step 5: Store — contexto e confirmação (`src/store/useChatStore.ts`)**

Em `buildToolContext`, acrescente:

```ts
    app: readSettingsSnapshot(),
    monthlyHistory: state.monthlySnapshots.map(({ date, totalIncome, totalExpense, savings }) => ({ date, totalIncome, totalExpense, savings })),
```

Em `confirmProposal`, o bloco `try` vira:

```ts
      try {
        if (proposal.settings) {
          const { snapshot, errors } = runSettingsOperations(readSettingsSnapshot(), proposal.settings.operations)
          if (errors.length > 0) throw new Error(errors.join('\n'))
          writeSettingsSnapshot(snapshot)
        } else {
          useInvestmentStore.getState().applyAssetOperations(proposal.portfolioId, proposal.operations)
        }
      } catch (error) {
```

Depois do sucesso: `const count = proposal.settings ? proposal.settings.operations.length : proposal.operations.length`; o texto da mensagem fica

```ts
            text: proposal.settings
              ? `Pronto — ${count} ${count === 1 ? 'alteração salva' : 'alterações salvas'} em ${proposal.portfolioName}.`
              : `Pronto — ${count} ${count === 1 ? 'alteração salva' : 'alterações salvas'} em ${proposal.portfolioName}. O gráfico e a lista já refletem a mudança.`,
```

e, por último, `if (proposal.page) get().goTo(proposal.page)`.

Testes novos em `src/store/useChatStore.test.ts` (acrescente ao `beforeEach` do arquivo: `useFinancingStore.getState().resetToDefaults()`):

```ts
const settingsProposal = (overrides: Partial<Proposal> = {}): Proposal => ({
  id: 'set-1', portfolioId: '', portfolioName: 'Financiamento', summary: 'Prazo', operations: [], rows: [],
  status: 'pending', page: 'financiamento',
  settings: {
    operations: [{ type: 'update_financing', params: { termMonths: 300 } }],
    rows: [{ label: 'Prazo (meses)', before: '360', after: '300', mode: 'alterar' }],
  },
  ...overrides,
})

describe('confirmProposal — settings', () => {
  it('applies the settings, reports it and opens the owning page', () => {
    seedProposal(settingsProposal())
    chat().confirmProposal('m1', 'set-1')
    expect(useFinancingStore.getState().params.termMonths).toBe(300)
    expect(chat().messages[0].proposals?.[0].status).toBe('done')
    expect(chat().messages[1].text).toBe('Pronto — 1 alteração salva em Financiamento.')
    expect(invest().activeTab).toBe('financiamento')
  })
  it('revalidates against the current data and saves nothing when it no longer applies', () => {
    seedProposal(settingsProposal({
      page: 'plano-mensal', portfolioName: 'Plano Mensal',
      settings: { operations: [{ type: 'remove_monthly_item', kind: 'expense', name: 'Aluguel' }], rows: [] },
    }))
    chat().confirmProposal('m1', 'set-1')
    expect(chat().messages[0].proposals?.[0]).toMatchObject({
      status: 'failed',
      error: 'Operação 1 (remove_monthly_item): Não existe despesa chamada "Aluguel".',
    })
    expect(invest().activeTab).toBe('dashboard')
  })
  it('opens the dashboard after confirming an asset proposal from another page', () => {
    invest().setActiveTab('history')
    seedProposal(proposal({ page: 'dashboard' }))
    chat().confirmProposal('m1', 'prop-1')
    expect(invest().activeTab).toBe('dashboard')
  })
})
```

- [ ] **Step 6: Verificar e commitar**

Run: `npm test && npm run build` — Expected: PASS.

```bash
git add -A && git commit -m "feat: assistant reads app data and proposes settings changes"
```

---

### Task 5: Cartão de prévia para propostas de configuração

**Files:**
- Modify: `src/components/home/ProposalCard.tsx`
- Test: `src/components/home/ChatPanel.test.tsx`

**Interfaces:**
- Consumes: `Proposal.settings.rows: SettingsPreviewRow[]` (`{ label, before?, after?, mode: 'criar' | 'alterar' | 'remover' }`), `Proposal.page`.
- Produces: nada novo para outras tarefas.

- [ ] **Step 1: Teste que falha (acrescentar em `ChatPanel.test.tsx`)**

```tsx
  it('shows a settings proposal as before → after rows and applies it on confirm', async () => {
    useChatStore.setState({
      messages: [{
        id: 'a1', role: 'assistant', text: 'Confira:',
        proposals: [{
          id: 'set-1', portfolioId: '', portfolioName: 'Estratégia', summary: 'Aporte maior.', operations: [], rows: [],
          status: 'pending', page: 'strategy',
          settings: {
            operations: [{ type: 'set_contribution', amount: 2500 }],
            rows: [{ label: 'Aporte', before: 'R$ 1.000,00', after: 'R$ 2.500,00', mode: 'alterar' }],
          },
        }],
      }],
    })
    render(<ChatPanel />)
    const card = screen.getByTestId('proposal-set-1')
    expect(within(card).getByText('→ Estratégia')).toBeInTheDocument()
    expect(within(card).getByText('Aporte')).toBeInTheDocument()
    expect(within(card).getByText('R$ 1.000,00')).toBeInTheDocument()
    expect(within(card).getByText('R$ 2.500,00')).toBeInTheDocument()
    expect(within(card).getByText('alterar')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Confirmar' }))
    expect(useInvestmentStore.getState().contributionAmount).toBe(2500)
    expect(within(card).getByText('Salvo em Estratégia')).toBeInTheDocument()
  })
```

(Os valores usam espaço não separável do `Intl`; se a busca por texto falhar por causa disso, compare com `brl(1000)` e `brl(2500)` importados de `src/lib/format`.)

- [ ] **Step 2: Implementar**

Em `ProposalCard.tsx`, depois do `map` de `proposal.rows`, renderize as linhas de configuração:

```tsx
const SETTINGS_CHIP: Record<SettingsPreviewRow['mode'], string> = {
  criar: 'bg-emerald-500/15 text-emerald-400',
  alterar: 'bg-amber-500/15 text-amber-400',
  remover: 'bg-red-500/15 text-red-400',
}
```

```tsx
      {proposal.settings?.rows.map((row, index) => (
        <div
          key={`s-${index}`}
          className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_auto] gap-2 items-center px-4 py-2.5 border-b border-white/5 text-xs"
        >
          <span className="font-black truncate">{row.label}</span>
          <span className="flex items-center gap-1.5 min-w-0 justify-end text-[11px] font-bold">
            {row.before !== undefined && <span className="text-white/40 line-through truncate">{row.before}</span>}
            {row.before !== undefined && row.after !== undefined && <span className="text-white/30">→</span>}
            {row.after !== undefined && <span className="text-white/80 truncate">{row.after}</span>}
          </span>
          <span
            className={`justify-self-end px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${SETTINGS_CHIP[row.mode]}`}
          >
            {row.mode}
          </span>
        </div>
      ))}
```

Importe `type SettingsPreviewRow` de `../../domain/settingsOperations`. O resto do cartão (cabeçalho `→ {portfolioName}`, resumo, botões, estados) serve para os dois tipos sem mudança.

- [ ] **Step 3: Verificar e commitar**

Run: `npm test && npm run build` — Expected: PASS.

```bash
git add -A && git commit -m "feat: preview card for settings proposals"
```

---

### Task 6: Conversas salvas

**Files:**
- Create: `src/chat/conversations.ts`, `src/chat/conversations.test.ts`
- Modify: `src/store/useChatStore.ts`, `src/components/DataManagement.tsx:91-93`
- Test: `src/store/useChatStore.test.ts`

**Interfaces:**
- Consumes: `PageId`, `isPageId`; `UiMessage` (tipo já exportado por `useChatStore.ts`); `ChatMessage` de `src/lib/openrouter/client`.
- Produces:

```ts
// src/chat/conversations.ts
export interface Conversation {
  id: string; title: string; page: PageId; createdAt: string; updatedAt: string
  messages: UiMessage[]; history: ChatMessage[]
}
export const MAX_CONVERSATIONS = 30
export const MAX_STORED_CONTENT = 4000
export function conversationTitle(messages: UiMessage[]): string
export function saveConversation(list: Conversation[], conversation: Conversation): Conversation[]
export function relevantConversation(list: Conversation[], page: PageId): Conversation | undefined
export function forStorage(list: Conversation[]): Conversation[]
```

```ts
// acrescentado a ChatStore
  conversations: Conversation[]
  conversationId: string | null
  openConversation: (id: string) => void
  deleteConversation: (id: string) => void
  openRelevant: (page: PageId) => void
  clearConversations: () => void
```

- [ ] **Step 1: Testes das funções puras (`src/chat/conversations.test.ts`)**

```ts
import { describe, expect, it } from 'vitest'
import { MAX_CONVERSATIONS, conversationTitle, forStorage, relevantConversation, saveConversation, type Conversation } from './conversations'

const conv = (id: string, page: Conversation['page'], updatedAt: string, extra: Partial<Conversation> = {}): Conversation => ({
  id, title: id, page, createdAt: updatedAt, updatedAt, messages: [], history: [], ...extra,
})

describe('conversations', () => {
  it('titles a conversation after its first user message, on one line, capped at 48 chars', () => {
    expect(conversationTitle([])).toBe('Nova conversa')
    expect(conversationTitle([{ id: 'a', role: 'assistant', text: 'Olá' }])).toBe('Nova conversa')
    expect(conversationTitle([{ id: 'u', role: 'user', text: '  Mude o prazo\npara 300 meses  ' }])).toBe('Mude o prazo para 300 meses')
    const long = conversationTitle([{ id: 'u', role: 'user', text: 'x'.repeat(80) }])
    expect(long).toHaveLength(48)
    expect(long.endsWith('…')).toBe(true)
  })
  it('inserts or replaces by id, newest first, and caps the list', () => {
    const list = [conv('a', 'dashboard', '2026-01-01'), conv('b', 'history', '2026-01-02')]
    expect(saveConversation(list, conv('a', 'dashboard', '2026-01-03')).map((c) => c.id)).toEqual(['a', 'b'])
    expect(saveConversation(list, conv('c', 'dashboard', '2025-12-31')).map((c) => c.id)).toEqual(['b', 'a', 'c'])
    let many: Conversation[] = []
    for (let i = 0; i < MAX_CONVERSATIONS + 5; i++) many = saveConversation(many, conv(`c${i}`, 'dashboard', `2026-01-01T00:00:${String(i).padStart(2, '0')}`))
    expect(many).toHaveLength(MAX_CONVERSATIONS)
    expect(many[0].id).toBe(`c${MAX_CONVERSATIONS + 4}`)
  })
  it('picks the most recent conversation of a page', () => {
    const list = [conv('a', 'financiamento', '2026-01-01'), conv('b', 'financiamento', '2026-01-05'), conv('c', 'history', '2026-01-09')]
    expect(relevantConversation(list, 'financiamento')?.id).toBe('b')
    expect(relevantConversation(list, 'strategy')).toBeUndefined()
  })
  it('trims big attachment text before writing to disk, without touching the original', () => {
    const big = 'linha;de;planilha\n'.repeat(2000)
    const original = conv('a', 'dashboard', '2026-01-01', {
      history: [{ role: 'user', content: big }, { role: 'assistant', content: 'ok' }, { role: 'tool', tool_call_id: 't', content: big }],
    })
    const [stored] = forStorage([original])
    expect((stored.history[0].content as string).length).toBeLessThan(4100)
    expect(stored.history[0].content).toContain('[conteúdo longo omitido ao salvar a conversa]')
    expect(stored.history[1].content).toBe('ok')
    expect((stored.history[2].content as string).length).toBeLessThan(4100)
    expect(original.history[0].content).toBe(big)
  })
})
```

- [ ] **Step 2: Implementar `src/chat/conversations.ts`**

```ts
import type { PageId } from '../domain/pages'
import type { ChatMessage } from '../lib/openrouter/client'
import type { UiMessage } from '../store/useChatStore'

export interface Conversation {
  id: string
  title: string
  /** Página em que a conversa foi usada por último. */
  page: PageId
  createdAt: string
  updatedAt: string
  messages: UiMessage[]
  history: ChatMessage[]
}

export const MAX_CONVERSATIONS = 30
export const MAX_STORED_CONTENT = 4000
const TITLE_LENGTH = 48
const OMITTED = '\n[conteúdo longo omitido ao salvar a conversa]'

export function conversationTitle(messages: UiMessage[]): string {
  const first = messages.find((message) => message.role === 'user')
  const line = (first?.text ?? '').replace(/\s+/g, ' ').trim()
  if (!line) return 'Nova conversa'
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line
}

export function saveConversation(list: Conversation[], conversation: Conversation): Conversation[] {
  return [conversation, ...list.filter((item) => item.id !== conversation.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS)
}

export function relevantConversation(list: Conversation[], page: PageId): Conversation | undefined {
  return list.filter((item) => item.page === page).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

/** Planilhas anexadas chegam a 60 mil caracteres por mensagem; no disco fica só o começo. */
export function forStorage(list: Conversation[]): Conversation[] {
  return list.map((conversation) => ({
    ...conversation,
    history: conversation.history.map((message) =>
      typeof message.content === 'string' && message.content.length > MAX_STORED_CONTENT
        ? { ...message, content: message.content.slice(0, MAX_STORED_CONTENT) + OMITTED }
        : message,
    ),
  }))
}
```

- [ ] **Step 3: Testes que falham do store (acrescentar em `src/store/useChatStore.test.ts`)**

```ts
describe('saved conversations', () => {
  const reply = (text: string) => runTurn.mockResolvedValueOnce({ history: [{ role: 'user', content: 'x' }, { role: 'assistant', content: text }], reply: text, proposals: [] })

  it('saves the conversation as it grows, titled and tagged with the current page', async () => {
    invest().setActiveTab('financiamento')
    reply('Feito.')
    await chat().sendMessage('Mude o prazo para 300 meses')
    expect(chat().conversations).toHaveLength(1)
    expect(chat().conversations[0]).toMatchObject({ id: chat().conversationId, title: 'Mude o prazo para 300 meses', page: 'financiamento' })
    expect(chat().conversations[0].messages).toHaveLength(2)
    reply('Mais uma.')
    await chat().sendMessage('E a entrada?')
    expect(chat().conversations).toHaveLength(1)
    expect(chat().conversations[0].messages).toHaveLength(4)
  })

  it('writes conversations to localStorage and does not save an empty chat', async () => {
    chat().newChat()
    expect(chat().conversations).toEqual([])
    reply('Olá!')
    await chat().sendMessage('oi')
    const stored = JSON.parse(localStorage.getItem('chat-conversations')!).state
    expect(stored.conversations[0].title).toBe('oi')
    expect(stored.conversationId).toBe(chat().conversationId)
    expect(stored.typing).toBeUndefined()
  })

  it('starts a new chat without losing the saved one, and reopens it', async () => {
    reply('Olá!')
    await chat().sendMessage('primeira')
    const firstId = chat().conversationId!
    chat().newChat()
    expect(chat()).toMatchObject({ messages: [], history: [], conversationId: null })
    reply('Oi de novo')
    await chat().sendMessage('segunda')
    expect(chat().conversations.map((c) => c.title)).toEqual(['segunda', 'primeira'])
    chat().openConversation(firstId)
    expect(chat().conversationId).toBe(firstId)
    expect(chat().messages.map((m) => m.text)).toEqual(['primeira', 'Olá!'])
    // reabrir não mexe na ordem nem na data
    expect(chat().conversations.map((c) => c.title)).toEqual(['segunda', 'primeira'])
  })

  it('opens the most recent conversation of the page, or a blank one', async () => {
    invest().setActiveTab('financiamento')
    reply('ok')
    await chat().sendMessage('sobre financiamento')
    const financingId = chat().conversationId
    invest().setActiveTab('plano-mensal')
    chat().openRelevant('plano-mensal')
    expect(chat()).toMatchObject({ messages: [], conversationId: null })
    chat().openRelevant('financiamento')
    expect(chat().conversationId).toBe(financingId)
    chat().openRelevant('financiamento')
    expect(chat().conversationId).toBe(financingId)
  })

  it('does not switch conversations from the launcher while a reply is pending', () => {
    useChatStore.setState({ typing: true, messages: [{ id: 'u', role: 'user', text: 'oi' }] })
    const before = chat().conversationId
    chat().openRelevant('history')
    expect(chat().conversationId).toBe(before)
    expect(chat().messages).toHaveLength(1)
  })

  it('drops a late reply when the user switched conversations meanwhile', async () => {
    reply('Olá!')
    await chat().sendMessage('primeira')
    const firstId = chat().conversationId!
    chat().newChat()
    let resolve: (value: Awaited<ReturnType<typeof runAgentTurn>>) => void = () => {}
    runTurn.mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    const pending = chat().sendMessage('segunda')
    await Promise.resolve()
    chat().openConversation(firstId)
    resolve({ history: [], reply: 'atrasada', proposals: [] })
    await pending
    expect(chat().messages.map((m) => m.text)).toEqual(['primeira', 'Olá!'])
    expect(chat().typing).toBe(false)
  })

  it('deletes a conversation and clears the screen when it was the open one', async () => {
    reply('Olá!')
    await chat().sendMessage('primeira')
    chat().deleteConversation(chat().conversationId!)
    expect(chat()).toMatchObject({ conversations: [], messages: [], conversationId: null })
  })

  it('moves the open conversation to the page the app navigated to', async () => {
    reply('ok')
    await chat().sendMessage('oi')
    chat().goTo('strategy')
    expect(chat().conversations[0].page).toBe('strategy')
  })

  it('keeps chatting when localStorage refuses to save', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    reply('Olá!')
    await chat().sendMessage('oi')
    expect(chat().messages.map((m) => m.text)).toEqual(['oi', 'Olá!'])
    setItem.mockRestore()
  })

  it('clears every saved conversation', async () => {
    reply('Olá!')
    await chat().sendMessage('oi')
    chat().clearConversations()
    expect(chat()).toMatchObject({ conversations: [], messages: [], history: [], conversationId: null })
  })
})
```

Run: `npx vitest run src/store/useChatStore.test.ts` — Expected: FAIL.

- [ ] **Step 4: Implementar no `src/store/useChatStore.ts`**

Envolva o criador atual em `persist` (a função `(set, get) => { ... return {...} }` continua igual por dentro):

```ts
import { createJSONStorage, persist } from 'zustand/middleware'
import { forStorage, conversationTitle, relevantConversation, saveConversation, type Conversation } from '../chat/conversations'

const safeStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      // cota cheia ou storage bloqueado: a conversa segue só na memória
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name)
    } catch {
      // idem
    }
  },
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => {
      /* corpo atual + ações novas */
    },
    {
      name: 'chat-conversations',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ conversations: forStorage(state.conversations), conversationId: state.conversationId }),
      merge: (persisted, current) => {
        const saved = (persisted || {}) as Partial<Pick<ChatStore, 'conversations' | 'conversationId'>>
        const conversations = Array.isArray(saved.conversations) ? saved.conversations : []
        const open = conversations.find((c) => c.id === saved.conversationId)
        return {
          ...current,
          conversations,
          conversationId: open ? open.id : null,
          messages: open ? open.messages : [],
          history: open ? open.history : [],
        }
      },
    },
  ),
)
```

Estado inicial novo: `conversations: []`, `conversationId: null`. Ações:

```ts
    newChat: () =>
      set((state) => ({ messages: [], history: [], typing: false, session: state.session + 1, conversationId: null })),

    openConversation: (id) => {
      const found = get().conversations.find((c) => c.id === id)
      if (!found) return
      set((state) => ({
        messages: found.messages,
        history: found.history,
        conversationId: found.id,
        typing: false,
        session: state.session + 1,
      }))
    },

    deleteConversation: (id) =>
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        ...(state.conversationId === id
          ? { messages: [], history: [], conversationId: null, typing: false, session: state.session + 1 }
          : {}),
      })),

    openRelevant: (page) => {
      const state = get()
      if (state.typing) return
      const open = state.conversations.find((c) => c.id === state.conversationId)
      if (state.messages.length > 0 && open?.page === page) return
      const match = relevantConversation(state.conversations, page)
      if (match) get().openConversation(match.id)
      else if (state.messages.length > 0) get().newChat()
    },

    clearConversations: () =>
      set((state) => ({
        conversations: [], messages: [], history: [], conversationId: null, typing: false, session: state.session + 1,
      })),

    goTo: (page) => {
      useInvestmentStore.getState().setActiveTab(page)
      set((state) => ({
        conversations: state.conversations.map((c) => (c.id === state.conversationId ? { ...c, page } : c)),
      }))
    },
```

Depois do `create(...)`, o espelho da conversa em uso para a lista salva:

```ts
const currentPage = (): PageId => {
  const tab = useInvestmentStore.getState().activeTab
  return isPageId(tab) ? tab : 'dashboard'
}

useChatStore.subscribe((state, previous) => {
  if (state.messages === previous.messages && state.history === previous.history) return
  if (state.messages.length === 0) return
  const existing = state.conversations.find((c) => c.id === state.conversationId)
  // acabou de abrir uma conversa salva: nada mudou de fato
  if (existing && existing.messages === state.messages && existing.history === state.history) return
  const id = state.conversationId ?? newId()
  const now = new Date().toISOString()
  useChatStore.setState({
    conversationId: id,
    conversations: saveConversation(state.conversations, {
      id,
      title: conversationTitle(state.messages),
      page: existing?.page ?? currentPage(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messages: state.messages,
      history: state.history,
    }),
  })
})
```

Atenção ao teste "tagged with the current page": a conversa nova pega `currentPage()`; uma existente mantém a página até `goTo` mudar. O teste "starts a new chat…" exige que `updatedAt` de conversas diferentes criadas no mesmo milissegundo ainda ordene a mais nova primeiro — `saveConversation` põe a recém-salva na frente antes do `sort` estável, o que garante isso.

O `beforeEach` dos testes usa `useChatStore.setState(useChatStore.getInitialState(), true)`; confirme que continua funcionando com `persist` (zustand 4.5 expõe `getInitialState`). Se o `subscribe` salvar a conversa durante esse reset, o guard `messages.length === 0` evita.

- [ ] **Step 5: "Apagar tudo" também apaga as conversas**

Em `src/components/DataManagement.tsx`, dentro de `handleClearAll`, logo depois de `store.clearAllData();`:

```ts
      useChatStore.getState().clearConversations();
```

com `import { useChatStore } from '../store/useChatStore';`.

- [ ] **Step 6: Verificar e commitar**

Run: `npm test && npm run build` — Expected: PASS.

```bash
git add -A && git commit -m "feat: save assistant conversations locally"
```

---

### Task 7: Chat flutuante, menu de conversas e documentação

**Files:**
- Create: `src/components/home/FloatingChat.tsx`, `src/components/home/ConversationMenu.tsx`, `src/components/home/FloatingChat.test.tsx`
- Modify: `src/components/home/ChatPanel.tsx`, `src/store/useChatStore.ts`, `src/App.tsx`, `docs/openrouter.md`, `README.md`, `README.pt-BR.md`
- Test: `src/components/home/ChatPanel.test.tsx`, `src/store/useChatStore.test.ts`

**Interfaces:**
- Consumes: Task 6 (`conversations`, `conversationId`, `openConversation`, `deleteConversation`, `openRelevant`), Task 1 (`goTo`, `pageLabel`, `isPageId`).
- Produces: `ChatStore` ganha `panelOpen: boolean`, `openPanel: () => void`, `closePanel: () => void`; `goTo(page)` passa a definir `panelOpen: page !== 'dashboard'`. `ChatPanel` aceita `{ variant?: 'docked' | 'floating'; onClose?: () => void }`.

- [ ] **Step 1: Testes do store (acrescentar em `useChatStore.test.ts`)**

```ts
describe('floating panel', () => {
  it('opens on the relevant conversation of the current page and closes', async () => {
    invest().setActiveTab('financiamento')
    runTurn.mockResolvedValueOnce({ history: [], reply: 'ok', proposals: [] })
    await chat().sendMessage('sobre financiamento')
    const id = chat().conversationId
    chat().newChat()
    chat().openPanel()
    expect(chat()).toMatchObject({ panelOpen: true, conversationId: id })
    chat().closePanel()
    expect(chat().panelOpen).toBe(false)
  })
  it('opens the panel when the assistant sends the user to another page, not on the dashboard', () => {
    chat().goTo('strategy')
    expect(chat().panelOpen).toBe(true)
    chat().goTo('dashboard')
    expect(chat().panelOpen).toBe(false)
  })
})
```

Implementação no store (`panelOpen` **não** entra no `partialize`):

```ts
    panelOpen: false,
    openPanel: () => {
      get().openRelevant(currentPage())
      set({ panelOpen: true })
    },
    closePanel: () => set({ panelOpen: false }),
```

e em `goTo`, acrescente `panelOpen: page !== 'dashboard'` ao `set`. (`currentPage` foi declarado depois do `create` na Task 6; como só é chamado em tempo de execução, funciona — se o `tsc` reclamar de uso antes da declaração, mova a função para antes do `create`.)

- [ ] **Step 2: Testes de UI (`src/components/home/FloatingChat.test.tsx`)**

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_MODEL } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'
import { FloatingChat } from './FloatingChat'

const chat = () => useChatStore.getState()
const saved = (id: string, title: string, page: 'financiamento' | 'history', updatedAt: string) => ({
  id, title, page, createdAt: updatedAt, updatedAt,
  messages: [{ id: `${id}-u`, role: 'user' as const, text: title }],
  history: [{ role: 'user' as const, content: title }],
})

beforeEach(() => {
  useChatStore.setState(useChatStore.getInitialState(), true)
  useInvestmentStore.getState().clearAllData()
  useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid', model: DEFAULT_MODEL })
})

describe('FloatingChat', () => {
  it('renders nothing on the dashboard, where the chat is docked', () => {
    useInvestmentStore.getState().setActiveTab('dashboard')
    const { container } = render(<FloatingChat />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a launcher on other pages and opens the conversation relevant to that page', async () => {
    useInvestmentStore.getState().setActiveTab('financiamento')
    useChatStore.setState({
      conversations: [saved('c1', 'Prazo de 300 meses', 'financiamento', '2026-01-02'), saved('c2', 'Fechamentos', 'history', '2026-01-03')],
    })
    render(<FloatingChat />)
    expect(screen.queryByPlaceholderText('Pergunte algo ou cole os dados da sua corretora…')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Abrir assistente' }))
    expect(chat()).toMatchObject({ panelOpen: true, conversationId: 'c1' })
    expect(screen.getByPlaceholderText('Pergunte algo ou cole os dados da sua corretora…')).toBeInTheDocument()
    expect(screen.getAllByText('Prazo de 300 meses').length).toBeGreaterThan(0)
  })

  it('closes back to the launcher', async () => {
    useInvestmentStore.getState().setActiveTab('history')
    useChatStore.setState({ panelOpen: true })
    render(<FloatingChat />)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar assistente' }))
    expect(chat().panelOpen).toBe(false)
    expect(screen.getByRole('button', { name: 'Abrir assistente' })).toBeInTheDocument()
  })

  it('lists saved conversations, switches between them and deletes one', async () => {
    useInvestmentStore.getState().setActiveTab('history')
    useChatStore.setState({
      panelOpen: true,
      conversations: [saved('c2', 'Fechamentos', 'history', '2026-01-03'), saved('c1', 'Prazo de 300 meses', 'financiamento', '2026-01-02')],
    })
    render(<FloatingChat />)
    await userEvent.click(screen.getByRole('button', { name: 'Conversas' }))
    const menu = screen.getByRole('menu', { name: 'Conversas salvas' })
    expect(within(menu).getByText('Financiamento')).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole('menuitem', { name: /Prazo de 300 meses/ }))
    expect(chat().conversationId).toBe('c1')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Conversas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Apagar conversa Fechamentos' }))
    expect(chat().conversations.map((c) => c.id)).toEqual(['c1'])
  })

  it('says so when there is no saved conversation', async () => {
    useInvestmentStore.getState().setActiveTab('history')
    useChatStore.setState({ panelOpen: true })
    render(<FloatingChat />)
    await userEvent.click(screen.getByRole('button', { name: 'Conversas' }))
    expect(screen.getByText('Nenhuma conversa salva ainda.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: `src/components/home/ConversationMenu.tsx`**

```tsx
import { useState } from 'react'
import { History, Trash2 } from 'lucide-react'
import { pageLabel } from '../../domain/pages'
import { useChatStore } from '../../store/useChatStore'

const day = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export const ConversationMenu = () => {
  const conversations = useChatStore((s) => s.conversations)
  const conversationId = useChatStore((s) => s.conversationId)
  const openConversation = useChatStore((s) => s.openConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const [open, setOpen] = useState(false)

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Conversas"
        aria-label="Conversas"
        aria-expanded={open}
        className="w-[34px] h-[34px] flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
      >
        <History size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label="Conversas salvas"
            className="absolute right-0 top-[42px] z-20 w-72 max-h-80 overflow-y-auto custom-scrollbar bg-card border border-white/10 rounded-2xl shadow-2xl p-1.5"
          >
            {conversations.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-white/40 font-semibold">Nenhuma conversa salva ainda.</div>
            )}
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`flex items-center gap-1 rounded-xl ${conversation.id === conversationId ? 'bg-primary/10' : 'hover:bg-white/5'}`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openConversation(conversation.id)
                    setOpen(false)
                  }}
                  className="flex-1 min-w-0 text-left px-3 py-2"
                >
                  <div className="text-xs font-bold text-white/90 truncate">{conversation.title}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-semibold">
                    <span>{pageLabel(conversation.page)}</span>
                    <span>·</span>
                    <span>{day(conversation.updatedAt)}</span>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Apagar conversa ${conversation.title}`}
                  title="Apagar conversa"
                  onClick={() => deleteConversation(conversation.id)}
                  className="p-2 mr-1 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: `ChatPanel.tsx` — variante flutuante**

```tsx
interface Props {
  variant?: 'docked' | 'floating'
  onClose?: () => void
}

export const ChatPanel = ({ variant = 'docked', onClose }: Props) => {
```

- Subtítulo: mostre o título da conversa aberta quando houver — `const title = useChatStore((s) => s.conversations.find((c) => c.id === s.conversationId)?.title)` e `{title ?? 'Importa, organiza e configura seu painel'}`.
- Classe da `<section>`: ancorado mantém a atual; flutuante usa `bg-card border border-white/10 flex flex-col min-h-0 w-full h-full shadow-2xl relative md:rounded-[28px]`.
- No grupo de botões do cabeçalho (só quando `!locked`): `<ModelPicker />`, `<ConversationMenu />`, o botão "Nova conversa" existente.
- Fora do bloco `!locked`, quando `onClose` existir, um botão sempre visível:

```tsx
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Fechar assistente"
            aria-label="Fechar assistente"
            className="w-[34px] h-[34px] flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        )}
```

O teste existente "starts a new conversation" e os demais de `ChatPanel.test.tsx` devem continuar passando sem alteração. Acrescente um:

```tsx
  it('shows the open conversation title and the conversations button', () => {
    useChatStore.setState({
      conversationId: 'c1',
      conversations: [{ id: 'c1', title: 'Metas 40/40/20', page: 'strategy', createdAt: '2026-01-01', updatedAt: '2026-01-01', messages: [], history: [] }],
    })
    render(<ChatPanel />)
    expect(screen.getByText('Metas 40/40/20')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conversas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fechar assistente' })).not.toBeInTheDocument()
  })
```

Em `MessageList.tsx`, o texto do estado vazio passa a ser: título `Como posso ajudar?` e parágrafo `Envie um extrato ou planilha, ou peça para ajustar metas, plano mensal, financiamento e projeção — eu mostro uma prévia antes de salvar.` Atualize o teste de `ChatPanel.test.tsx` que procura `Como posso ajudar com sua carteira?` (duas ocorrências) para o novo título.

- [ ] **Step 5: `src/components/home/FloatingChat.tsx`**

```tsx
import { Bot } from 'lucide-react'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'
import { ChatPanel } from './ChatPanel'

/** Fora do Dashboard (onde o chat fica ancorado), o assistente mora no canto inferior direito. */
export const FloatingChat = () => {
  const activeTab = useInvestmentStore((s) => s.activeTab)
  const panelOpen = useChatStore((s) => s.panelOpen)
  const typing = useChatStore((s) => s.typing)
  const openPanel = useChatStore((s) => s.openPanel)
  const closePanel = useChatStore((s) => s.closePanel)

  if (activeTab === 'dashboard') return null

  if (!panelOpen) {
    return (
      <button
        type="button"
        onClick={openPanel}
        title="Abrir assistente"
        aria-label="Abrir assistente"
        className="fixed z-40 bottom-5 right-5 w-14 h-14 rounded-full bg-primary text-white shadow-2xl shadow-primary/30 flex items-center justify-center hover:bg-emerald-600 transition-colors"
      >
        <Bot size={24} />
        {typing && <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-amber-400 animate-pulse" />}
      </button>
    )
  }

  return (
    <div className="fixed z-40 inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[460px] md:h-[min(720px,calc(100dvh-48px))] flex">
      <ChatPanel variant="floating" onClose={closePanel} />
    </div>
  )
}
```

- [ ] **Step 6: Montar em `src/App.tsx`**

Importe `FloatingChat` e renderize `<FloatingChat />` logo depois de `</main>`, dentro da `div` raiz.

- [ ] **Step 7: Documentação**

Leia `docs/openrouter.md`, `README.md` e `README.pt-BR.md` e atualize as seções que descrevem o assistente (sem reescrever o resto): ferramentas disponíveis (`get_portfolio`, `propose_changes`, `navigate`, `get_app_data`, `propose_settings`) e o que cada uma faz; o que o assistente pode configurar e o que continua fora (listas personalizadas, ativos do exterior do IR, chave/modelo); chat ancorado no Dashboard e flutuante nas outras páginas; conversas salvas em `localStorage` (`chat-conversations`, até 30, anexos longos encurtados, fora do backup JSON, apagadas por "apagar tudo"); redirecionamento ao confirmar uma prévia. README em inglês em inglês, os outros dois em português.

- [ ] **Step 8: Verificar e commitar**

Run: `npm test && npm run build` — Expected: PASS.

```bash
git add -A && git commit -m "feat: floating assistant with saved conversations on every page"
```
