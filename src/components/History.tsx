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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 animate-in fade-in duration-700">
        <div className="p-6 bg-white/5 rounded-full ring-1 ring-white/10">
          <HistoryIcon size={48} className="text-white/20" />
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Sem Histórico Mensal</h2>
          <p className="text-white/40 font-medium">
            Gere snapshots no seu <span className="text-primary">Plano Mensal</span> para começar a acompanhar a evolução das suas finanças ao longo do tempo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto bg-background/50 backdrop-blur-sm animate-in fade-in duration-500 custom-scrollbar">
      <header className="flex flex-col gap-2 shrink-0">
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <HistoryIcon className="text-primary" size={32} />
          HISTÓRICO FINANCEIRO
        </h1>
        <p className="text-white/40 font-medium">Acompanhe a evolução das suas receitas e despesas ao longo do tempo.</p>
      </header>

      {/* Chart Section */}
      <section className="bg-card/50 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold flex items-center gap-3 uppercase tracking-tighter">
                <TrendingUp size={20} className="text-primary" />
                Evolução Mensal
            </h2>
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Receitas</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-500/20" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Gasto Total</span>
                </div>
                {allCategories.map((cat, index) => (
                  <div key={cat} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full opacity-60" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">{cat}</span>
                  </div>
                ))}
            </div>
        </div>

        <div className="h-[400px] w-full">
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
                tickFormatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
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
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white/20 pl-2 border-l-2 border-primary/30 ml-2">Ano {year}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {snapshots.map((snapshot) => (
                  <motion.div
                    layout
                    key={snapshot.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="p-6 bg-card/40 border border-white/10 rounded-3xl space-y-4 hover:bg-card/60 hover:border-white/20 transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <Calendar size={18} className="text-primary" />
                        </div>
                        <span className="font-black text-lg uppercase tracking-wider">{snapshot.date}</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (confirm('Deseja excluir este snapshot?')) {
                            deleteMonthlySnapshot(snapshot.id);
                          }
                        }}
                        className="p-2 text-white/20 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 opacity-40">
                                <ArrowUpCircle size={12} className="text-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Receitas</span>
                            </div>
                            <p className="text-sm font-black text-emerald-400">
                                {snapshot.totalIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 opacity-40">
                                <ArrowDownCircle size={12} className="text-rose-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Gastos</span>
                            </div>
                            <p className="text-sm font-black text-rose-400">
                                {snapshot.totalExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Economia</span>
                            <span className="text-lg font-black text-white">
                                {snapshot.savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Fator Poupança</span>
                            <span className="text-lg font-black text-primary">
                                {((snapshot.savings / snapshot.totalIncome) * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>

                    {/* Simple detail hover */}
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
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
