import React from 'react';
import { useInvestmentStore } from '../store/useInvestmentStore';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { TrendingUp, Wallet, ArrowUpRight, DollarSign, Plus, Trash2, X, ChevronLeft, ChevronRight, Bot, Loader, ExternalLink } from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

import { fetchQuotes } from '../services/brapi';

export const Dashboard = () => {
  const { portfolio, equityHistory, updatePortfolioPrices, addHistoryEntry, customLists } = useInvestmentStore();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [filterCategory, setFilterCategory] = React.useState('Todos');
  const [activeListIndex, setActiveListIndex] = React.useState(0);
  
  const [compositionFilter, setCompositionFilter] = React.useState('Todos');

  const handleRefresh = React.useCallback(async (silent = false, isManual = false) => {
    if (!portfolio || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const portfolioTickers = [...portfolio.acoes, ...portfolio.fiis].map(a => a.Ticker);
      const listTickers = customLists.flatMap(l => l.items.map((i: any) => i.ticker));
      const allTickers = Array.from(new Set([...portfolioTickers, ...listTickers]));

      if (allTickers.length > 0) {
        const quotes = await fetchQuotes(allTickers, isManual);
        updatePortfolioPrices(quotes);
        const newTotal = [...portfolio.acoes, ...portfolio.fiis, ...portfolio.tesouro, ...portfolio.renda_fixa]
          .reduce((acc, curr) => acc + (curr.Posicao || 0), 0);
        addHistoryEntry(newTotal);
      }
    } catch (error) {
      console.error("Erro ao atualizar cotações:", error);
      if (!silent) alert("Erro ao atualizar cotações");
    } finally {
      setIsRefreshing(false);
    }
  }, [portfolio, customLists, isRefreshing, updatePortfolioPrices, addHistoryEntry]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh(true);
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [handleRefresh]);

  if (!portfolio) return <div className="p-10 text-center text-white/40">Faça upload da carteira primeiro.</div>;

  const allAssets = [
    ...portfolio.acoes.map(a => ({ ...a, Categoria: 'Ações' })),
    ...portfolio.fiis.map(f => ({ ...f, Categoria: 'FIIs' })),
    ...portfolio.tesouro.map(t => ({ ...t, Ticker: t.Titulo, Categoria: 'Renda Fixa', Segmento: 'Tesouro Direto' })),
    ...portfolio.renda_fixa.map(r => ({ ...r, Ticker: r.Ativo, Categoria: 'Renda Fixa', Segmento: 'Renda Fixa' }))
  ];

  const filteredAssets = allAssets.filter(asset => {
    return filterCategory === 'Todos' || asset.Categoria === filterCategory;
  });

  const compositionData = allAssets
    .filter(a => compositionFilter === 'Todos' || a.Categoria === compositionFilter)
    .sort((a, b) => b.Posicao - a.Posicao);
  
  const compositionTotal = compositionData.reduce((acc, curr) => acc + curr.Posicao, 0);

  const COLORS = [ '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#6366F1' ];

  const totalInvestido = portfolio.resumo?.total_investido || 0;
  const lucroPrejuizo = 0;

  return (
    <div className="flex-1 p-4 space-y-6 overflow-y-auto no-scrollbar">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
          <p className="text-white/40">Sua jornada financeira em dados reais.</p>
        </div>
        <div className="flex items-center gap-4 bg-white/5 p-1.5 rounded-2xl border border-white/10">
          {['Todos', 'Ações', 'FIIs', 'Renda Fixa'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterCategory === cat ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white'}`}
            >
              {cat}
            </button>
          ))}
          <div className="w-px h-6 bg-white/10 mx-2" />
          <button 
            onClick={() => handleRefresh(false, true)}
            className={`p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all`}
          >
            {isRefreshing ? <Loader className='animate-spin' size={20} /> : <TrendingUp size={20} />}
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Patrimônio Total" value={formatCurrency(portfolio.total_live)} icon={<Wallet className="text-primary" />} trend="+2.4%" />
        <MetricCard title="Total Investido" value={formatCurrency(totalInvestido)} icon={<DollarSign className="text-secondary" />} trend="+1.1%" />
        <MetricCard title="Lucro/Prejuízo" value={formatCurrency(lucroPrejuizo)} icon={<TrendingUp className={lucroPrejuizo >= 0 ? 'text-emerald-500' : 'text-red-500'} />} trend={lucroPrejuizo >= 0 ? "+12.5%" : "-2.5%"} />
        <MetricCard title="Ativos Totais" value={allAssets.length.toString()} icon={<ArrowUpRight className="text-orange-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card 
          title="Composição" 
          extra={
            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5 scale-90 origin-right">
              {['Todos', 'Ações', 'FIIs', 'RF'].map((cat) => {
                const mapCat = cat === 'RF' ? 'Renda Fixa' : cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCompositionFilter(mapCat)}
                    className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all ${compositionFilter === mapCat ? 'bg-primary text-white' : 'text-white/20 hover:text-white/50'}`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-10 gap-4 h-[320px]">
            <div className="md:col-span-6 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={compositionData.slice(0, 8)}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="Posicao"
                    nameKey="Ticker"
                    stroke="none"
                  >
                    {compositionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#000', 
                      border: '1px solid #333', 
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }} 
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <div className="text-[14px] text-white/20 uppercase font-black tracking-tight">{compositionFilter}</div>
                 <div className="text-lg font-black text-white/80">{formatCurrency(compositionTotal)}</div>
              </div>
            </div>

            <div className="md:col-span-4 overflow-y-auto no-scrollbar space-y-1.5 py-2">
              {compositionData.slice(0, 10).map((asset, index) => {
                const percent = (asset.Posicao / compositionTotal) * 100;
                return (
                  <div key={asset.Ticker} className="flex items-center justify-between p-1.5 rounded-lg bg-white/2 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-[14px] font-black text-white/60 truncate">{asset.Ticker}</span>
                    </div>
                    <div className="text-right flex flex-col items-end flex-shrink-0">
                      <span className="text-[14px] font-black text-white/90">{percent.toFixed(1)}%</span>
                      <span className="text-[12px] text-white/30 font-bold tracking-tighter">{formatCurrency(asset.Posicao)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card title="Evolução Patrimonial">
          <div className="h-[320px] w-full pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={equityHistory}>
                <XAxis dataKey="date" stroke="#ffffff10" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis stroke="#ffffff10" fontSize={9} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
                  labelStyle={{ color: '#aaa', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="total" fill="url(#colorBarChart)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="colorBarChart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Ativos Detalhados">
          <div className="overflow-x-auto h-[500px] scrollbar-hide">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-[14px] text-white/40 uppercase">
                  <th className="py-4 px-2 font-black tracking-widest">Ativo</th>
                  <th className="py-4 px-2 font-black tracking-widest">Cotação</th>
                  <th className="py-4 px-2 font-black tracking-widest">P/L</th>
                  <th className="py-4 px-2 font-black tracking-widest">P/VP</th>
                  <th className="py-4 px-2 font-black tracking-widest">DY</th>
                  <th className="py-4 px-2 font-black tracking-widest">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAssets.map((asset, i) => (
                  <tr key={`${asset.Ticker}-${i}`} className="hover:bg-white/5 transition-colors group">
                    <td className="py-4 px-2">
                       <div className="flex items-center gap-2 group/ticker">
                         <div className="font-black text-white group-hover:text-primary transition-colors tracking-tight">{String(asset.Ticker)}</div>
                         {(asset.Categoria === 'Ações' || asset.Categoria === 'FIIs') && (
                           <a 
                             href={`https://investidor10.com.br/${asset.Categoria === 'Ações' ? 'acoes' : 'fiis'}/${asset.Ticker.replace('11', '').replace('3', '').replace('4', '').toLowerCase() === 'itub' ? asset.Ticker.toLowerCase() : asset.Ticker.toLowerCase()}/`}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-white/10 hover:text-primary transition-colors opacity-0 group-hover/ticker:opacity-100"
                           >
                             <ExternalLink size={12} />
                           </a>
                         )}
                       </div>
                       <div className="text-[14px] text-white/20 font-bold">{asset.Segmento || asset.Categoria}</div>
                    </td>
                    <td className="py-4 px-2">
                      <div className="font-bold text-white/90">{asset.Cotacao ? formatCurrency(asset.Cotacao) : '---'}</div>
                    </td>
                    <td className="py-4 px-2">
                      <div className={`font-bold ${asset.pl < 0 ? 'text-red-400' : 'text-primary'}`}>{asset.pl ? asset.pl.toFixed(2) : '---'}</div>
                    </td>
                    <td className="py-4 px-2">
                      <div className={`font-bold ${asset.pvp > 1.5 ? 'text-orange-400' : 'text-emerald-400'}`}>{asset.pvp ? asset.pvp.toFixed(2) : '---'}</div>
                    </td>
                    <td className="py-4 px-2">
                      <div className="font-bold text-emerald-500">{asset.dy ? `${asset.dy.toFixed(2)}%` : '---'}</div>
                    </td>
                    <td className="py-4 px-2">
                      <div className="font-black text-white/90">{formatCurrency(asset.Posicao)}</div>
                      <div className="text-[12px] text-white/20 font-medium">{asset.Quantidade} un.</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Listas de Ativos" extra={<AddListButton />}>
          <div className="relative group/carousel h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4 px-2">
               <h4 className="text-[14px] font-black text-white/30 uppercase tracking-widest">Monitoramento Direto</h4>
               <div className="flex gap-1.5">
                  {customLists.map((_, idx) => (
                    <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${activeListIndex === idx ? 'bg-primary w-4' : 'bg-white/10'}`} />
                  ))}
               </div>
            </div>

            <div 
              id="list-carousel"
              className="flex gap-6 overflow-x-auto scroll-smooth no-scrollbar snap-x snap-mandatory pb-4 h-full"
              onScroll={(e: any) => {
                const scrollLeft = e.target.scrollLeft;
                const width = e.target.offsetWidth;
                const index = Math.round(scrollLeft / (width - 40));
                if (index !== activeListIndex) setActiveListIndex(index);
              }}
            >
              {customLists.map((list) => (
                <div key={list.id} className="min-w-full lg:min-w-[420px] snap-center">
                  <CustomList list={list} />
                </div>
              ))}
              {customLists.length === 0 && (
                <div className="w-full h-full flex flex-col items-center justify-center text-center py-10 border-2 border-dashed border-white/5 rounded-3xl text-white/10">
                  <Bot size={48} className="mb-4 opacity-5" />
                  <p className="text-sm font-bold">Nenhuma lista monitorada.</p>
                </div>
              )}
            </div>
            
            {customLists.length > 1 && (
              <>
                <button 
                  onClick={() => document.getElementById('list-carousel')?.scrollBy({ left: -420, behavior: 'smooth' })}
                  className="absolute left-[-16px] top-1/2 -translate-y-1/2 p-2.5 bg-black/90 border border-white/10 rounded-full text-white/40 hover:text-white opacity-0 group-hover/carousel:opacity-100 transition-all z-10 shadow-2xl"
                >
                  <ChevronLeft size={22} />
                </button>
                <button 
                  onClick={() => document.getElementById('list-carousel')?.scrollBy({ left: 420, behavior: 'smooth' })}
                  className="absolute right-[-16px] top-1/2 -translate-y-1/2 p-2.5 bg-black/90 border border-white/10 rounded-full text-white/40 hover:text-white opacity-0 group-hover/carousel:opacity-100 transition-all z-10 shadow-2xl"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, trend }: any) => (
  <div className="bg-card border border-white/10 p-6 rounded-3xl relative overflow-hidden group hover:border-primary/30 transition-all shadow-xl">
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className="w-11 h-11 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-all">
        {React.cloneElement(icon, { size: 22 })}
      </div>
      {trend && <span className="text-[14px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg tracking-tight">{trend}</span>}
    </div>
    <div className="relative z-10">
      <p className="text-white/30 text-[14px] font-black mb-1 uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-white/90 tracking-tighter">{value}</p>
    </div>
    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/2 blur-[80px] group-hover:bg-primary/5 transition-all"></div>
  </div>
);

const Card = ({ title, icon, children, extra }: any) => (
  <div className="bg-card border border-white/10 rounded-[32px] p-6 h-full flex flex-col shadow-2xl relative">
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-3">
        {icon && <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">{icon}</div>}
        <h3 className="text-lg font-black tracking-tight text-white/90">{title}</h3>
      </div>
      {extra}
    </div>
    <div className="flex-1 overflow-hidden">{children}</div>
  </div>
);

const AddListButton = () => {
  const { addCustomList } = useInvestmentStore();
  return (
    <button 
      onClick={() => {
        const name = prompt("Nome da nova lista:");
        if (name) addCustomList(name);
      }}
      className="p-1.5 hover:bg-white/10 rounded-xl text-primary transition-all flex items-center gap-2 group border border-primary/20"
    >
      <Plus size={16} />
      <span className="text-[14px] font-black uppercase tracking-widest hidden group-hover:inline pr-1 transition-all">Novo</span>
    </button>
  );
};

const CustomList = ({ list }: { list: any }) => {
  const { addTickerToList, removeTickerFromList, deleteCustomList } = useInvestmentStore();
  const [newTicker, setNewTicker] = React.useState('');

  return (
    <div className="bg-white/5 rounded-[28px] p-6 border border-white/10 space-y-4 h-full flex flex-col shadow-inner group/list">
      <div className="flex justify-between items-center">
        <h4 className="font-black text-xl text-white tracking-tighter">{list.name}</h4>
        <button onClick={() => deleteCustomList(list.id)} className="text-white/5 hover:text-red-500 transition-colors opacity-0 group-hover/list:opacity-100 p-1">
           <Trash2 size={16} />
        </button>
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="TICKER"
          className="flex-1 bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-[11px] outline-none focus:border-primary/50 transition-all font-mono text-white/90"
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTicker) {
              addTickerToList(list.id, newTicker);
              setNewTicker('');
            }
          }}
        />
        <button 
          onClick={() => {
            if (newTicker) {
              addTickerToList(list.id, newTicker);
              setNewTicker('');
            }
          }}
          className="p-3 bg-primary text-white rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all font-black"
        >
          <Plus size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
        {list.items.map((item: any) => (
          <div key={item.ticker} className="p-4 bg-black/20 border border-white/5 rounded-2xl flex flex-col gap-3 relative group hover:bg-black/40 transition-all">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2 group/ticker">
                <span className="font-black text-[15px] tracking-tight text-white leading-none">{item.ticker}</span>
                <a 
                  href={`https://investidor10.com.br/${item.ticker.includes('11') ? 'fiis' : 'acoes'}/${item.ticker.toLowerCase()}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/10 hover:text-primary transition-colors opacity-0 group-hover/ticker:opacity-100"
                >
                  <ExternalLink size={12} />
                </a>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${item.change >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                   {item.change ? `${item.change.toFixed(2)}%` : '0.00%'}
                </span>
              </div>
              <button onClick={() => removeTickerFromList(list.id, item.ticker)} className="text-white/5 hover:text-red-500 transition-opacity p-1">
                <X size={14} />
              </button>
            </div>
            
            <div className="grid grid-cols-4 gap-2 border-t border-white/5 pt-3">
               <ValuationItem label="Cotação" value={item.price ? formatCurrency(item.price) : '---'} />
               <ValuationItem label="P/L" value={item.pl ? item.pl.toFixed(2) : '---'} color={item.pl < 0 ? 'text-red-400' : 'text-primary'} />
               <ValuationItem label="P/VP" value={item.pvp ? item.pvp.toFixed(2) : '---'} color={item.pvp > 1.5 ? 'text-orange-400' : 'text-emerald-400'} />
               <ValuationItem label="DY" value={item.dy ? `${item.dy.toFixed(2)}%` : '---'} color="text-emerald-500" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ValuationItem = ({ label, value, color = 'text-white/80' }: any) => (
  <div className="flex flex-col">
    <span className="text-[12px] text-white/20 uppercase font-black tracking-tight mb-0.5">{label}</span>
    <span className={`text-[14px] font-black ${color} truncate`}>{value}</span>
  </div>
);
