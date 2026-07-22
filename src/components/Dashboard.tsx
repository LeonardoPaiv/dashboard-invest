import React from 'react';
import { useInvestmentStore } from '../store/useInvestmentStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, Wallet, ArrowUpRight, DollarSign, Plus, Trash2, X, ChevronLeft, ChevronRight, Bot, Loader, ExternalLink, Filter, ChevronDown, AlertCircle, Layers } from 'lucide-react';
import { fetchQuotes } from '../services/brapi';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
};

export const Dashboard = () => {
  const {
    portfolio,
    portfolios,
    activePortfolioId,
    updatePortfolioPrices,
    addHistoryEntry,
    customLists,
    assetCategories,
    addManualAsset,
    addAssetCategory,
    deleteManualAsset,
    updateAsset
  } = useInvestmentStore();

  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [activeListIndex, setActiveListIndex] = React.useState(0);
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = React.useState(false);
  
  const [compositionFilter, setCompositionFilter] = React.useState('Todos');
  const [activeDetailedTab, setActiveDetailedTab] = React.useState<'acoes' | 'fiis' | 'tesouro' | 'renda_fixa'>('acoes');
  const [editingPM, setEditingPM] = React.useState<{type: string, id: string} | null>(null);
  const [editValue, setEditValue] = React.useState('');

  const activePortfolioObj = portfolios.find((p) => p.id === activePortfolioId);
  const isConsolidated = activePortfolioId === 'all';

  const handleRefresh = React.useCallback(async (silent = false, isManual = false) => {
    if (!portfolio || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const portfolioTickers = [
        ...(portfolio?.acoes || []), 
        ...(portfolio?.fiis || []), 
        ...(portfolio?.manualAssets || [])
      ].map((a: any) => a.Ticker).filter(Boolean);
      
      const listTickers = (customLists || []).flatMap((l: any) => l.items.map((i: any) => i.ticker));
      const allTickers = Array.from(new Set([...portfolioTickers, ...listTickers]));

      if (allTickers.length > 0) {
        const quotes = await fetchQuotes(allTickers, isManual);
        if (quotes && quotes.length > 0) {
          updatePortfolioPrices(quotes);
          const newTotal = [
            ...(portfolio?.acoes || []), 
            ...(portfolio?.fiis || []), 
            ...(portfolio?.tesouro || []), 
            ...(portfolio?.renda_fixa || []), 
            ...(portfolio?.manualAssets || [])
          ].reduce((acc: number, curr: any) => acc + (curr.Posicao || 0), 0);
          addHistoryEntry(newTotal);
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar cotações:", error);
      if (!silent) alert("Erro ao atualizar cotações");
    } finally {
      setIsRefreshing(false);
    }
  }, [portfolio, customLists, isRefreshing, updatePortfolioPrices, addHistoryEntry]);

  React.useEffect(() => {
    if (portfolio) {
      handleRefresh(true);
    }
    
    const interval = setInterval(() => {
      handleRefresh(true);
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio === null]);

  if (!portfolio) {
    return (
      <div className="p-10 text-center text-white/40 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Wallet size={48} className="text-white/20 animate-bounce" />
        <h3 className="text-xl font-bold text-white">Nenhum dado encontrado</h3>
        <p className="text-sm max-w-sm">Importe uma planilha ou adicione ativos manualmente para visualizar seu dashboard.</p>
      </div>
    );
  }

  const allAssets = [
    ...(portfolio?.acoes || []).map((a: any) => ({ ...a, Categoria: 'Ações', SectionType: 'acoes' })),
    ...(portfolio?.fiis || []).map((f: any) => ({ ...f, Categoria: 'FIIs', SectionType: 'fiis' })),
    ...(portfolio?.tesouro || []).map((t: any) => ({ ...t, Ticker: t.Ticker || t.Titulo, Categoria: 'Tesouro Direto', Segmento: 'Tesouro Direto', SectionType: 'tesouro' })),
    ...(portfolio?.renda_fixa || []).map((r: any) => ({ ...r, Ticker: r.Ticker || r.Ativo, Categoria: 'Renda Fixa', Segmento: 'Renda Fixa', SectionType: 'renda_fixa' })),
    ...(portfolio?.manualAssets || []).map((m: any) => ({ ...m, Categoria: m.category || 'Outros', SectionType: m.category === 'Ações' ? 'acoes' : m.category === 'FIIs' ? 'fiis' : 'manual' }))
  ];

  const dashboardCategories = Array.from(new Set([
    'Ações',
    'FIIs',
    'Tesouro Direto',
    'Renda Fixa',
    ...assetCategories,
    ...allAssets.map((a) => a.Categoria)
  ])).filter(Boolean).sort();

  const compositionData = allAssets
    .filter((a) => compositionFilter === 'Todos' || a.Categoria === compositionFilter)
    .sort((a, b) => (b.Posicao || 0) - (a.Posicao || 0));
  
  const compositionTotal = compositionData.reduce((acc, curr) => acc + (curr.Posicao || 0), 0);
  
  const topCount = 8;
  const pieData = compositionData.slice(0, topCount);
  const othersData = compositionData.slice(topCount);
  const othersTotal = othersData.reduce((acc, curr) => acc + (curr.Posicao || 0), 0);
  
  if (othersTotal > 0) {
    pieData.push({
      Ticker: 'Outros',
      Posicao: othersTotal,
    } as any);
  }

  const acoes = allAssets.filter((a) => a.SectionType === 'acoes');
  const fiis = allAssets.filter((a) => a.SectionType === 'fiis');
  const tesouro = allAssets.filter((a) => a.SectionType === 'tesouro');
  const rendaFixa = allAssets.filter((a) => a.SectionType === 'renda_fixa');

  const COLORS = [ '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#6366F1' ];

  const totalInvestido = allAssets.reduce((acc, curr) => {
    const cost = curr.PrecoMedio || curr.Cotacao || 0;
    return acc + ((curr.Quantidade || 0) * cost);
  }, 0);
  
  const hasMissingAvgPrice = allAssets.some((a) => !a.PrecoMedio && (a.Quantidade || 0) > 0);
  const lucroPrejuizo = (portfolio.total_live || 0) - totalInvestido;
  const lucroPercentual = totalInvestido > 0 ? (lucroPrejuizo / totalInvestido) * 100 : 0;

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black tracking-tight text-white">Dashboard</h2>
            {isConsolidated ? (
              <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-xl flex items-center gap-1.5">
                <Layers size={14} />
                Resumo Consolidado ({portfolios.length} carteiras)
              </span>
            ) : (
              <span
                className="px-3 py-1 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow"
                style={{ backgroundColor: activePortfolioObj?.color || '#6366f1' }}
              >
                <Wallet size={14} />
                {activePortfolioObj?.name || 'Carteira Principal'}
              </span>
            )}
          </div>
          <p className="text-white/40 text-xs mt-1">Sua jornada financeira em dados reais.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleRefresh(false, true)}
            title="Atualizar Cotações"
            className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 group"
          >
            {isRefreshing ? (
              <Loader className="animate-spin text-primary" size={20} />
            ) : (
              <>
                <TrendingUp size={18} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest pr-1">Live Quotes</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Grid: Composition & Consolidated Metrics Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card 
          title="Composição" 
          extra={
            <CompositionFilter 
              categories={dashboardCategories} 
              activeFilter={compositionFilter} 
              onSelect={setCompositionFilter} 
            />
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-10 gap-4 h-[320px]">
            <div className="md:col-span-6 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="Posicao"
                    nameKey="Ticker"
                    stroke="none"
                  >
                    {pieData.map((_, index) => (
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
                 <div className="text-[12px] text-white/30 uppercase font-black tracking-tight">{compositionFilter}</div>
                 <div className="text-lg font-black text-white/90">{formatCurrency(compositionTotal)}</div>
              </div>
            </div>

            <div className="md:col-span-4 overflow-y-auto custom-scrollbar space-y-1.5 py-2">
              {pieData.map((asset, index) => {
                const percent = compositionTotal > 0 ? (asset.Posicao / compositionTotal) * 100 : 0;
                return (
                  <div key={asset.Ticker} className="flex items-center justify-between p-1.5 rounded-lg bg-white/2 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span className="text-[13px] font-black text-white/80 truncate">{asset.Ticker}</span>
                    </div>
                    <div className="text-right flex flex-col items-end shrink-0">
                      <span className="text-[13px] font-black text-white/90">{percent.toFixed(1)}%</span>
                      <span className="text-[11px] text-white/30 font-bold tracking-tighter">{formatCurrency(asset.Posicao)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Resumo de Patrimônio & Desempenho Container */}
        <Card title="Resumo de Patrimônio & Desempenho">
          <div className="h-[320px] flex flex-col justify-between py-1">
            <div className="grid grid-cols-2 gap-3.5 h-full">
              {/* Metric 1: Patrimônio Total */}
              <div className="bg-white/2 hover:bg-white/5 border border-white/5 hover:border-primary/30 p-4 rounded-2xl flex flex-col justify-between transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Patrimônio Total</span>
                  <div className="p-2 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform">
                    <Wallet size={18} />
                  </div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-black text-white tracking-tight">
                    {formatCurrency(portfolio.total_live)}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 mt-1">
                    <TrendingUp size={11} /> Posição Atualizada
                  </span>
                </div>
              </div>

              {/* Metric 2: Total Investido (Custo) */}
              <div className="bg-white/2 hover:bg-white/5 border border-white/5 hover:border-white/10 p-4 rounded-2xl flex flex-col justify-between transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Total Investido</span>
                  <div className="p-2 bg-secondary/10 rounded-xl text-secondary group-hover:scale-110 transition-transform">
                    <DollarSign size={18} />
                  </div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-black text-white/90 tracking-tight">
                    {formatCurrency(totalInvestido)}
                  </div>
                  {hasMissingAvgPrice ? (
                    <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1 mt-1" title="Alguns ativos não possuem preço médio.">
                      <AlertCircle size={11} /> Custo Estimado
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/30 font-bold mt-1 block">
                      Custo Total Consolidado
                    </span>
                  )}
                </div>
              </div>

              {/* Metric 3: Lucro / Prejuízo */}
              <div className="bg-white/2 hover:bg-white/5 border border-white/5 hover:border-white/10 p-4 rounded-2xl flex flex-col justify-between transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Lucro / Prejuízo</span>
                  <div className={`p-2 rounded-xl transition-transform group-hover:scale-110 ${lucroPrejuizo >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div>
                  <div className={`text-lg sm:text-2xl font-black tracking-tight ${lucroPrejuizo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(lucroPrejuizo)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${lucroPrejuizo >= 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                      {lucroPercentual >= 0 ? '+' : ''}{lucroPercentual.toFixed(2)}% ROI
                    </span>
                  </div>
                </div>
              </div>

              {/* Metric 4: Ativos Totais */}
              <div className="bg-white/2 hover:bg-white/5 border border-white/5 hover:border-white/10 p-4 rounded-2xl flex flex-col justify-between transition-all group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Ativos Totais</span>
                  <div className="p-2 bg-orange-500/10 rounded-xl text-orange-500 group-hover:scale-110 transition-transform">
                    <ArrowUpRight size={18} />
                  </div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-black text-white/90 tracking-tight">
                    {allAssets.length} <span className="text-xs text-white/40 font-bold">posições</span>
                  </div>
                  <span className="text-[10px] text-white/30 font-bold mt-1 block truncate">
                    {acoes.length} Ações • {fiis.length} FIIs • {tesouro.length + rendaFixa.length} RF
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Holdings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-white/10 rounded-[32px] p-6 h-full flex flex-col shadow-2xl relative">
          {/* Header Responsivo com Título na Primeira Linha e Dropdown de Ativos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <h3 className="text-lg font-black tracking-tight text-white/90">Ativos Detalhados</h3>
              <button
                onClick={() => setIsAddAssetModalOpen(true)}
                className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-all shrink-0"
              >
                <Plus size={15} />
                <span className="text-xs font-black uppercase tracking-tight">Adicionar</span>
              </button>
            </div>

            <div className="flex items-center gap-3 justify-between sm:justify-end w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={activeDetailedTab}
                  onChange={(e) => setActiveDetailedTab(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-1.5 pr-8 text-xs font-black uppercase tracking-wider text-white appearance-none cursor-pointer focus:outline-none focus:border-primary/50 transition-all"
                >
                  <option value="acoes" className="bg-[#1a1c1e] text-white">Ações</option>
                  <option value="fiis" className="bg-[#1a1c1e] text-white">FIIs</option>
                  <option value="tesouro" className="bg-[#1a1c1e] text-white">Tesouro Direto</option>
                  <option value="renda_fixa" className="bg-[#1a1c1e] text-white">Renda Fixa</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>

              <button
                onClick={() => setIsAddAssetModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-all group shrink-0"
              >
                <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                <span className="text-xs font-black uppercase tracking-tight">Adicionar</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="overflow-x-auto h-[500px] custom-scrollbar">
            {(activeDetailedTab === 'acoes' || activeDetailedTab === 'fiis') && (
              <table className="w-full text-left min-w-[550px]">
                <thead>
                  <tr className="border-b border-white/5 text-[12px] text-white/40 uppercase">
                    <th className="py-4 px-2 font-black tracking-widest">Ativo</th>
                    <th className="py-4 px-2 font-black tracking-widest">Cotação</th>
                    <th className="py-4 px-2 font-black tracking-widest">Aloc.</th>
                    <th className="py-4 px-2 font-black tracking-widest text-right">Rent.</th>
                    <th className="py-4 px-2 font-black tracking-widest text-right">Valor</th>
                    <th className="py-4 px-2 font-black tracking-widest w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(activeDetailedTab === 'acoes' ? acoes : fiis).map((asset, i) => {
                    const assetAllocation = portfolio.total_live > 0 ? (asset.Posicao / portfolio.total_live) * 100 : 0;
                    const individualYield = asset.PrecoMedio > 0 ? ((asset.Cotacao - asset.PrecoMedio) / asset.PrecoMedio) * 100 : 0;
                    
                    return (
                      <tr key={`${asset.Ticker}-${i}`} className="hover:bg-white/5 transition-colors group">
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-2 group/ticker">
                            <div className="font-black text-white group-hover:text-primary transition-colors tracking-tight">{String(asset.Ticker)}</div>
                            {isConsolidated && asset.portfolioName && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white/90"
                                style={{ backgroundColor: asset.portfolioColor || '#6366f1' }}
                                title={`Carteira: ${asset.portfolioName}`}
                              >
                                {asset.portfolioName}
                              </span>
                            )}
                            {!asset.PrecoMedio && (
                              <div className="text-orange-500/80" title="Preço médio faltando">
                                <AlertCircle size={12} />
                              </div>
                            )}
                            <a 
                              href={`https://investidor10.com.br/${activeDetailedTab === 'acoes' ? 'acoes' : 'fiis'}/${asset.Ticker.toLowerCase()}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white/10 hover:text-primary transition-colors opacity-0 group-hover/ticker:opacity-100"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                          <div className="text-[11px] text-white/20 font-bold">{asset.Segmento || asset.Categoria}</div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="font-bold text-white/90">{asset.Cotacao ? formatCurrency(asset.Cotacao) : '---'}</div>
                          {editingPM && editingPM.id === (asset.Ticker || (asset as any).id) ? (
                            <input
                              autoFocus
                              type="text"
                              className="w-20 bg-white/5 border border-primary/30 rounded text-[10px] text-white px-1 outline-none"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => {
                                updateAsset(asset.SectionType || activeDetailedTab, asset.Ticker || (asset as any).id, { PrecoMedio: parseFloat(editValue.replace(',', '.')) || 0 }, asset.portfolioId);
                                setEditingPM(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') setEditingPM(null);
                              }}
                            />
                          ) : (
                            <div 
                              className="text-[10px] text-white/20 hover:text-primary transition-colors cursor-pointer"
                              onClick={() => {
                                setEditingPM({ type: asset.SectionType || activeDetailedTab, id: asset.Ticker || (asset as any).id });
                                setEditValue(String(asset.PrecoMedio || ''));
                              }}
                            >
                              PM: {asset.PrecoMedio ? formatCurrency(asset.PrecoMedio) : '---'}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-2">
                          <div className="font-bold text-primary/80">{assetAllocation.toFixed(1)}%</div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className={`font-bold ${individualYield >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {individualYield !== 0 ? `${individualYield >= 0 ? '+' : ''}${individualYield.toFixed(2)}%` : '---'}
                          </div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="font-black text-white/90">{formatCurrency(asset.Posicao)}</div>
                          <div className="text-[11px] text-white/20 font-medium">{asset.Quantidade} un.</div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          {(asset as any).id && (
                            <button 
                              onClick={() => deleteManualAsset((asset as any).id, asset.portfolioId)}
                              className="text-white/5 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeDetailedTab === 'renda_fixa' && (
              <table className="w-full text-left min-w-[550px]">
                <thead>
                  <tr className="border-b border-white/5 text-[12px] text-white/40 uppercase">
                    <th className="py-4 px-2 font-black tracking-widest">Produto</th>
                    <th className="py-4 px-2 font-black tracking-widest">Indexador</th>
                    <th className="py-4 px-2 font-black tracking-widest">Vencimento</th>
                    <th className="py-4 px-2 font-black tracking-widest text-right">Aloc.</th>
                    <th className="py-4 px-2 font-black tracking-widest text-right">Valor</th>
                    <th className="py-4 px-2 font-black tracking-widest w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rendaFixa.map((asset, i) => {
                    const assetAllocation = portfolio.total_live > 0 ? (asset.Posicao / portfolio.total_live) * 100 : 0;
                    return (
                      <tr key={`${asset.Ticker}-${i}`} className="hover:bg-white/5 transition-colors group">
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-2">
                            <div className="font-black text-white group-hover:text-primary transition-colors tracking-tight">{asset.Ticker}</div>
                            {isConsolidated && asset.portfolioName && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white/90"
                                style={{ backgroundColor: asset.portfolioColor || '#6366f1' }}
                              >
                                {asset.portfolioName}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-white/20 font-bold">{asset.Quantidade} un.</div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="font-bold text-white/70">{asset.Indexador || '---'}</div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="font-bold text-white/70">{asset.Vencimento || '---'}</div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="font-bold text-primary/80">{assetAllocation.toFixed(1)}%</div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="font-black text-white/90">{formatCurrency(asset.Posicao)}</div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          {(asset as any).id && (
                            <button 
                              onClick={() => deleteManualAsset((asset as any).id, asset.portfolioId)}
                              className="text-white/5 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeDetailedTab === 'tesouro' && (
              <table className="w-full text-left min-w-[550px]">
                <thead>
                  <tr className="border-b border-white/5 text-[12px] text-white/40 uppercase">
                    <th className="py-4 px-2 font-black tracking-widest">Produto</th>
                    <th className="py-4 px-2 font-black tracking-widest text-right">Bruto</th>
                    <th className="py-4 px-2 font-black tracking-widest text-center">Vencimento</th>
                    <th className="py-4 px-2 font-black tracking-widest text-right">Aloc.</th>
                    <th className="py-4 px-2 font-black tracking-widest text-right">Líquido</th>
                    <th className="py-4 px-2 font-black tracking-widest w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tesouro.map((asset, i) => {
                    const assetAllocation = portfolio.total_live > 0 ? (asset.Posicao / portfolio.total_live) * 100 : 0;
                    return (
                      <tr key={`${asset.Ticker}-${i}`} className="hover:bg-white/5 transition-colors group">
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-2">
                            <div className="font-black text-white group-hover:text-primary transition-colors tracking-tight">{asset.Ticker}</div>
                            {isConsolidated && asset.portfolioName && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white/90"
                                style={{ backgroundColor: asset.portfolioColor || '#6366f1' }}
                              >
                                {asset.portfolioName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="font-bold text-white/70">{asset.ValorBruto ? formatCurrency(asset.ValorBruto) : '---'}</div>
                        </td>
                        <td className="py-4 px-2 text-center">
                          <div className="font-bold text-white/70">{asset.Vencimento || '---'}</div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="font-bold text-primary/80">{assetAllocation.toFixed(1)}%</div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <div className="font-black text-emerald-500">{formatCurrency(asset.Posicao)}</div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          {(asset as any).id && (
                            <button 
                              onClick={() => deleteManualAsset((asset as any).id, asset.portfolioId)}
                              className="text-white/5 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

        {/* Custom Lists Monitor */}
        <Card title="Listas de Ativos" extra={<AddListButton />}>
          <div className="relative group/carousel h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-4 px-2">
               <h4 className="text-[12px] font-black text-white/30 uppercase tracking-widest">Monitoramento Direto</h4>
               <div className="flex gap-1.5">
                  {customLists.map((_: any, idx: number) => (
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
              {customLists.map((list: any) => (
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

      <AddAssetModal 
        isOpen={isAddAssetModalOpen} 
        onClose={() => setIsAddAssetModalOpen(false)}
        onAdd={(asset: any) => {
          addManualAsset(asset);
          setIsAddAssetModalOpen(false);
        }}
        categories={dashboardCategories}
        onAddCategory={addAssetCategory}
      />
    </div>
  );
};

const AddAssetModal = ({ isOpen, onClose, onAdd, categories, onAddCategory }: any) => {
  const [ticker, setTicker] = React.useState('');
  const [category, setCategory] = React.useState(categories[0] || '');
  const [quantity, setQuantity] = React.useState('');
  const [averagePrice, setAveragePrice] = React.useState('');
  const [isAddingCategory, setIsAddingCategory] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ticker,
      category,
      quantity: Number(quantity),
      averagePrice: Number(averagePrice)
    });
    setTicker('');
    setQuantity('');
    setAveragePrice('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-white/10 w-full max-w-md rounded-[32px] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <h3 className="text-2xl font-black text-white mb-6 tracking-tight">Adicionar Ativo</h3>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[12px] font-black text-white/20 uppercase tracking-widest pl-1">Ticker / Nome</label>
            <input
              autoFocus
              required
              type="text"
              placeholder="Ex: PETR4 ou Tesouro IPCA"
              className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white outline-none focus:border-primary/50 transition-all font-bold"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-black text-white/20 uppercase tracking-widest pl-1">Categoria</label>
            {!isAddingCategory ? (
              <div className="flex gap-2">
                <select
                  required
                  className="flex-1 bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white outline-none focus:border-primary/50 transition-all font-bold appearance-none text-white"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((cat: string) => (
                    <option key={cat} value={cat} className="bg-[#1a1c1e] text-white">{cat}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white/40 hover:text-white transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2 animate-in slide-in-from-right-2 duration-200">
                <input
                  autoFocus
                  type="text"
                  placeholder="Nova Categoria"
                  className="flex-1 bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white outline-none focus:border-primary/50 transition-all font-bold"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newCategory) {
                        onAddCategory(newCategory);
                        setCategory(newCategory);
                        setIsAddingCategory(false);
                        setNewCategory('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newCategory) {
                      onAddCategory(newCategory);
                      setCategory(newCategory);
                      setIsAddingCategory(false);
                      setNewCategory('');
                    } else {
                      setIsAddingCategory(false);
                    }
                  }}
                  className="px-4 bg-primary text-white rounded-2xl font-black text-xs uppercase"
                >
                  Salvar
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[12px] font-black text-white/20 uppercase tracking-widest pl-1">Quantidade</label>
              <input
                required
                type="number"
                step="any"
                placeholder="0.00"
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white outline-none focus:border-primary/50 transition-all font-bold"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-black text-white/20 uppercase tracking-widest pl-1">Preço Médio</label>
              <input
                required
                type="number"
                step="0.01"
                placeholder="R$ 0,00"
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white outline-none focus:border-primary/50 transition-all font-bold"
                value={averagePrice}
                onChange={(e) => setAveragePrice(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-[20px] shadow-xl shadow-primary/20 transition-all uppercase tracking-widest mt-4"
          >
            Adicionar à Carteira
          </button>
        </form>
      </div>
    </div>
  );
};

const CompositionFilter = ({ categories, activeFilter, onSelect }: any) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-black/20 border border-white/5 rounded-xl hover:border-primary/30 transition-all group scale-90 origin-right text-white"
      >
        <Filter size={12} className="text-white/20 group-hover:text-primary transition-colors" />
        <span className="text-[10px] font-black uppercase tracking-widest">{activeFilter}</span>
        <ChevronDown size={12} className={`text-white/20 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 min-w-[140px] bg-[#0a0a0a] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-[50] animate-in fade-in zoom-in-95 duration-200">
          {['Todos', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                onSelect(cat);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${
                activeFilter === cat ? 'bg-primary text-white' : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};



const Card = ({ title, icon, children, extra, reverseHeader }: any) => (
  <div className="bg-card border border-white/10 rounded-[32px] p-6 h-full flex flex-col shadow-2xl relative">
    <div className={`flex justify-between items-center mb-6 ${reverseHeader ? 'flex-row-reverse' : ''}`}>
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
      <span className="text-[12px] font-black uppercase tracking-widest hidden group-hover:inline pr-1 transition-all">Novo</span>
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
          className="p-3 bg-primary text-white rounded-2xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-black"
        >
          <Plus size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
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
    <span className="text-[10px] text-white/30 uppercase font-black tracking-tight mb-0.5">{label}</span>
    <span className={`text-[12px] font-black ${color} truncate`}>{value}</span>
  </div>
);
