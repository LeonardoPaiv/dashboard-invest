# 📊 Dashboard Invest

[English](./README.md) · **Português (BR)**

Um dashboard de investimentos *local-first* para carteiras brasileiras (FIIs, ações, Tesouro Direto, renda fixa e ativos no exterior). Importe a planilha da sua corretora, acompanhe cotações ao vivo, planeje aportes, rebalanceie contra os seus alvos e prepare os números do Imposto de Renda — tudo no navegador, sem backend e sem cadastro.

> Feito com React + TypeScript + Vite. Todos os dados ficam no `localStorage` do seu navegador.

---

## ✨ Funcionalidades

| Módulo | O que faz |
| --- | --- |
| **Dashboard** | Tela dividida: um assistente de IA (OpenRouter) que importa planilhas e gerencia ativos e categorias com prévia e confirmação, ao lado do gráfico de composição e da tabela de ativos. |
| **Estratégia** | Define os alvos de alocação (FIIs / ações / renda fixa), registra a sua política de investimentos, salva snapshots de rebalanceamento e gera um prompt pronto para análise estratégica com IA. |
| **Projeção** | Projeção de patrimônio por juros compostos a partir de capital inicial, aporte mensal, taxa anual e prazo. |
| **Plano Mensal** | Controle de receitas e gastos, cálculo do fator poupança e do valor restante, com fechamento do mês em snapshot (mantendo ou zerando as despesas). |
| **Preço Médio** | Calcula o preço médio por ticker a partir da planilha de **Negociações** exportada da B3. |
| **Imposto de Renda** | Consolida as vendas da B3 em tributáveis e isentas, detalha cada operação e gerencia à parte stocks e ETFs no exterior (custo em USD). |
| **Histórico** | Histórico mensal de receitas, gastos, economia e evolução patrimonial. |
| **Menu de Dados** | Visualizador/editor JSON do estado bruto, exportação e importação de backup e reset completo dos dados. |
| **Multi-carteiras** | Cria, renomeia, colore e exclui várias carteiras; visualize uma isoladamente ou todas de forma consolidada. |

### Importação pelo assistente

Não há mais assistente de mapeamento de colunas. Anexe no chat qualquer exportação `.csv`, `.xlsx` ou `.xls` da corretora e o modelo:

- descobre quais colunas têm o ticker, a quantidade e o preço médio;
- classifica cada ativo (inclusive tickers `…11` que são units, não FIIs);
- mostra uma prévia de cada alteração, que só é salva depois de você clicar em **Confirmar**.

### Ferramentas e configurações do assistente

O assistente tem cinco ferramentas: `get_portfolio` (lê a carteira em exibição), `propose_changes` (prévias de ativos e categorias), `navigate` (leva você a outra página), `get_app_data` (lê metas, estratégia, plano mensal, financiamento, projeção e histórico) e `propose_settings` (prévias de configurações). Ele configura carteiras (criar/renomear/excluir), metas de alocação, texto da estratégia, aporte, itens e categorias do plano mensal, parâmetros/presets/amortização extra/aportes únicos do financiamento e parâmetros da projeção. Listas personalizadas, ativos do exterior do Imposto de Renda e a chave/modelo da API ficam fora do alcance dele.

No Dashboard o chat fica ancorado ao lado da carteira; nas demais páginas, um botão flutuante no canto inferior direito abre o mesmo chat em um painel flutuante. Ao confirmar uma prévia, o app leva você à página afetada. As conversas ficam salvas no `localStorage` (`chat-conversations`, até 30, anexos longos encurtados), não entram no backup JSON e são apagadas por "apagar tudo".

