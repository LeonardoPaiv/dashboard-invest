import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { FinancingSimulationResult } from '../../types/financing';
import { TrendingDown, Layers } from 'lucide-react';

interface Props {
  result: FinancingSimulationResult;
  baseResult?: FinancingSimulationResult;
  isExtraEnabled: boolean;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
};

export const FinancingCharts: React.FC<Props> = ({ result, baseResult, isExtraEnabled }) => {
  const [activeChart, setActiveChart] = useState<'balance' | 'composition'>('balance');

  // Prepara dados agregados para o gráfico de Saldo Devedor
  const balanceChartData = useMemo(() => {
    const data: any[] = [];
    const maxMonths = Math.max(
      result.installments.length,
      baseResult ? baseResult.installments.length : 0
    );

    // Amostragem inteligente para não sobrecarregar o Recharts com 360/420 pontos individuais
    const step = maxMonths > 120 ? Math.ceil(maxMonths / 60) : 1;

    for (let k = 1; k <= maxMonths; k += step) {
      const activeInst = result.installments.find((i) => i.month === k);
      const baseInst = baseResult?.installments.find((i) => i.month === k);

      // Se já quitou, saldo é 0
      const balanceWithExtra = activeInst ? activeInst.closingBalance : 0;
      const balanceOriginal = baseInst ? baseInst.closingBalance : (activeInst ? activeInst.closingBalance : 0);

      data.push({
        month: k,
        label: `Mês ${k}`,
        year: `Ano ${(k / 12).toFixed(1)}`,
        saldoComAportes: Math.round(balanceWithExtra),
        saldoOriginal: Math.round(balanceOriginal)
      });
    }

    // Garante que o último mês do cronograma seja incluído
    const lastMonth = maxMonths;
    if (!data.some((d) => d.month === lastMonth)) {
      const activeInst = result.installments.find((i) => i.month === lastMonth);
      const baseInst = baseResult?.installments.find((i) => i.month === lastMonth);
      data.push({
        month: lastMonth,
        label: `Mês ${lastMonth}`,
        year: `Ano ${(lastMonth / 12).toFixed(1)}`,
        saldoComAportes: activeInst ? Math.round(activeInst.closingBalance) : 0,
        saldoOriginal: baseInst ? Math.round(baseInst.closingBalance) : 0
      });
    }

    return data;
  }, [result, baseResult]);

  // Prepara dados de Decomposição do Encargo Mensal
  const compositionChartData = useMemo(() => {
    const data: any[] = [];
    const installments = result.installments;
    const step = installments.length > 120 ? Math.ceil(installments.length / 50) : 1;

    for (let i = 0; i < installments.length; i += step) {
      const inst = installments[i];
      data.push({
        month: inst.month,
        label: `Mês ${inst.month}`,
        amortizacao: Math.round(inst.regularAmortization),
        juros: Math.round(inst.interest),
        segurosETaxas: Math.round(inst.totalInsuranceAndFees),
        total: Math.round(inst.totalInstallment)
      });
    }
    return data;
  }, [result]);

  return (
    <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {activeChart === 'balance' ? (
            <TrendingDown size={18} className="text-secondary" />
          ) : (
            <Layers size={18} className="text-primary" />
          )}
          <div>
            <h3 className="font-bold text-sm text-white">
              {activeChart === 'balance' ? 'Curva de Amortização do Saldo Devedor' : 'Decomposição do Encargo Mensal'}
            </h3>
            <p className="text-[10px] text-white/40">
              {activeChart === 'balance'
                ? 'Evolução da dívida restante até a quitação final'
                : 'Divisão mensal entre amortização do principal, juros remuneratórios e seguros'}
            </p>
          </div>
        </div>

        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveChart('balance')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeChart === 'balance'
                ? 'bg-secondary text-white shadow-md shadow-secondary/20'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Curva do Saldo
          </button>
          <button
            type="button"
            onClick={() => setActiveChart('composition')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeChart === 'composition'
                ? 'bg-primary text-black font-black shadow-md shadow-primary/20'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Decomposição da Parcela
          </button>
        </div>
      </div>

      <div className="h-[280px] sm:h-[340px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {activeChart === 'balance' ? (
            <AreaChart data={balanceChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSaldoComAportes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorSaldoOriginal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}
                tickFormatter={(val) => formatCurrency(val)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '12px'
                }}
                formatter={(value: any, name: any) => [
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                  name === 'saldoComAportes' ? 'Com Aportes Extras' : 'Cenário Original'
                ]}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                formatter={(value) => (value === 'saldoComAportes' ? 'Com Estratégia de Aportes' : 'Cenário Base')}
              />
              {isExtraEnabled && (
                <Area
                  type="monotone"
                  dataKey="saldoOriginal"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="url(#colorSaldoOriginal)"
                  name="saldoOriginal"
                />
              )}
              <Area
                type="monotone"
                dataKey="saldoComAportes"
                stroke="#10b981"
                strokeWidth={3}
                fill="url(#colorSaldoComAportes)"
                name="saldoComAportes"
              />
            </AreaChart>
          ) : (
            <AreaChart data={compositionChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAmort" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorJuros" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorSeguros" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}
                tickFormatter={(val) => formatCurrency(val)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '0.75rem',
                  color: '#fff',
                  fontSize: '12px'
                }}
                formatter={(value: any, name: any) => [
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                  name === 'amortizacao' ? 'Amortização Principal' : name === 'juros' ? 'Juros' : 'Seguros e Taxas'
                ]}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                formatter={(value) => (value === 'amortizacao' ? 'Amortização Principal' : value === 'juros' ? 'Juros Remuneratórios' : 'Seguros e Tarifas')}
              />
              <Area
                type="monotone"
                dataKey="segurosETaxas"
                stackId="1"
                stroke="#0ea5e9"
                fill="url(#colorSeguros)"
                name="segurosETaxas"
              />
              <Area
                type="monotone"
                dataKey="juros"
                stackId="1"
                stroke="#f43f5e"
                fill="url(#colorJuros)"
                name="juros"
              />
              <Area
                type="monotone"
                dataKey="amortizacao"
                stackId="1"
                stroke="#10b981"
                fill="url(#colorAmort)"
                name="amortizacao"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
