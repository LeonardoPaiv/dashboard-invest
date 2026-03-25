import { useState, useMemo } from 'react';
import { useInvestmentStore } from '../store/useInvestmentStore';
import { TrendingUp, RotateCcw, DollarSign, Calendar, Percent, Landmark } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const Projection = () => {
  const { portfolio } = useInvestmentStore();
  const initialInvested = portfolio?.total_live || 0;

  const [initialCapital, setInitialCapital] = useState(initialInvested);
  const [monthlyContribution, setMonthlyContribution] = useState(1000);
  const [annualRate, setAnnualRate] = useState(10);
  const [years, setYears] = useState(10);

  const projectionData = useMemo(() => {
    const data = [];
    const months = years * 12;
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;

    let currentTotal = initialCapital;
    let currentInvested = initialCapital;

    data.push({
      name: 'Mês 0',
      total: Math.round(currentTotal),
      invested: Math.round(currentInvested),
      interest: 0
    });

    for (let i = 1; i <= months; i++) {
      currentTotal = currentTotal * (1 + monthlyRate) + monthlyContribution;
      currentInvested += monthlyContribution;

      // Add data points every year or if it's the last month
      if (i % 12 === 0 || i === months) {
        data.push({
          name: `Ano ${i / 12}`,
          total: Math.round(currentTotal),
          invested: Math.round(currentInvested),
          interest: Math.round(currentTotal - currentInvested)
        });
      }
    }
    return data;
  }, [initialCapital, monthlyContribution, annualRate, years]);

  const finalResult = projectionData[projectionData.length - 1];

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto no-scrollbar">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Projeção de Patrimônio</h2>
        <p className="text-white/40">Simule a evolução do seu capital ao longo do tempo com juros compostos.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Controls Card */}
        <div className="xl:col-span-1 space-y-6">
          <Card title="Configurações" icon={<Landmark className="text-primary" size={20} />}>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-end mb-1">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">Capital Inicial</label>
                  <button
                    onClick={() => setInitialCapital(initialInvested)}
                    className="text-[9px] font-black text-primary hover:text-primary-hover flex items-center gap-1 transition-colors uppercase"
                  >
                    <RotateCcw size={10} /> Resetar
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-sm">R$</span>
                  <input
                    type="number"
                    value={initialCapital.toFixed(2)}
                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-10 text-lg font-bold text-white focus:border-primary/50 outline-none transition-all"
                  />
                </div>
              </div>

              <Input
                label="Aporte Mensal (R$)"
                value={monthlyContribution}
                onChange={(e: any) => setMonthlyContribution(Number(e.target.value))}
                icon={<DollarSign size={14} className="text-white/20" />}
              />

              <Input
                label="Taxa Anual (%)"
                value={annualRate}
                onChange={(e: any) => setAnnualRate(Number(e.target.value))}
                icon={<Percent size={14} className="text-white/20" />}
              />

              <Input
                label="Tempo (Anos)"
                value={years}
                onChange={(e: any) => setYears(Number(e.target.value))}
                icon={<Calendar size={14} className="text-white/20" />}
              />
            </div>
          </Card>
        </div>

        {/* Chart Card */}
        <div className="xl:col-span-3">
          <Card title="Gráfico de Evolução" icon={<TrendingUp className="text-secondary" size={20} />}>
            <div className="h-[500px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value) => `R$ ${value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : (value / 1000).toFixed(0) + 'k'}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                    name="Patrimônio Total"
                  />
                  <Area
                    type="monotone"
                    dataKey="invested"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorInvested)"
                    name="Total Investido"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

      </div>
        {/* Highlights Card */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard
            label="Total Acumulado"
            value={formatCurrency(finalResult.total)}
            subValue="Patrimônio final projetado"
            color="text-primary"
          />
          <SummaryCard
            label="Total Investido"
            value={formatCurrency(finalResult.invested)}
            subValue="Soma de todos os aportes"
            color="text-white/60"
          />
          <SummaryCard
            label="Total em Juros"
            value={formatCurrency(finalResult.interest)}
            subValue="Rendimento bruto do período"
            color="text-emerald-500"
          />
        </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl">
        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-8 items-center">
              <span className="text-xs font-bold text-white/60">{entry.name}:</span>
              <span className={`text-sm font-black ${entry.dataKey === 'total' ? 'text-primary' : 'text-white'}`}>
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
          <div className="flex justify-between gap-8 items-center border-t border-white/5 mt-2 pt-2">
            <span className="text-xs font-bold text-emerald-500/60">Juros Acumulados:</span>
            <span className="text-sm font-black text-emerald-500">
              {formatCurrency(payload[0].payload.interest)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const Card = ({ title, icon, children }: any) => (
  <div className="bg-card border border-white/10 rounded-[32px] p-6 h-full flex flex-col shadow-2xl overflow-hidden relative group">
    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/2 rounded-full -mr-16 -mt-16 blur-3xl" />
    <div className="flex items-center gap-3 mb-6 relative z-10">
      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">{icon}</div>
      <h3 className="text-lg font-black tracking-tight">{title}</h3>
    </div>
    <div className="flex-1 relative z-10">{children}</div>
  </div>
);

const Input = ({ label, value, onChange, icon }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">{label}</label>
    <div className="relative">
      {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2">{icon}</div>}
      <input
        type="number"
        value={value}
        onChange={onChange}
        className={`w-full bg-white/5 border border-white/10 rounded-2xl p-4 ${icon ? 'pl-10' : ''} text-sm font-bold text-white focus:border-primary/50 outline-none transition-all`}
      />
    </div>
  </div>
);

const SummaryCard = ({ label, value, subValue, color }: any) => (
  <div className="bg-white/2 border border-white/5 rounded-3xl p-6 flex flex-col relative overflow-hidden group hover:bg-white/5 transition-all">
    <div className={`absolute top-0 right-0 w-16 h-16 opacity-5 blur-xl -mr-8 -mt-8 rounded-full ${color.replace('text', 'bg')}`} />
    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">{label}</span>
    <span className={`text-2xl font-black tracking-tight ${color}`}>{value}</span>
    <span className="text-[10px] font-medium text-white/20 uppercase tracking-wider mt-1">{subValue}</span>
  </div>
);
