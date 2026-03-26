import { useState, useMemo, useRef, useEffect } from 'react';
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

  return (
    <div className="p-8 h-full flex flex-col gap-8 overflow-hidden box-border bg-background relative">
      <header className="flex flex-col gap-2 shrink-0 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Wallet className="text-primary" size={32} />
            PLANO MENSAL
          </h1>
          <p className="text-white/40 font-medium">Gerencie seus recebimentos e gastos mensais para otimizar seus aportes.</p>
        </div>

        <div className="flex items-center gap-3 mt-4 lg:mt-0">
          <button 
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-white/60 font-black uppercase tracking-widest text-xs hover:bg-white/10 hover:text-white transition-all shadow-lg shadow-black/20"
          >
            <HistoryIcon size={18} />
            Ver Histórico
          </button>
          
          <button 
            onClick={() => setShowSnapshotDialog(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Camera size={18} />
            Gerar Snapshot
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-180px)] overflow-hidden">
          {/* Recebimentos */}
          <section className="bg-card/50 border border-white/10 rounded-3xl p-6 flex flex-col gap-6 backdrop-blur-xl h-full overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ArrowUpCircle className="text-emerald-500" />
                Recebimentos
              </h2>
              <span className="text-emerald-500 font-black text-lg">
                {totalIncomes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <div className="flex flex-col gap-3 shrink-0">
              <div className="grid grid-cols-1 gap-2">
                <input 
                  type="text" 
                  placeholder="Nome do item"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-all font-medium"
                  value={newItem.type === 'income' ? newItem.name : ''}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value, type: 'income' })}
                />
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    placeholder="Valor"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-all font-medium"
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
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl p-2 transition-colors flex items-center justify-center aspect-square shadow-lg shadow-emerald-500/20"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
              <AnimatePresence mode="popLayout">
                {monthlyPlan.incomes.map((item) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-sm tracking-wide">{item.name}</span>
                      <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-black text-emerald-400">
                        {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <button 
                        onClick={() => handleRemoveItem(item.id, 'income')}
                        className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          {/* Gastos */}
          <section className="bg-card/50 border border-white/10 rounded-3xl p-6 flex flex-col gap-6 backdrop-blur-xl h-full overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ArrowDownCircle className="text-rose-500" />
                Gastos
              </h2>
              <span className="text-rose-500 font-black text-lg">
                {totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <div className="flex flex-col gap-3 shrink-0">
              <div className="grid grid-cols-1 gap-2">
                <input 
                  type="text" 
                  placeholder="Nome da despesa"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-all font-medium"
                  value={newItem.type === 'expense' ? newItem.name : ''}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value, type: 'expense' })}
                />
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    placeholder="Valor"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-all font-medium"
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
                    className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl p-2 transition-colors flex items-center justify-center aspect-square shadow-lg shadow-rose-500/20"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
              <AnimatePresence mode="popLayout">
                {monthlyPlan.expenses.map((item) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-sm tracking-wide">{item.name}</span>
                      <span className="text-[10px] text-white/40 uppercase font-black tracking-widest">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-black text-rose-400">
                        {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <button 
                        onClick={() => handleRemoveItem(item.id, 'expense')}
                        className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          {/* Visão Geral */}
          <section className="flex flex-col gap-6 h-full overflow-hidden">
            <div className="bg-card/50 border border-white/10 rounded-3xl p-6 flex flex-col backdrop-blur-xl flex-1 min-h-0 overflow-hidden">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 uppercase tracking-tighter shrink-0">
                <PieChartIcon size={20} className="text-primary" />
                Distribuição de Gastos
              </h2>
              
              {/* Chart Area - Fixed at Top */}
              <div className="h-[40%] w-full flex items-center gap-4 mb-4 shrink-0 overflow-hidden">
                <div className="flex-1 h-full min-w-0">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                          formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 gap-3">
                      <PieChartIcon size={48} />
                      <span className="text-sm font-bold uppercase tracking-widest">Sem dados</span>
                    </div>
                  )}
                </div>

                {/* Lateral Legend */}
                <div className="flex flex-col gap-2 max-h-full overflow-y-auto no-scrollbar py-2 w-32 border-l border-white/5 pl-4 shrink-0">
                  {chartData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2 group/legend cursor-default shrink-0">
                      <div className="w-2 h-2 rounded-full shrink-0 shadow-lg shadow-white/5" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-[9px] font-black uppercase tracking-wider text-white/40 group-hover/legend:text-white transition-colors truncate">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table Area - Scrollable at Bottom */}
              <div className="flex-1 flex flex-col min-h-0 border-t border-white/10 pt-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Gasto Total</span>
                    <span className="text-xl font-black text-rose-500">
                      {totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  
                  <div className="relative group/filter">
                     <select 
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="bg-white/5 border border-white/12 rounded-xl px-3 py-1.5 text-[12px] font-black uppercase tracking-widest focus:outline-none focus:border-primary/50 transition-all cursor-pointer appearance-none pr-8 w-48"
                     >
                       <option className='text-[12px] font-black uppercase tracking-widest' value="Todos">Todas Categorias</option>
                       {monthlyPlan.categories.map(cat => (
                         <option className='text-[12px] font-black uppercase tracking-widest' key={cat} value={cat}>{cat}</option>
                       ))}
                     </select>
                     <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead className="sticky top-0 bg-[#141415] z-10">
                      <tr className="text-[12px] font-black uppercase tracking-[0.2em] text-white/20">
                        <th className="pb-2">Descrição</th>
                        <th className="pb-2">Valor</th>
                        <th className="pb-2 text-right">% Gasto</th>
                        <th className="pb-2 text-right pr-4">% Rec.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyPlan.expenses
                        .filter(item => filterCategory === 'Todos' || item.category === filterCategory)
                        .map((item) => {
                          const percentOfExpenses = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0;
                          const percentOfIncomes = totalIncomes > 0 ? (item.value / totalIncomes) * 100 : 0;
                          
                          return (
                            <tr key={item.id} className="group/row">
                              <td className="py-2 pr-2">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-white/80 group-hover/row:text-white transition-colors">{item.name}</span>
                                  <span className="text-[12px] text-white/20 font-black uppercase">{item.category}</span>
                                </div>
                              </td>
                              <td className="py-2 text-xs font-black text-rose-400">
                                {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' , minimumFractionDigits: 0, maximumFractionDigits: 0})}
                              </td>
                              <td className="py-2 text-right">
                                 <span className="text-[12px] font-black text-white/40">{percentOfExpenses.toFixed(1)}%</span>
                              </td>
                              <td className="py-2 text-right">
                                 <span className="text-[12px] font-black text-white/40 pr-4">{percentOfIncomes.toFixed(1)}%</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {monthlyPlan.expenses.filter(item => filterCategory === 'Todos' || item.category === filterCategory).length === 0 && (
                    <div className="py-8 text-center text-[12px] font-black uppercase tracking-widest text-white/10">
                      Nenhum item encontrado
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Valor Restante - Fixed at Bottom of Column */}
            <div className={cn(
              "rounded-3xl p-6 flex flex-col gap-2 transition-all duration-500 shrink-0 mt-6",
              balance >= 0 ? "bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5" : "bg-rose-500/10 border border-rose-500/20 shadow-lg shadow-rose-500/5"
            )}>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Valor Restante</span>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-3xl font-black tabular-nums tracking-tighter",
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
                    "px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95",
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

      {/* Snapshot Dialog Modal */}
      <AnimatePresence>
        {showSnapshotDialog && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md z-[100]"
              onClick={() => setShowSnapshotDialog(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] bg-card border border-white/10 rounded-[32px] p-10 z-[101] flex flex-col gap-8 shadow-2xl shadow-primary/10"
            >
              <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="p-4 bg-primary/10 w-fit rounded-2xl">
                        <Camera size={32} className="text-primary" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter">Gerar Snapshot Mensal</h3>
                    <p className="text-white/40 font-medium">Como você deseja lidar com os gastos para o próximo mês?</p>
                  </div>
                  <button 
                    onClick={() => setShowSnapshotDialog(false)}
                    className="p-2 text-white/20 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleCreateSnapshot(true)}
                    className="p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col gap-4 text-center items-center hover:bg-primary/10 hover:border-primary/30 transition-all group"
                  >
                     <div className="p-3 bg-white/5 rounded-xl group-hover:bg-primary/20 transition-all">
                        <Trash2 size={24} className="text-white/40 group-hover:text-primary" />
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="font-black uppercase tracking-widest text-xs">Zerar Gastos</span>
                        <span className="text-[10px] text-white/20 font-medium leading-relaxed">Limpa todos os valores de despesas para o novo mês.</span>
                     </div>
                  </button>

                  <button 
                    onClick={() => handleCreateSnapshot(false)}
                    className="p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col gap-4 text-center items-center hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group"
                  >
                     <div className="p-3 bg-white/5 rounded-xl group-hover:bg-emerald-500/20 transition-all">
                        <Check size={24} className="text-white/40 group-hover:text-emerald-500" />
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="font-black uppercase tracking-widest text-xs">Manter Gastos</span>
                        <span className="text-[10px] text-white/20 font-medium leading-relaxed">Mantém as despesas atuais para acompanhamento contínuo.</span>
                     </div>
                  </button>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl text-[10px] text-primary/60 font-bold uppercase tracking-widest text-center">
                 DICA: Use snapshots para arquivar o fechamento do seu mês financeiro.
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
    <div className="relative" ref={popperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="h-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none hover:bg-white/10 transition-all font-bold flex items-center gap-2 min-w-[120px]"
      >
        <span className="truncate">{selected}</span>
        <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 10, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full mt-3 right-0 w-64 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col backdrop-blur-3xl"
          >
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Nova categoria..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-3 pr-10 py-2 text-xs focus:outline-none focus:border-primary/50 transition-all font-medium"
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
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto p-2 custom-scrollbar">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      onSelect(cat);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all mb-1",
                      selected === cat ? "bg-primary text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {cat}
                    {selected === cat && <Check size={14} />}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-white/20 text-[10px] font-black uppercase tracking-widest">
                  Nenhuma categoria encontrada
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
