# 📊 Dashboard Invest

**English** · [Português (BR)](./README.pt-BR.md)

A local-first investment dashboard for Brazilian portfolios (FIIs, stocks, Tesouro Direto, fixed income and foreign assets). Import your broker spreadsheet, track live quotes, plan contributions, rebalance against your target allocation and prepare your income-tax numbers — all in the browser, with no backend and no account.

> Built with React + TypeScript + Vite. All data lives in your browser's `localStorage`.

---

## ✨ Features

| Module | What it does |
| --- | --- |
| **Dashboard** | Split view: an AI assistant (OpenRouter) that imports spreadsheets and manages assets and categories through confirm-before-save previews, next to the portfolio composition chart and detailed asset table. |
| **Strategy** | Define target allocation (FIIs / stocks / fixed income), write your investment policy, save rebalancing snapshots, and generate a ready-to-paste AI prompt for strategic analysis. |
| **Projection** | Compound-interest wealth projection from initial capital, monthly contribution, annual rate and time horizon. |
| **Monthly Plan** | Track income and expenses, compute the savings factor and remaining balance, then close the month with a monthly snapshot (keeping or clearing expenses). |
| **Average Price** | Computes your average cost per ticker from a B3 "Negociações" spreadsheet export. |
| **Income Tax** | Consolidates B3 sales into taxable vs. exempt buckets, breaks down each sale, and manages foreign stocks/ETFs (USD cost basis) separately. |
| **History** | Monthly history of income, expenses, savings and equity evolution. |
| **Data Menu** | JSON viewer/editor over the raw store, backup export/import, and a full data reset. |
| **Multi-portfolio** | Create, rename, colour and delete multiple portfolios; view one in isolation or all of them consolidated. |

### Assistant-driven import

There is no column-mapping wizard. Attach any `.csv`, `.xlsx` or `.xls` broker export in the chat and the model:

- works out which columns hold the ticker, quantity and average price;
- classifies each asset (including `…11` tickers that are units, not FIIs);
- shows a preview of every change, which is only saved after you click **Confirmar**.

You need your own [OpenRouter](https://openrouter.ai/keys) API key; it is stored only in your browser. See [`docs/openrouter.md`](./docs/openrouter.md). A sample file is available at `public/modelo_importacao.xlsx`.

---

## 🧱 Tech stack

- **React 18** + **TypeScript** + **Vite 5**
- **Zustand** (with `persist` middleware) for state and browser persistence
- **Tailwind CSS** for styling (dark theme, emerald accent)
- **Recharts** for charts, **Framer Motion** for animation, **lucide-react** for icons
- **xlsx** for spreadsheet parsing, **axios** + **cheerio** for quotes and scraping
- **OpenRouter** (chat completions with tool calling) for the assistant, **Vitest** + Testing Library for tests

---

## 🚀 Getting started

### Requirements

- Node.js **24.13.0** (see `.nvmrc` — `nvm use` picks it up)
- npm

### Install and run

```bash
git clone <your-repo-url>
cd dashboard-invest
npm install
cp .env.example .env   # then fill in the keys below
npm run dev
```

Vite serves the app at <http://localhost:5173>.

### Environment variables

Create a `.env` file in the project root:

```bash
# brapi.dev token — used for quotes and P/E ratio
VITE_BRAPI_API_KEY=your_token_here
```

Get a free token at [brapi.dev](https://brapi.dev). Without it the app still runs, but live quotes will not load.

> `.env` is git-ignored. Only variables prefixed with `VITE_` are exposed to the client — and, being a fully client-side app, **any key you put there is visible to anyone using the deployed page**. Use a token scoped accordingly.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server with the quote proxies enabled. |
| `npm run build` | Type-check (`tsc`) and build to `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the test suite once (Vitest). |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run lint` | ESLint over `ts`/`tsx`. ⚠️ No ESLint config file is committed yet, so this currently fails until one is added. |

---

## 🌐 Market data

Quotes come from two sources, combined in `src/services/brapi.ts`:

1. **brapi.dev** — price, daily change, short name, sector, logo and P/E ratio.
2. **Investidor10** (HTML scraping via cheerio) — P/BV and dividend yield, fetched **only on a manual refresh** to keep request volume low.

Both are reached through Vite dev-server proxies (`/api` → `brapi.dev`, `/i10` → `investidor10.com.br`) to avoid CORS in development.

> **Known limitation:** those proxies only exist in the dev server. In a static production build the brapi calls go straight to `https://brapi.dev`, but the Investidor10 scraping path stays relative and will not resolve — deploying it needs an equivalent proxy (e.g. a serverless function or a rewrite rule on your host).

---

## 🔒 Data and privacy

- Everything is persisted in `localStorage` under the key `investment-storage`. No server, no database, no telemetry.
- **Backup / restore:** the sidebar exports a versioned `.json` (`investdash-backup-YYYY-MM-DD.json`) containing portfolios, settings, snapshots, watchlists, equity history, monthly plan and import configuration. Importing a backup replaces the current state.
- Clearing your browser data deletes your portfolio. Export backups regularly.
- The `data/` folder holds local JSON fixtures and is git-ignored.

The assistant sends your messages, attached spreadsheet contents and a summary of the portfolio you are viewing to OpenRouter and the model provider you select. Nothing else leaves the browser.

---

## 📁 Project structure

```
src/
├── App.tsx                     # Tab routing between modules
├── main.tsx
├── components/
│   ├── Sidebar.tsx             # Navigation, spreadsheet import, backup export/import
│   ├── home/                   # Chat + portfolio home page
│   ├── Strategy.tsx            # Targets, investment policy, snapshots, AI prompt
│   ├── Projection.tsx          # Compound-interest projection
│   ├── PlanoMensal.tsx         # Monthly income/expense plan
│   ├── AveragePrice.tsx        # Average price from B3 trades
│   ├── TaxModule.tsx           # Income tax (Brazil + foreign assets)
│   ├── History.tsx             # Monthly history
│   ├── DataManagement.tsx      # JSON editor, backups, reset
│   ├── PortfolioManagerModal.tsx / PortfolioSelector.tsx
│   └── ErrorBoundary.tsx
├── chat/                       # Agent loop, tools, system prompt, attachment reading
├── domain/                     # Pure asset, portfolio-view and operation logic
├── hooks/                      # Quote refresh and API-key revalidation
├── lib/openrouter/             # OpenRouter HTTP client and model list
├── services/brapi.ts           # Quotes (brapi) + indicators (Investidor10)
├── store/useInvestmentStore.ts # Zustand store, persistence, portfolio logic
├── store/useChatStore.ts       # Chat state, proposals, confirm/discard
├── store/useAiSettingsStore.ts # OpenRouter key and selected model
└── utils/financingEngine.ts    # Financing calculation engine
docs/                           # brapi API and Brazilian tax notes
legacy/                         # Previous Streamlit/Python version (unmaintained)
public/modelo_importacao.xlsx   # Import template
```

The `legacy/` folder and the `.devcontainer/` configuration still refer to the original Streamlit prototype; they are kept for reference only and are not part of the current app.

---

## ⚠️ Disclaimer

This project is a personal portfolio-tracking tool. It is **not** financial advice, and the tax module is a calculation aid — not a substitute for professional accounting. Always double-check figures against your broker's and the Receita Federal's official statements.
