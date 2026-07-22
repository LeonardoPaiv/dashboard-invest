import { useMemo } from 'react';
import { History as HistoryIcon, TrendingUp, Calendar, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useInvestmentStore, MonthlySnapshot } from '../store/useInvestmentStore';
import { motion, AnimatePresence } from 'framer-motion';

export const History = () => {
  const { monthlySnapshots, deleteMonthlySnapshot } = useInvestmentStore();

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    monthlySnapshots.forEach(s => {
      s.expenses.forEach(e => cats.add(e.category));
    });
    return Array.from(cats);
  }, [monthlySnapshots]);

  const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#a855f7', '#06b6d4'];

  const chartData = useMemo(() => {
    // Reverse snapshots to show chronological order in chart (oldest to newest)
    return [...monthlySnapshots].reverse().map(s => {
      const data: any = {
        date: s.date,
        Receitas: s.totalIncome,
        Gastos: s.totalExpense,
        Economia: s.savings
      };
      
      // Initialize all categories to 0
      allCategories.forEach(cat => data[cat] = 0);
      
      // Sum values for each category in this snapshot
      s.expenses.forEach(e => {
        data[e.category] = (data[e.category] || 0) + e.value;
      });
      
      return data;
    });
  }, [monthlySnapshots, allCategories]);

  // Group snapshots by year for easier navigation
  const snapshotsByYear = useMemo(() => {
    const groups: Record<string, MonthlySnapshot[]> = {};
    monthlySnapshots.forEach(s => {
      const year = s.date.split('/')[1] || new Date().getFullYear().toString();
      if (!groups[year]) groups[year] = [];
      groups[year].push(s);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthlySnapshots]);

  if (monthlySnapshots.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in duration-700">
        <div className="p-5 bg-white/5 rounded-full ring-1 ring-white/10">
          <HistoryIcon size={40} className="text-white/20" />
        </div>
        <div className="max-w-md">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight mb-2 text-white">Sem Histórico Mensal</h2>
          <p className="text-xs md:text-sm text-white/40 font-medium">
            Gere snapshots no seu <span className="text-primary">Plano Mensal</span> para começar a acompanhar a evolução das suas finanças ao longo do tempo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 overflow-y-auto bg-background/50 backdrop-blur-sm animate-in fade-in duration-500 custom-scrollbar">
      <header className="flex flex-col gap-1 shrink-0">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 text-white">
          <HistoryIcon className="text-primary" size={28} />
          HISTÓRICO FINANCEIRO
        </h1>
        <p className="text-xs md:text-sm text-white/40 font-medium">Acompanhe a evolução das suas receitas e despesas ao longo do tempo.</p>
      </header>

      {/* Chart Section */}
      <section className="bg-card/50 border border-white/10 rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-xl shadow-2xl shadow-black/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-base sm:text-xl font-bold flex items-center gap-2.5 uppercase tracking-tighter text-white">
            <TrendingUp size={18} className="text-primary" />
            Evolução Mensal
          </h2>
          <div className="flex flex-wrap gap-2.5 sm:gap-4 items-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Receitas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/20" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Gasto Total</span>
            </div>
            {allCategories.map((cat, index) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full opacity-60" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{cat}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[250px] sm:h-[350px] md:h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }} 
                tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '12px' }}
                itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 0' }}
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                formatter={(value: number, name: string) => [
                  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                  name === 'Gastos' ? 'Total Gasto' : name
                ]}
                itemSorter={(item) => (item.name === 'Receitas' || item.name === 'Gastos') ? -1 : 1}
              />
              <Legend verticalAlign="top" height={36} content={() => null} />
              <Area 
                type="monotone" 
                dataKey="Receitas" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorIncome)" 
              />
              
              {allCategories.map((cat, index) => (
                <Area 
                  key={cat}
                  type="monotone" 
                  dataKey={cat} 
                  stroke={COLORS[index % COLORS.length]} 
                  strokeWidth={1}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.2}
                  stackId="expenses"
                />
              ))}

              <Area 
                type="monotone" 
                dataKey="Gastos" 
                stroke="#ef4444" 
                strokeWidth={3}
                fill="transparent"
                fillOpacity={0}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Snapshots List */}
      <div className="space-y-6">
        {snapshotsByYear.map(([year, snapshots]) => (
          <div key={year} className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 pl-2 border-l-2 border-primary/40 ml-1">Ano {year}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <AnimatePresence mode="popLayout">
                {snapshots.map((snapshot) => (
                  <motion.div
                    layout
                    key={snapshot.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="p-5 md:p-6 bg-card/40 border border-white/10 rounded-3xl space-y-4 hover:bg-card/60 hover:border-white/20 transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <Calendar size={16} className="text-primary" />
                        </div>
                        <span className="font-black text-base md:text-lg uppercase tracking-wider text-white">{snapshot.date}</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (confirm('Deseja excluir este snapshot?')) {
                            deleteMonthlySnapshot(snapshot.id);
                          }
                        }}
                        className="p-2 text-white/20 hover:text-rose-500 transition-colors opacity-100 lg:opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 opacity-40">
                          <ArrowUpCircle size={12} className="text-emerald-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white">Receitas</span>
                        </div>
                        <p className="text-xs md:text-sm font-black text-emerald-400">
                          {snapshot.totalIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 opacity-40">
                          <ArrowDownCircle size={12} className="text-rose-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white">Gastos</span>
                        </div>
                        <p className="text-xs md:text-sm font-black text-rose-400">
                          {snapshot.totalExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Economia</span>
                        <span className="text-base font-black text-white">
                          {snapshot.savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Fator Poupança</span>
                        <span className="text-base font-black text-primary">
                          {((snapshot.savings / snapshot.totalIncome) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
