No Brasil, a tributação de ativos negociados em bolsa (ações, ETFs, FIIs, BDRs, etc.) segue regras específicas da Receita Federal. Aqui vai um guia direto e atualizado 👇

---

# 📊 1. Quem precisa declarar?

Você deve declarar imposto de renda se:

* Teve **operações em bolsa** (compra/venda), mesmo sem lucro
* Ou possuía mais de **R$ 800 mil em bens** (regra geral, pode variar por ano)
* Ou teve **ganho tributável acima do limite anual**

👉 Ou seja: **só de operar na bolsa já te obriga a declarar**, mesmo que não tenha lucro.

---

# 💰 2. Tributação sobre lucro (ganho de capital)

## 🟢 Ações (mercado à vista)

* **15% sobre o lucro**
* **Isenção** se:

  * Vendeu até **R$ 20.000 no mês** (total de vendas, não lucro)

⚠️ Importante:

* A isenção só vale para **ações** (não vale para FIIs, ETFs, BDRs)

---

## 🔵 Day trade (qualquer ativo)

* **20% sobre o lucro**
* ❌ **Sem isenção**
* Inclui operações iniciadas e encerradas no mesmo dia

---

## 🟡 FIIs (Fundos Imobiliários)

* **20% sobre o lucro**
* ❌ Sem isenção de R$ 20 mil

💡 Dividendos de FIIs:

* Geralmente **isentos**, se o fundo cumprir regras da legislação

---

## 🟣 ETFs

* Renda variável:

  * **15% (swing trade)**
  * **20% (day trade)**
* ❌ Sem isenção de R$ 20 mil

---

## 🟠 BDRs

* **15% sobre lucro**
* ❌ Sem isenção

💡 Dividendos:

* Tributados no exterior + ajuste no Brasil

---

# 🧾 3. DARF e pagamento

Você precisa pagar o imposto **mensalmente** via DARF:

* Código: **6015**
* Prazo: até o **último dia útil do mês seguinte**

---

# 📉 4. Prejuízo (muito importante)

Você pode compensar prejuízos:

* Prejuízo em ações → compensa com ações
* Prejuízo em day trade → só compensa com day trade

👉 Isso reduz imposto futuro

---

# 🧮 5. IR retido na fonte (dedo-duro)

A bolsa já retém um pequeno valor:

* **0,005%** (operações normais)
* **1%** (day trade)

👉 Isso NÃO é o imposto total, só um “sinal” para a Receita

---

# 📁 6. Como declarar no IR anual

No programa da Receita Federal do Brasil:

### 📌 Você precisa preencher:

#### 1. Bens e Direitos

* Informar posição em:

  * Ações
  * FIIs
  * ETFs
  * BDRs

#### 2. Renda Variável

* Informar:

  * Lucros mensais
  * Prejuízos
  * Imposto pago

#### 3. Rendimentos Isentos

* Dividendos de ações e FIIs

---

# ⚠️ 7. Erros comuns (evite isso)

* Não declarar porque teve prejuízo ❌
* Esquecer de pagar DARF mensal ❌
* Misturar day trade com swing trade ❌
* Não controlar preço médio ❌

---

# 🧠 Dica prática (importante pra devs 👀)

Se você está construindo um app financeiro (como comentou antes), você vai precisar:

* Controle de **preço médio**
* Classificação de operações (day trade vs swing)
* Consolidação mensal
* Motor de compensação de prejuízo
* Geração automática de DARF

---

# Exterior 

Para ativos no exterior (ações americanas, ETFs fora do Brasil, REITs, etc.), a tributação brasileira muda bastante — e ficou ainda mais relevante após a Lei nº 14.754/2023. Aqui vai o guia direto 👇

---

# 🌍 1. Regra geral (desde 2024)

Ganhos com investimentos no exterior são tributados no Brasil com:

* **15% sobre o lucro**
* Tributação ocorre **anualmente na declaração**, não mensal (diferente da bolsa brasileira)

👉 Ou seja: você não precisa gerar DARF todo mês para ações no exterior

---

# 💰 2. Ganho de capital (venda de ativos)

Exemplo:

* Comprou uma ação por $1.000
* Vendeu por $1.500
* Lucro: $500

Você paga:

* **15% sobre o lucro convertido para reais**

⚠️ Pontos importantes:

* Conversão usando **cotação do dólar do dia da operação**
* Não existe mais aquela isenção de R$ 35 mil/mês (foi removida)

---

# 💸 3. Dividendos do exterior

Dividendos recebidos de empresas estrangeiras:

* Tributados em **15% no Brasil**

💡 Porém:

* Se já houve imposto no exterior (ex: EUA retêm 30%)
* Você pode compensar via **acordo de bitributação**

👉 Exemplo:

* EUA reteve 30%
* Brasil cobra 15%
* Você não paga nada adicional (mas precisa declarar)

---

# 🇺🇸 Caso comum: EUA

* Retenção padrão:

  * **30% sobre dividendos**
* Com formulário **W-8BEN**:

  * Pode reduzir para **15%** (dependendo do caso)

---

# 📊 4. ETFs e REITs (muito comum)

## ETFs no exterior

* Ganho de capital: **15%**
* Dividendos: **15% (Brasil)** + retenção externa

## REITs

* Dividendos:

  * Tributados como renda normal (não isentos como FIIs no Brasil)
* Geralmente:

  * Retenção nos EUA + ajuste no Brasil

---

# 🧾 5. Declaração no IR

No sistema da Receita Federal do Brasil:

### 📌 Você vai usar:

## 1. Bens e Direitos

* Informar:

  * Ações no exterior
  * ETFs
  * Conta em corretora estrangeira

## 2. Rendimentos no Exterior

* Dividendos
* Juros
* Outros rendimentos

## 3. Ganho de Capital

* Lucro na venda de ativos

---

# 📉 6. Compensação de prejuízo

* Pode compensar prejuízos com ganhos futuros
* Mas:

  * Apenas dentro da mesma categoria (exterior)
  * Não mistura com bolsa brasileira

---

# ⚠️ 7. Diferenças importantes vs Brasil

| Tema          | Brasil             | Exterior     |
| ------------- | ------------------ | ------------ |
| Pagamento     | Mensal (DARF)      | Anual        |
| Alíquota      | 15% / 20%          | 15% fixa     |
| Isenção R$20k | Sim (ações)        | ❌ Não existe |
| IR fonte      | Dedo-duro          | ❌ Não tem    |
| Dividendos    | Isentos (ações BR) | Tributados   |

---

# 🧠 Dica prática (pro seu app 👀)

Se você quiser suportar ativos internacionais, você vai precisar:

### 📦 Modelagem extra

* Tracking de moeda (USD, EUR…)
* Histórico de câmbio por data
* Cálculo de custo médio em BRL

### ⚙️ Regras específicas

* Conversão FX no momento da compra e venda
* Controle de imposto pago no exterior
* Motor de compensação internacional separado do BR

---

# 🚨 Pegadinha clássica

* Converter tudo usando dólar atual ❌
  👉 O correto é usar:
* Cotação da data da compra
* Cotação da data da venda

---
