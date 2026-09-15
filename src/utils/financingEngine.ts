import {
  FinancingParameters,
  ExtraAmortizationConfig,
  FinancingSimulationResult,
  FinancingSummary,
  InstallmentDetail,
  FinancingComparison
} from '../types/financing';

/**
 * Retorna a alíquota mensal indicativa do seguro MIP (Morte e Invalidez Permanente)
 * conforme tabela atuarial padrão da SUSEP por faixa etária.
 */
export function getMipRateForAge(age: number): number {
  if (age <= 25) return 0.00020; // 0.0200% a.m.
  if (age <= 35) return 0.00025; // 0.0250% a.m.
  if (age <= 45) return 0.00032; // 0.0320% a.m.
  if (age <= 55) return 0.00055; // 0.0550% a.m.
  if (age <= 60) return 0.01050; // 0.1050% a.m.
  if (age <= 65) return 0.00200; // 0.2000% a.m.
  if (age <= 75) return 0.00500; // 0.5000% a.m.
  return 0.00850;                // 0.8500% a.m.
}

/**
 * Calcula os custos iniciais de transação (ITBI, Emolumentos de Registro com desconto legal
 * do Art. 290 da Lei 6.015/73 para primeiro imóvel no SFH, e Tarifa de Avaliação).
 */
export function calculateInitialExpenses(params: FinancingParameters): {
  itbi: number;
  registry: number;
  appraisal: number;
  total: number;
} {
  const propertyVal = params.propertyValue;
  const itbi = propertyVal * (params.itbiPercent / 100);
  
  // Desconto de 50% nos emolumentos se elegível ao Art. 290
  const registryBase = propertyVal * (params.registryFeePercent / 100);
  const registry = params.applySFHDiscount ? registryBase * 0.5 : registryBase;
  
  const appraisal = params.appraisalFeeFixed;
  const total = itbi + registry + appraisal;
  
  return { itbi, registry, appraisal, total };
}

/**
 * Calcula o Custo Efetivo Total (CET) anual aproximado através do método da bissecção (TIR).
 */
export function calculateCETAnnual(
  disbursedAmount: number,
  cashFlows: number[]
): number {
  if (disbursedAmount <= 0 || cashFlows.length === 0) return 0;
  
  let low = 0.00001;
  let high = 0.10; // 10% ao mês
  let rate = 0.01;

  for (let iter = 0; iter < 60; iter++) {
    rate = (low + high) / 2;
    let npv = -disbursedAmount;
    let factor = 1 + rate;
    let currentDiscount = factor;

    for (let k = 0; k < cashFlows.length; k++) {
      npv += cashFlows[k] / currentDiscount;
      currentDiscount *= factor;
    }

    if (Math.abs(npv) < 0.01) {
      break;
    }

    if (npv > 0) {
      low = rate;
    } else {
      high = rate;
    }
  }

  // Capitalização anual da taxa mensal de CET
  const cetAnnual = (Math.pow(1 + rate, 12) - 1) * 100;
  return isNaN(cetAnnual) ? 0 : cetAnnual;
}

/**
 * Executa a simulação completa do financiamento imobiliário.
 * Respeita a conversão linear de juros, a Súmula 450 do STJ,
 * e processa as estratégias de amortização extraordinária.
 */
