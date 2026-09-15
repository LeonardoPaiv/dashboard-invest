export type AmortizationType = 'SAC' | 'PRICE';

export type IndexerType = 'TR' | 'IPCA' | 'POUPANCA' | 'PREFIXADO';

export type ExtraAmortizationMode =
  | 'constant'           // Aporte fixo mensal constante até a quitação
  | 'target_installment' // Amortizar mensalmente até a parcela atingir <= R$ X
  | 'time_period'        // Amortizar mensalmente em um intervalo específico (mês X a Y)
  | 'lump_sum';          // Aportes avulsos pontuais (tabela de eventos)

export type AmortizationRecalculation = 'prazo' | 'parcela';

export interface LumpSumAmortization {
  id: string;
  month: number;
  amount: number;
  recalculation: AmortizationRecalculation;
  description: string;
}

export interface FinancingParameters {
  // Dados do Imóvel & Financiamento
  propertyValue: number;          // Valor de compra e venda
  appraisalValue: number;         // Valor de avaliação do laudo
  useCustomAppraisal: boolean;    // Se usa avaliação diferente do valor de compra
  downPayment: number;            // Valor da entrada (em R$)
  termMonths: number;             // Prazo em meses (ex: 360 ou 420)
  annualInterestRateNominal: number; // Taxa de juros nominal anual (% a.a.)
  amortizationType: AmortizationType; // SAC ou PRICE
  indexerType: IndexerType;       // TR, IPCA, Poupança ou Prefixado
  monthlyIndexerRate: number;     // Projeção do indexador (% a.m., ex: 0.10 para TR, 0.35 para IPCA)
  
  // Encargos Iniciais e Cartório
  financeInitialExpenses: boolean; // Se financia as custas iniciais no contrato
  itbiPercent: number;             // ITBI municipal (ex: 3%)
  registryFeePercent: number;      // Emolumentos cartorários estimados (ex: 1%)
  appraisalFeeFixed: number;       // Tarifa fixa de avaliação do banco (ex: R$ 3.500)
  applySFHDiscount: boolean;       // Desconto de 50% em cartório pelo Art. 290 da Lei 6.015/73

  // Seguros e Tarifas Administrativas
  borrowerAge: number;            // Idade do proponente mais velho
  dfiMonthlyRate: number;         // Taxa DFI mensal (% a.m., padrão 0.0100%)
  tcaMonthlyFixed: number;        // Tarifa de administração da conta (padrão R$ 25,00)
  useCustomMipRate: boolean;      // Se o usuário quer fixar uma alíquota de MIP
  customMipRate: number;          // Taxa MIP customizada (% a.m.)

  // Capacidade Financeira
  monthlyGrossIncome: number;     // Renda familiar bruta mensal comprovada
}

export interface ExtraAmortizationConfig {
  enabled: boolean;
  mode: ExtraAmortizationMode;
  recalculation: AmortizationRecalculation;
  monthlyAmount: number;          // Valor do aporte mensal para constant, target_installment ou time_period
  targetInstallment: number;      // Meta de valor da parcela para o modo target_installment
  periodStartMonth: number;       // Mês de início para time_period
  periodEndMonth: number;         // Mês final para time_period
  lumpSums: LumpSumAmortization[];// Aportes pontuais avulsos
}

export interface InstallmentDetail {
  month: number;
  borrowerAge: number;
  openingBalance: number;         // Saldo devedor de abertura
  indexerAdjustment: number;      // Correção monetária do mês
  adjustedBalance: number;        // Saldo recomposto após correção (Súmula 450 STJ)
  interest: number;               // Juros do mês (J_k)
  regularAmortization: number;    // Cota contratual de amortização (A_k)
  extraAmortization: number;      // Aporte extraordinário (V_amort)
  mipInsurance: number;           // Seguro MIP (Morte e Invalidez Permanente)
  dfiInsurance: number;           // Seguro DFI (Danos Físicos ao Imóvel)
  adminFee: number;               // Tarifa de administração (TCA)
  totalInsuranceAndFees: number;  // MIP + DFI + TCA
  totalInstallment: number;       // Encargo mensal pago pelo mutuário (A + J + Seguros)
  totalOutflow: number;           // Total desembolsado no mês (Encargo + Aporte Extra)
  closingBalance: number;         // Saldo devedor final após amortização
  accumulatedInterest: number;    // Juros acumulados até o mês
  accumulatedAmortization: number;// Amortização acumulada até o mês
  accumulatedPaid: number;        // Total desembolsado acumulado
}

export interface FinancingSummary {
  propertyValue: number;
  effectiveCollateralBase: number;// min(valor_imovel, valor_avaliacao)
  downPayment: number;
  downPaymentPercent: number;
  financedAmount: number;         // PV líquido financiado
  financedInitialExpenses: number;// Custas incorporadas ao saldo financiado se aplicável
  initialExpensesTotal: number;   // Custas iniciais totais (ITBI + Cartório + Avaliação)
  initialExpensesOutOfPocket: number; // Custas pagas à vista
  ltv: number;                    // Loan-to-Value (%)
  
  firstInstallment: number;       // Primeiro encargo mensal
  intermediateInstallment: number;// Parcela na metade do prazo
  lastInstallment: number;        // Último encargo mensal
  
  totalPaid: number;              // Total desembolsado (parcelas + aportes extras)
  totalInterest: number;          // Total de juros pagos ao credor
  totalRegularAmortization: number;
  totalExtraAmortization: number; // Total amortizado antecipadamente
  totalInsuranceAndFees: number;  // Total de seguros e tarifas
  
  actualMonthsToPayoff: number;   // Prazo real até zerar a dívida
  originalMonths: number;         // Prazo contratual original
  monthsSaved: number;            // Meses economizados
  
  minGrossIncomeRequired: number; // Renda mínima para 1ª parcela (limite 30%)
  incomeCommitmentPercent: number;// Comprometimento da renda informada (%)
  isIncomeCommitmentOk: boolean;  // <= 30%
  
  effectiveMonthlyRate: number;   // Taxa mensal linear (%)
  effectiveAnnualRate: number;    // Taxa efetiva anualizada (%)
  cetAnnualEstimated: number;     // Custo Efetivo Total (CET) anual aproximado (%)
}

export interface FinancingComparison {
  withoutExtra: FinancingSummary;
  withExtra: FinancingSummary;
  monthsSaved: number;
  interestSaved: number;
  totalSaved: number;
  returnOnExtraCapitalPercent: number; // (Juros economizados / Aportes extras) * 100
}

export interface FinancingSimulationResult {
  installments: InstallmentDetail[];
  summary: FinancingSummary;
  comparison?: FinancingComparison;
}
