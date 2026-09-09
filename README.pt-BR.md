# 📊 Dashboard Invest

[English](./README.md) · **Português (BR)**

Um dashboard de investimentos *local-first* para carteiras brasileiras (FIIs, ações, Tesouro Direto, renda fixa e ativos no exterior). Importe a planilha da sua corretora, acompanhe cotações ao vivo, planeje aportes, rebalanceie contra os seus alvos e prepare os números do Imposto de Renda — tudo no navegador, sem backend e sem cadastro.

> Feito com React + TypeScript + Vite. Todos os dados ficam no `localStorage` do seu navegador.

---

## ✨ Funcionalidades

| Módulo | O que faz |
| --- | --- |
| **Dashboard** | Patrimônio total, alocação por classe, tabela detalhada de ativos (preço médio, cotação ao vivo, lucro/prejuízo), cadastro manual de ativos e listas de monitoramento direto. |
| **Estratégia** | Define os alvos de alocação (FIIs / ações / renda fixa), registra a sua política de investimentos, salva snapshots de rebalanceamento e gera um prompt pronto para análise estratégica com IA. |
| **Projeção** | Projeção de patrimônio por juros compostos a partir de capital inicial, aporte mensal, taxa anual e prazo. |
| **Plano Mensal** | Controle de receitas e gastos, cálculo do fator poupança e do valor restante, com fechamento do mês em snapshot (mantendo ou zerando as despesas). |
| **Preço Médio** | Calcula o preço médio por ticker a partir da planilha de **Negociações** exportada da B3. |
| **Imposto de Renda** | Consolida as vendas da B3 em tributáveis e isentas, detalha cada operação e gerencia à parte stocks e ETFs no exterior (custo em USD). |
| **Histórico** | Histórico mensal de receitas, gastos, economia e evolução patrimonial. |
| **Menu de Dados** | Visualizador/editor JSON do estado bruto, exportação e importação de backup e reset completo dos dados. |
| **Multi-carteiras** | Cria, renomeia, colore e exclui várias carteiras; visualize uma isoladamente ou todas de forma consolidada. |

### Importação universal de planilhas

O importador (`src/utils/universalParser.ts`) aceita **qualquer** arquivo `.csv`, `.xlsx` ou `.xls`:

- detecta a linha de cabeçalho e mapeia colunas automaticamente por sinônimos (`ticker`/`ativo`/`papel`, `quantidade`/`qtd`/`cotas`, `preço médio`/`pm`, `tipo`/`categoria`, …);
- classifica cada ativo em FIIs, ações, Tesouro, renda fixa ou dividendos (com heurística para tickers `…11` que são *units*, e não FIIs);
- permite ajustar o mapeamento manualmente por seção da planilha;
- importa para uma carteira **nova** ou para uma existente, **substituindo** ou **mesclando/somando** as posições.

Há um modelo de exemplo em `public/modelo_importacao.xlsx`.

---

## 🧱 Tecnologias

- **React 18** + **TypeScript** + **Vite 5**
- **Zustand** (middleware `persist`) para estado e persistência no navegador
- **Tailwind CSS** para o visual (tema escuro, destaque em esmeralda)
- **Recharts** para gráficos, **Framer Motion** para animações, **lucide-react** para ícones
- **xlsx** para leitura de planilhas, **axios** + **cheerio** para cotações e scraping

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
- **Backup / restauração:** a barra lateral exporta um `.json` versionado (`investdash-backup-AAAA-MM-DD.json`) com carteiras, configurações, snapshots, listas, histórico patrimonial, plano mensal e configuração de importação. Importar um backup substitui o estado atual.
- Limpar os dados do navegador apaga a sua carteira. Exporte backups com frequência.
- A pasta `data/` guarda JSONs locais e está no `.gitignore`.

---

## 📁 Estrutura do projeto

```
src/
├── App.tsx                     # Roteamento por abas entre os módulos
├── main.tsx
├── components/
│   ├── Sidebar.tsx             # Navegação, importação de planilha, backup
│   ├── Dashboard.tsx           # Patrimônio, alocação, tabela de ativos, listas
│   ├── Strategy.tsx            # Alvos, política de investimentos, snapshots, prompt de IA
│   ├── Projection.tsx          # Projeção por juros compostos
│   ├── PlanoMensal.tsx         # Plano mensal de receitas e gastos
│   ├── AveragePrice.tsx        # Preço médio a partir das negociações da B3
│   ├── TaxModule.tsx           # Imposto de Renda (Brasil + exterior)
│   ├── History.tsx             # Histórico mensal
│   ├── DataManagement.tsx      # Editor JSON, backups, reset
│   ├── ImportModal.tsx         # Assistente de importação universal
│   ├── PortfolioManagerModal.tsx / PortfolioSelector.tsx
│   └── ErrorBoundary.tsx
├── services/brapi.ts           # Cotações (brapi) + indicadores (Investidor10)
├── store/useInvestmentStore.ts # Store Zustand, persistência e lógica de carteiras
└── utils/
    ├── universalParser.ts      # Detecção de colunas e classificação de ativos
    └── parser.ts               # Importação por seções configuradas
docs/                           # Notas sobre a API da brapi e sobre impostos
legacy/                         # Versão anterior em Streamlit/Python (sem manutenção)
public/modelo_importacao.xlsx   # Modelo de importação
```

A pasta `legacy/` e a configuração em `.devcontainer/` ainda se referem ao protótipo original em Streamlit; foram mantidas apenas como referência e não fazem parte do app atual.

---

## ⚠️ Aviso

Este projeto é uma ferramenta pessoal de acompanhamento de carteira. **Não** constitui recomendação de investimento, e o módulo de Imposto de Renda é um auxílio de cálculo — não substitui um contador. Confira sempre os valores com os informes da sua corretora e com a Receita Federal.