export function simulateFinancing(
  params: FinancingParameters,
  extraConfig?: ExtraAmortizationConfig
): FinancingSimulationResult {
  const effectiveCollateral = params.useCustomAppraisal
    ? Math.min(params.propertyValue, params.appraisalValue)
    : params.propertyValue;

  const expenses = calculateInitialExpenses(params);
  const financedExpenses = params.financeInitialExpenses ? expenses.total : 0;
  const expensesOutOfPocket = params.financeInitialExpenses ? 0 : expenses.total;

  const initialFinancedPrincipal = Math.max(0, effectiveCollateral - params.downPayment + financedExpenses);
  const ltv = effectiveCollateral > 0 ? (initialFinancedPrincipal / effectiveCollateral) * 100 : 0;

  // Taxa linear mensal de juros: i_m = i_nom / 12
  const monthlyInterestRate = (params.annualInterestRateNominal / 12) / 100;
  const effectiveAnnualRate = (Math.pow(1 + monthlyInterestRate, 12) - 1) * 100;
  const monthlyIndexerRate = (params.monthlyIndexerRate || 0) / 100;

  const originalTerm = Math.max(1, params.termMonths);
  const isExtraEnabled = !!(extraConfig && extraConfig.enabled);

  // Amortização base original teórica do mês 1 (usada na redução de prazo)
  const initialMonthlyAmortizationSAC = initialFinancedPrincipal / originalTerm;
  const initialPMTPrice = monthlyInterestRate > 0
    ? initialFinancedPrincipal * ((monthlyInterestRate * Math.pow(1 + monthlyInterestRate, originalTerm)) / (Math.pow(1 + monthlyInterestRate, originalTerm) - 1))
    : initialFinancedPrincipal / originalTerm;

  let currentBalance = initialFinancedPrincipal;
  let remainingMonthsContract = originalTerm;
  let currentTargetInstallmentMet = false;

  const installments: InstallmentDetail[] = [];
  let accumulatedInterest = 0;
  let accumulatedRegularAmortization = 0;
  let accumulatedExtraAmortization = 0;
  let accumulatedPaid = 0;
  const cashFlowsForCET: number[] = [];

  const maxMonths = originalTerm + 24; // Salvaguarda contra loops

  for (let k = 1; k <= maxMonths && currentBalance > 0.001; k++) {
    const openingBalance = currentBalance;
    const currentBorrowerAge = params.borrowerAge + Math.floor((k - 1) / 12);

    // 1. Atualização do saldo devedor pelo indexador (Súmula 450 STJ)
    const indexerAdjustment = openingBalance * monthlyIndexerRate;
    const adjustedBalance = openingBalance + indexerAdjustment;

    // 2. Juros remuneratórios do mês
    const interest = adjustedBalance * monthlyInterestRate;

    // 3. Seguros e tarifas mensais
    let mipRate = params.useCustomMipRate
      ? params.customMipRate / 100
      : getMipRateForAge(currentBorrowerAge);
    const mipInsurance = adjustedBalance * mipRate;
    
    const dfiInsurance = (params.useCustomAppraisal ? params.appraisalValue : params.propertyValue) * (params.dfiMonthlyRate / 100);
    const adminFee = params.tcaMonthlyFixed;
    const totalInsuranceAndFees = mipInsurance + dfiInsurance + adminFee;

    // 4. Amortização ordinária do mês
    let regularAmortization = 0;
    const remainingSteps = Math.max(1, remainingMonthsContract);

    if (remainingSteps === 1 || k === maxMonths) {
      // Último mês: quita o saldo devedor integral recomposto
      regularAmortization = adjustedBalance;
    } else if (params.amortizationType === 'SAC') {
      regularAmortization = adjustedBalance / remainingSteps;
    } else {
      // Tabela Price
      if (monthlyInterestRate > 0) {
        const pmt = adjustedBalance * ((monthlyInterestRate * Math.pow(1 + monthlyInterestRate, remainingSteps)) / (Math.pow(1 + monthlyInterestRate, remainingSteps) - 1));
        regularAmortization = Math.max(0, pmt - interest);
      } else {
        regularAmortization = adjustedBalance / remainingSteps;
      }
    }

    // Não amortiza mais do que o saldo devedor recomposto
    if (regularAmortization > adjustedBalance) {
      regularAmortization = adjustedBalance;
    }

    const totalInstallment = regularAmortization + interest + totalInsuranceAndFees;
    let balanceAfterRegular = Math.max(0, adjustedBalance - regularAmortization);

    // 5. Amortização extraordinária
    let extraAmortization = 0;
    let effectiveRecalculation = extraConfig?.recalculation || 'prazo';

    if (isExtraEnabled && balanceAfterRegular > 0.001) {
      // Verifica aportes pontuais cadastrados para este mês
      const matchingLumpSums = extraConfig.lumpSums?.filter((l) => l.month === k) || [];
      const lumpSumAmount = matchingLumpSums.reduce((sum, l) => sum + l.amount, 0);
      if (matchingLumpSums.length > 0) {
        // Se houver lump sum com recálculo específico
        effectiveRecalculation = matchingLumpSums[0].recalculation || effectiveRecalculation;
      }

      let plannedMonthlyContribution = 0;

      if (extraConfig.mode === 'constant') {
        plannedMonthlyContribution = extraConfig.monthlyAmount || 0;
      } else if (extraConfig.mode === 'time_period') {
        if (k >= extraConfig.periodStartMonth && k <= extraConfig.periodEndMonth) {
          plannedMonthlyContribution = extraConfig.monthlyAmount || 0;
        }
      } else if (extraConfig.mode === 'target_installment') {
        if (!currentTargetInstallmentMet) {
          if (totalInstallment > extraConfig.targetInstallment) {
            plannedMonthlyContribution = extraConfig.monthlyAmount || 0;
            // Para target_installment, a modalidade natural de recálculo é 'parcela' para reduzir o encargo
            effectiveRecalculation = 'parcela';
          } else {
            currentTargetInstallmentMet = true;
          }
        }
      }

      const totalIntendedExtra = plannedMonthlyContribution + lumpSumAmount;
      extraAmortization = Math.min(balanceAfterRegular, totalIntendedExtra);
    }

    const closingBalance = Math.max(0, balanceAfterRegular - extraAmortization);
    const totalOutflow = totalInstallment + extraAmortization;

    accumulatedInterest += interest;
    accumulatedRegularAmortization += regularAmortization;
    accumulatedExtraAmortization += extraAmortization;
    accumulatedPaid += totalOutflow;
    cashFlowsForCET.push(totalInstallment);

    installments.push({
      month: k,
      borrowerAge: currentBorrowerAge,
      openingBalance,
      indexerAdjustment,
      adjustedBalance,
      interest,
      regularAmortization,
      extraAmortization,
      mipInsurance,
      dfiInsurance,
      adminFee,
      totalInsuranceAndFees,
      totalInstallment,
      totalOutflow,
      closingBalance,
      accumulatedInterest,
      accumulatedAmortization: accumulatedRegularAmortization + accumulatedExtraAmortization,
      accumulatedPaid
    });

    currentBalance = closingBalance;

    // 6. Recálculo do contrato para os próximos meses
    if (currentBalance <= 0.001) {
      break;
    }

    if (extraAmortization > 0) {
      if (effectiveRecalculation === 'prazo') {
        // Encurta o prazo mantendo a amortização ou prestação teórica original
        if (params.amortizationType === 'SAC') {
          const newRemaining = Math.ceil(currentBalance / initialMonthlyAmortizationSAC);
          remainingMonthsContract = Math.max(1, newRemaining);
        } else {
          // Price: n* = - ln(1 - (i * SD) / PMT) / ln(1 + i)
          const ratio = (monthlyInterestRate * currentBalance) / initialPMTPrice;
          if (ratio < 0.999999) {
            const newRemaining = Math.ceil(-Math.log(1 - ratio) / Math.log(1 + monthlyInterestRate));
            remainingMonthsContract = Math.max(1, newRemaining);
          } else {
            remainingMonthsContract = Math.max(1, remainingMonthsContract - 1);
          }
        }
      } else {
        // 'parcela': mantém o prazo restante original (diminuindo 1 mês normalmente)
        // o que naturalmente fará a amortização/parcela futura diminuir
        remainingMonthsContract = Math.max(1, originalTerm - k);
      }
    } else {
      remainingMonthsContract = Math.max(1, remainingMonthsContract - 1);
    }
  }

  const actualMonthsToPayoff = installments.length;
  const firstInstallment = installments.length > 0 ? installments[0].totalInstallment : 0;
  const intermediateIdx = Math.floor(installments.length / 2);
  const intermediateInstallment = installments.length > 0 ? installments[intermediateIdx].totalInstallment : 0;
  const lastInstallment = installments.length > 0 ? installments[installments.length - 1].totalInstallment : 0;

  const totalInsuranceAndFees = installments.reduce((sum, inst) => sum + inst.totalInsuranceAndFees, 0);

  // Renda mínima para que a 1ª parcela não ultrapasse 30% da renda bruta familiar
  const minGrossIncomeRequired = firstInstallment / 0.30;
  const incomeCommitmentPercent = params.monthlyGrossIncome > 0
    ? (firstInstallment / params.monthlyGrossIncome) * 100
    : 0;
  const isIncomeCommitmentOk = incomeCommitmentPercent <= 30;

  const cetAnnualEstimated = calculateCETAnnual(
    initialFinancedPrincipal - expensesOutOfPocket,
    cashFlowsForCET
  );

  const summary: FinancingSummary = {
    propertyValue: params.propertyValue,
    effectiveCollateralBase: effectiveCollateral,
    downPayment: params.downPayment,
    downPaymentPercent: effectiveCollateral > 0 ? (params.downPayment / effectiveCollateral) * 100 : 0,
    financedAmount: initialFinancedPrincipal,
    financedInitialExpenses: financedExpenses,
    initialExpensesTotal: expenses.total,
    initialExpensesOutOfPocket: expensesOutOfPocket,
    ltv,
    firstInstallment,
    intermediateInstallment,
    lastInstallment,
    totalPaid: accumulatedPaid,
    totalInterest: accumulatedInterest,
    totalRegularAmortization: accumulatedRegularAmortization,
    totalExtraAmortization: accumulatedExtraAmortization,
    totalInsuranceAndFees,
    actualMonthsToPayoff,
    originalMonths: originalTerm,
    monthsSaved: Math.max(0, originalTerm - actualMonthsToPayoff),
    minGrossIncomeRequired,
    incomeCommitmentPercent,
    isIncomeCommitmentOk,
    effectiveMonthlyRate: monthlyInterestRate * 100,
    effectiveAnnualRate,
    cetAnnualEstimated
  };

  // Se a estratégia de amortização estava ativada, geramos a simulação comparativa sem aportes
  let comparison: FinancingComparison | undefined = undefined;
  if (isExtraEnabled) {
    const baseResult = simulateFinancing(params, { ...extraConfig, enabled: false });
    const monthsSaved = Math.max(0, baseResult.summary.actualMonthsToPayoff - summary.actualMonthsToPayoff);
    const interestSaved = Math.max(0, baseResult.summary.totalInterest - summary.totalInterest);
    const totalSaved = Math.max(0, baseResult.summary.totalPaid - summary.totalPaid);
    const returnOnExtra = summary.totalExtraAmortization > 0
      ? (interestSaved / summary.totalExtraAmortization) * 100
      : 0;

    comparison = {
      withoutExtra: baseResult.summary,
      withExtra: summary,
      monthsSaved,
      interestSaved,
      totalSaved,
      returnOnExtraCapitalPercent: returnOnExtra
    };
  }

  return {
    installments,
    summary,
    comparison
  };
}