Você precisa de uma chave própria do [OpenRouter](https://openrouter.ai/keys); ela fica salva apenas no seu navegador. Veja [`docs/openrouter.md`](./docs/openrouter.md). Há um modelo de exemplo em `public/modelo_importacao.xlsx`.

---

## 🧱 Tecnologias

- **React 18** + **TypeScript** + **Vite 5**
- **Zustand** (middleware `persist`) para estado e persistência no navegador
- **Tailwind CSS** para o visual (tema escuro, destaque em esmeralda)
- **Recharts** para gráficos, **Framer Motion** para animações, **lucide-react** para ícones
- **xlsx** para leitura de planilhas, **axios** + **cheerio** para cotações e scraping
- **OpenRouter** (chat completions com tool calling) para o assistente, **Vitest** + Testing Library para testes

---

## 🚀 Como executar

### Requisitos

- Node.js **24.13.0** (veja o `.nvmrc` — basta rodar `nvm use`)
- npm

### Instalação

```bash
git clone <url-do-seu-repositorio>
cd dashboard-invest
npm install
cp .env.example .env   # preencha as chaves abaixo
npm run dev
```

O Vite sobe a aplicação em <http://localhost:5173>.

### Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# Token da brapi.dev — usado para cotações e P/L
VITE_BRAPI_API_KEY=seu_token_aqui
```

Você consegue um token gratuito em [brapi.dev](https://brapi.dev). Sem ele o app continua funcionando, mas as cotações ao vivo não carregam.

> O `.env` está no `.gitignore`. Apenas variáveis com prefixo `VITE_` são expostas ao cliente — e, por ser um app 100% client-side, **qualquer chave colocada ali fica visível para quem acessar a página publicada**. Use um token com escopo compatível com isso.

### Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Sobe o servidor de desenvolvimento com os proxies de cotação ativos. |
| `npm run build` | Faz a checagem de tipos (`tsc`) e gera o build em `dist/`. |
| `npm run preview` | Serve localmente o build de produção. |
| `npm test` | Roda a suíte de testes uma vez (Vitest). |
| `npm run test:watch` | Roda o Vitest em modo watch. |
| `npm run lint` | ESLint sobre `ts`/`tsx`. ⚠️ Ainda não há arquivo de configuração do ESLint versionado, então o comando falha até que um seja adicionado. |

---

## 🌐 Dados de mercado

As cotações vêm de duas fontes, combinadas em `src/services/brapi.ts`:

1. **brapi.dev** — preço, variação do dia, nome curto, setor, logo e P/L.
2. **Investidor10** (scraping HTML com cheerio) — P/VP e Dividend Yield, buscados **apenas na atualização manual**, para reduzir o volume de requisições.

Ambas passam pelos proxies do servidor de desenvolvimento do Vite (`/api` → `brapi.dev`, `/i10` → `investidor10.com.br`), evitando problemas de CORS em desenvolvimento.

> **Limitação conhecida:** esses proxies existem apenas no servidor de desenvolvimento. Em um build estático de produção as chamadas à brapi vão direto para `https://brapi.dev`, mas o caminho de scraping do Investidor10 continua relativo e não resolve — publicar o app exige um proxy equivalente (por exemplo, uma função serverless ou uma regra de *rewrite* na hospedagem).

---

## 🔒 Dados e privacidade

- Tudo é persistido no `localStorage`, na chave `investment-storage`. Sem servidor, sem banco de dados, sem telemetria.
- **Backup / restauração:** a barra lateral exporta um `.json` versionado (`investdash-backup-AAAA-MM-DD.json`) com carteiras, configurações, snapshots, listas, histórico patrimonial e plano mensal. Importar um backup substitui o estado atual.
- Limpar os dados do navegador apaga a sua carteira. Exporte backups com frequência.
- A pasta `data/` guarda JSONs locais e está no `.gitignore`.

O assistente envia suas mensagens, o conteúdo das planilhas anexadas e um resumo da carteira em exibição para o OpenRouter e para o provedor do modelo escolhido. Nada mais sai do navegador.

---

## 📁 Estrutura do projeto

```
src/
├── App.tsx                     # Roteamento por abas entre os módulos
├── main.tsx
├── components/
│   ├── Sidebar.tsx             # Navegação, importação de planilha, backup
│   ├── home/                   # Página inicial: chat + carteira
│   ├── Strategy.tsx            # Alvos, política de investimentos, snapshots, prompt de IA
│   ├── Projection.tsx          # Projeção por juros compostos
│   ├── PlanoMensal.tsx         # Plano mensal de receitas e gastos
│   ├── AveragePrice.tsx        # Preço médio a partir das negociações da B3
│   ├── TaxModule.tsx           # Imposto de Renda (Brasil + exterior)
│   ├── History.tsx             # Histórico mensal
│   ├── DataManagement.tsx      # Editor JSON, backups, reset
│   ├── PortfolioManagerModal.tsx / PortfolioSelector.tsx
│   └── ErrorBoundary.tsx
├── chat/                       # Loop do agente, ferramentas, prompt, leitura de anexos
├── domain/                     # Lógica pura de ativos, visão da carteira e operações
├── hooks/                      # Atualização de cotações e revalidação da chave
├── lib/openrouter/             # Cliente HTTP do OpenRouter e lista de modelos
├── services/brapi.ts           # Cotações (brapi) + indicadores (Investidor10)
├── store/useInvestmentStore.ts # Store Zustand, persistência e lógica de carteiras
├── store/useChatStore.ts       # Estado do chat, propostas, confirmar/descartar
├── store/useAiSettingsStore.ts # Chave do OpenRouter e modelo escolhido
└── utils/financingEngine.ts    # Motor de cálculo de financiamento
docs/                           # Notas sobre a API da brapi e sobre impostos
legacy/                         # Versão anterior em Streamlit/Python (sem manutenção)
public/modelo_importacao.xlsx   # Modelo de importação
```

A pasta `legacy/` e a configuração em `.devcontainer/` ainda se referem ao protótipo original em Streamlit; foram mantidas apenas como referência e não fazem parte do app atual.

---

## ⚠️ Aviso

Este projeto é uma ferramenta pessoal de acompanhamento de carteira. **Não** constitui recomendação de investimento, e o módulo de Imposto de Renda é um auxílio de cálculo — não substitui um contador. Confira sempre os valores com os informes da sua corretora e com a Receita Federal.
