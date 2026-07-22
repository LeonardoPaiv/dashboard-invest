import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, PieChart as PieChartIcon, ArrowUpCircle, ArrowDownCircle, ChevronDown, Check, Wallet, Camera, History as HistoryIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useInvestmentStore, MonthlyItem } from '../store/useInvestmentStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#a855f7', '#06b6d4'];

export const PlanoMensal = ({ setActiveTab }: { setActiveTab: (tab: any) => void }) => {
  const { monthlyPlan, setMonthlyPlan, setContributionAmount, addMonthlySnapshot } = useInvestmentStore();
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false);
  const [newItem, setNewItem] = useState<{ name: string; value: string; type: 'income' | 'expense'; category: string }>({
    name: '',
    value: '',
    type: 'income',
    category: 'Outros'
  });
  const [filterCategory, setFilterCategory] = useState<string>('Todos');

  const totalIncomes = useMemo(() => 
    monthlyPlan.incomes.reduce((acc, curr) => acc + curr.value, 0),
  [monthlyPlan.incomes]);

  const totalExpenses = useMemo(() => 
    monthlyPlan.expenses.reduce((acc, curr) => acc + curr.value, 0),
  [monthlyPlan.expenses]);

  const balance = totalIncomes - totalExpenses;

  const chartData = useMemo(() => {
    const categories: Record<string, number> = {};
    monthlyPlan.expenses.forEach(item => {
      categories[item.category] = (categories[item.category] || 0) + item.value;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [monthlyPlan.expenses]);

  const handleAddItem = (type: 'income' | 'expense') => {
    if (!newItem.name || !newItem.value) return;

    const item: MonthlyItem = {
      id: crypto.randomUUID(),
      name: newItem.name,
      value: parseFloat(newItem.value),
      category: newItem.category
    };

    if (type === 'income') {
      setMonthlyPlan({
        ...monthlyPlan,
        incomes: [...monthlyPlan.incomes, item]
      });
    } else {
      setMonthlyPlan({
        ...monthlyPlan,
        expenses: [...monthlyPlan.expenses, item]
      });
    }

    setNewItem({ name: '', value: '', type, category: 'Outros' });
  };

  const handleRemoveItem = (id: string, type: 'income' | 'expense') => {
    if (type === 'income') {
      setMonthlyPlan({
        ...monthlyPlan,
        incomes: monthlyPlan.incomes.filter(i => i.id !== id)
      });
    } else {
      setMonthlyPlan({
        ...monthlyPlan,
        expenses: monthlyPlan.expenses.filter(i => i.id !== id)
      });
    }
  };

  const handleAddCategory = (category: string) => {
    if (!category || monthlyPlan.categories.includes(category)) return;
    setMonthlyPlan({
      ...monthlyPlan,
      categories: [category, ...monthlyPlan.categories]
    });
  };

  const handleCreateSnapshot = (resetExpenses: boolean) => {
    const today = new Date();
    const monthYear = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    
    addMonthlySnapshot({
      id: crypto.randomUUID(),
      date: monthYear,
      incomes: [...monthlyPlan.incomes],
      expenses: [...monthlyPlan.expenses],
      totalIncome: totalIncomes,
      totalExpense: totalExpenses,
      savings: balance
    }, resetExpenses);
    
    setShowSnapshotDialog(false);
  };

  const snapshotModalContent = showSnapshotDialog ? (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border border-white/10 rounded-[32px] p-6 sm:p-8 flex flex-col gap-6 shadow-2xl relative">
        <button 
          onClick={() => setShowSnapshotDialog(false)}
          className="absolute top-6 right-6 p-2 text-white/20 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col gap-2">
          <div className="p-3.5 bg-primary/10 w-fit rounded-2xl">
            <Camera size={28} className="text-primary" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-white">Gerar Snapshot Mensal</h3>
          <p className="text-white/40 text-xs sm:text-sm font-medium">Como você deseja lidar com os gastos para o próximo mês?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={() => handleCreateSnapshot(true)}
            className="p-5 bg-white/5 border border-white/10 rounded-3xl flex flex-col gap-3 text-center items-center hover:bg-primary/10 hover:border-primary/30 transition-all group"
          >
            <div className="p-3 bg-white/5 rounded-xl group-hover:bg-primary/20 transition-all">
              <Trash2 size={22} className="text-white/40 group-hover:text-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-black uppercase tracking-widest text-xs text-white">Zerar Gastos</span>
              <span className="text-[10px] text-white/40 font-medium leading-relaxed">Limpa todas as despesas para o novo mês.</span>
            </div>
          </button>

          <button 
            onClick={() => handleCreateSnapshot(false)}
            className="p-5 bg-white/5 border border-white/10 rounded-3xl flex flex-col gap-3 text-center items-center hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group"
          >
            <div className="p-3 bg-white/5 rounded-xl group-hover:bg-emerald-500/20 transition-all">
              <Check size={22} className="text-white/40 group-hover:text-emerald-500" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-black uppercase tracking-widest text-xs text-white">Manter Gastos</span>
              <span className="text-[10px] text-white/40 font-medium leading-relaxed">Mantém as despesas atuais para acompanhamento.</span>
            </div>
          </button>
        </div>

        <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-2xl text-[10px] text-primary/70 font-bold uppercase tracking-widest text-center">
          DICA: Use snapshots para arquivar o fechamento do seu mês financeiro.
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="p-4 md:p-8 flex-1 h-full flex flex-col gap-6 md:gap-8 overflow-y-auto custom-scrollbar bg-background relative">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            <Wallet className="text-primary" size={28} />
            PLANO MENSAL
          </h1>
          <p className="text-xs md:text-sm text-white/40 font-medium">Gerencie seus recebimentos e gastos mensais para otimizar seus aportes.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('history')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white/70 font-black uppercase tracking-widest text-[11px] hover:bg-white/10 hover:text-white transition-all shadow-lg"
          >
            <HistoryIcon size={16} />
            Histórico
          </button>
          
          <button 
            onClick={() => setShowSnapshotDialog(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Camera size={16} />
            Snapshot
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 min-h-0 lg:h-[calc(100vh-180px)]">
          {/* Recebimentos */}
          <section className="bg-card/50 border border-white/10 rounded-3xl p-5 md:p-6 flex flex-col gap-5 md:gap-6 backdrop-blur-xl min-h-[420px] lg:h-full overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                <ArrowUpCircle className="text-emerald-500" size={20} />
                Recebimentos
              </h2>
              <span className="text-emerald-500 font-black text-base md:text-lg">
                {totalIncomes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <input 
                type="text" 
                placeholder="Nome do item"
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
                value={newItem.type === 'income' ? newItem.name : ''}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value, type: 'income' })}
              />
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Valor"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium min-w-0"
                  value={newItem.type === 'income' ? newItem.value : ''}
                  onChange={(e) => setNewItem({ ...newItem, value: e.target.value, type: 'income' })}
                />
                <CategorySelector 
                  selected={newItem.type === 'income' ? newItem.category : 'Outros'}
                  onSelect={(cat) => setNewItem({ ...newItem, category: cat, type: 'income' })}
                  categories={monthlyPlan.categories}
                  onAddCategory={handleAddCategory}
                />
                <button 
                  onClick={() => handleAddItem('income')}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-3 py-2.5 transition-colors flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1 min-h-[180px]">
              <AnimatePresence mode="popLayout">
                {monthlyPlan.incomes.map((item) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-xs md:text-sm tracking-wide text-white">{item.name}</span>
                      <span className="text-[9px] text-white/40 uppercase font-black tracking-widest">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-emerald-400 text-xs md:text-sm">
                        {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <button 
                        onClick={() => handleRemoveItem(item.id, 'income')}
                        className="text-white/20 hover:text-red-400 transition-colors opacity-100 lg:opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          {/* Gastos */}
          <section className="bg-card/50 border border-white/10 rounded-3xl p-5 md:p-6 flex flex-col gap-5 md:gap-6 backdrop-blur-xl min-h-[420px] lg:h-full overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                <ArrowDownCircle className="text-rose-500" size={20} />
                Gastos
              </h2>
              <span className="text-rose-500 font-black text-base md:text-lg">
                {totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <input 
                type="text" 
                placeholder="Nome da despesa"
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
                value={newItem.type === 'expense' ? newItem.name : ''}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value, type: 'expense' })}
              />
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Valor"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium min-w-0"
                  value={newItem.type === 'expense' ? newItem.value : ''}
                  onChange={(e) => setNewItem({ ...newItem, value: e.target.value, type: 'expense' })}
                />
                <CategorySelector 
                  selected={newItem.type === 'expense' ? newItem.category : 'Outros'}
                  onSelect={(cat) => setNewItem({ ...newItem, category: cat, type: 'expense' })}
                  categories={monthlyPlan.categories}
                  onAddCategory={handleAddCategory}
                />
                <button 
                  onClick={() => handleAddItem('expense')}
                  className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl px-3 py-2.5 transition-colors flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1 min-h-[180px]">
              <AnimatePresence mode="popLayout">
                {monthlyPlan.expenses.map((item) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-xs md:text-sm tracking-wide text-white">{item.name}</span>
                      <span className="text-[9px] text-white/40 uppercase font-black tracking-widest">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-rose-400 text-xs md:text-sm">
                        {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <button 
                        onClick={() => handleRemoveItem(item.id, 'expense')}
                        className="text-white/20 hover:text-red-400 transition-colors opacity-100 lg:opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          {/* Visão Geral */}
          <section className="flex flex-col gap-5 md:gap-6 min-h-[450px] lg:h-full overflow-hidden">
            <div className="bg-card/50 border border-white/10 rounded-3xl p-5 md:p-6 flex flex-col backdrop-blur-xl flex-1 min-h-0 overflow-hidden">
              <h2 className="text-base md:text-lg font-bold mb-3 flex items-center gap-2 uppercase tracking-tighter shrink-0 text-white">
                <PieChartIcon size={18} className="text-primary" />
                Distribuição de Gastos
              </h2>
              
              {/* Chart Area */}
              <div className="h-[180px] md:h-[40%] w-full flex items-center gap-3 mb-4 shrink-0 overflow-hidden">
                <div className="flex-1 h-full min-w-0">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                        >
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                          formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 gap-2">
                      <PieChartIcon size={36} />
                      <span className="text-xs font-bold uppercase tracking-widest">Sem dados</span>
                    </div>
                  )}
                </div>

                {/* Lateral Legend */}
                <div className="flex flex-col gap-1.5 max-h-full overflow-y-auto custom-scrollbar py-1 w-28 border-l border-white/5 pl-3 shrink-0">
                  {chartData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-1.5 shrink-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-[9px] font-bold uppercase text-white/50 truncate">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Area */}
              <div className="flex-1 flex flex-col min-h-[150px] border-t border-white/10 pt-4 overflow-hidden">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Gasto Total</span>
                    <span className="text-base font-black text-rose-500">
                      {totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  
                  <div className="relative">
                    <select 
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="bg-white/5 border border-white/12 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white focus:outline-none focus:border-primary/50 transition-all cursor-pointer appearance-none pr-7 w-36"
                    >
                      <option className='text-[11px] bg-[#1a1c1e] text-white' value="Todos">Todas</option>
                      {monthlyPlan.categories.map(cat => (
                        <option className='text-[11px] bg-[#1a1c1e] text-white' key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                  </div>
                </div>

                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar pr-1">
                  <table className="w-full text-left border-separate border-spacing-y-1 text-xs min-w-[280px]">
                    <thead className="sticky top-0 bg-[#141415] z-10">
                      <tr className="text-[10px] font-black uppercase text-white/30">
                        <th className="pb-1">Descrição</th>
                        <th className="pb-1">Valor</th>
                        <th className="pb-1 text-right">% Gast.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyPlan.expenses
                        .filter(item => filterCategory === 'Todos' || item.category === filterCategory)
                        .map((item) => {
                          const percentOfExpenses = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0;
                          return (
                            <tr key={item.id} className="group/row">
                              <td className="py-1.5 pr-2">
                                <div className="flex flex-col">
                                  <span className="font-bold text-white/80 text-xs truncate">{item.name}</span>
                                  <span className="text-[9px] text-white/30 font-bold uppercase">{item.category}</span>
                                </div>
                              </td>
                              <td className="py-1.5 text-xs font-black text-rose-400">
                                {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                              </td>
                              <td className="py-1.5 text-right">
                                <span className="text-[11px] font-bold text-white/50">{percentOfExpenses.toFixed(1)}%</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Valor Restante */}
            <div className={cn(
              "rounded-3xl p-5 flex flex-col gap-2 transition-all duration-500 shrink-0",
              balance >= 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-rose-500/10 border border-rose-500/20"
            )}>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Valor Restante</span>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className={cn(
                  "text-2xl font-black tracking-tight",
                  balance >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <button 
                  onClick={() => {
                    setContributionAmount(balance);
                    setActiveTab('strategy');
                  }}
                  className={cn(
                    "px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                    balance >= 0 ? "bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-400/20" : "bg-rose-400 text-rose-950 shadow-lg shadow-rose-400/20"
                  )}
                >
                  Planejar Aporte
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {createPortal(snapshotModalContent, document.body)}
    </div>
  );
};

const CategorySelector = ({ selected, onSelect, categories, onAddCategory }: { 
  selected: string; 
  onSelect: (cat: string) => void;
  categories: string[];
  onAddCategory: (cat: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const popperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popperRef.current && !popperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCategories = categories.filter(c => 
    c.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="relative shrink-0" ref={popperRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none hover:bg-white/10 transition-all font-bold flex items-center justify-between gap-1.5 min-w-[90px]"
      >
        <span className="truncate">{selected}</span>
        <ChevronDown size={14} className={cn("transition-transform shrink-0", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 10, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full mt-2 right-0 w-56 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-3xl"
          >
            <div className="p-2.5 border-b border-white/10">
              <div className="relative">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Nova categoria..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-3 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchValue) {
                      onAddCategory(searchValue);
                      onSelect(searchValue);
                      setSearchValue('');
                      setIsOpen(false);
                    }
                  }}
                />
                {searchValue && !categories.includes(searchValue) && (
                  <button 
                    onClick={() => {
                      onAddCategory(searchValue);
                      onSelect(searchValue);
                      setSearchValue('');
                      setIsOpen(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary-light"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-44 overflow-y-auto p-1.5 custom-scrollbar">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      onSelect(cat);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold transition-all mb-0.5",
                      selected === cat ? "bg-primary text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {cat}
                    {selected === cat && <Check size={14} />}
                  </button>
                ))
              ) : (
                <div className="p-3 text-center text-white/20 text-[10px] font-black uppercase tracking-widest">
                  Nenhuma categoria
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
