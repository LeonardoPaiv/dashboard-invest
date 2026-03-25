import React, { useState } from 'react';
import { Upload, Calculator, Info, FileSpreadsheet, TrendingUp, History, RefreshCcw, Search, AlertCircle, CheckCheck, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useInvestmentStore } from '../store/useInvestmentStore';

interface Transaction {
  date: Date;
  type: 'Compra' | 'Venda';
  ticker: string;
  quantity: number;
  price: number;
  total: number;
  isFII?: boolean;
  isDayTrade?: boolean;
}

interface AssetAverage {
  ticker: string;
  totalQuantity: number;
  averagePrice: number;
  totalInvested: number;
  lastUpdate: Date;
  transactions: Transaction[];
}

export const AveragePrice = () => {
  const [assets, setAssets] = useState<AssetAverage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const parseB3Excel = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          // Identify headers
          const headers = jsonData[0] as string[];
          const getIndex = (name: string) => headers.findIndex(h => h?.includes(name));

          const dateIdx = getIndex('Data do Negócio');
          const typeIdx = getIndex('Tipo de Movimentação');
          const tickerIdx = getIndex('Código de Negociação');
          const qtyIdx = getIndex('Quantidade');
          const priceIdx = getIndex('Preço');
          const totalIdx = getIndex('Valor');

          if (dateIdx === -1 || tickerIdx === -1 || qtyIdx === -1) {
            throw new Error("Formato de planilha inválido. Certifique-se de usar o exportado da B3.");
          }

          const transactions: Transaction[] = [];

          // Skip header
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row[tickerIdx]) continue;

            const type = row[typeIdx]?.trim();
            if (type !== 'Compra' && type !== 'Venda') continue;

            let ticker = String(row[tickerIdx]).trim().toUpperCase();
            // Remove 'F' from fractional market tickers
            if (ticker.endsWith('F') && ticker.length > 5) {
              ticker = ticker.slice(0, -1);
            }

            const cleanValue = (val: any) => {
              if (typeof val === 'number') return val;
              if (!val) return 0;
              let s = String(val).replace('R$', '').trim();
              const hasComma = s.includes(',');
              const hasDot = s.includes('.');
              if (hasComma && hasDot) {
                if (s.indexOf(',') < s.indexOf('.')) s = s.replace(/,/g, '');
                else s = s.replace(/\./g, '').replace(',', '.');
              } else if (hasComma) {
                const parts = s.split(',');
                if (parts[parts.length - 1].length <= 2) s = s.replace(',', '.');
                else s = s.replace(/,/g, '');
              } else if (hasDot) {
                const parts = s.split('.');
                if (parts[parts.length - 1].length > 2) s = s.replace(/\./g, '');
              }
              const parsed = parseFloat(s);
              return isNaN(parsed) ? 0 : parsed;
            };

            const dateStr = row[dateIdx];
            let date: Date;
            if (typeof dateStr === 'number') {
              date = new Date((dateStr - 25569) * 86400 * 1000);
            } else {
              const parts = String(dateStr).split('/');
              date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }

            transactions.push({
              date,
              type: type as 'Compra' | 'Venda',
              ticker,
              quantity: Number(row[qtyIdx]),
              price: cleanValue(row[priceIdx]),
              total: cleanValue(row[totalIdx])
            });
          }

          transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

          const averages: Record<string, AssetAverage> = {};
          
          const enhancedTransactions = transactions.map((t, idx) => {
            const isFII = t.ticker.endsWith('11') && !['VALE11', 'ITUB11', 'BOVA11', 'IVVB11'].includes(t.ticker);
            const isDayTrade = transactions.some((other, oIdx) => 
               idx !== oIdx && 
               other.ticker === t.ticker && 
               other.date.getTime() === t.date.getTime() && 
               other.type !== t.type
            );
            return { ...t, isFII, isDayTrade };
          });

          enhancedTransactions.forEach(t => {
            if (!averages[t.ticker]) {
              averages[t.ticker] = {
                ticker: t.ticker,
                totalQuantity: 0,
                averagePrice: 0,
                totalInvested: 0,
                lastUpdate: t.date,
                transactions: []
              };
            }
            const asset = averages[t.ticker];
            asset.transactions.push(t);
            asset.lastUpdate = t.date;
            if (t.type === 'Compra') {
              asset.totalQuantity += t.quantity;
              asset.totalInvested += t.total;
              if (asset.totalQuantity > 0) asset.averagePrice = asset.totalInvested / asset.totalQuantity;
            } else if (t.type === 'Venda') {
              const ratio = t.quantity / asset.totalQuantity;
              asset.totalQuantity -= t.quantity;
              asset.totalInvested -= (asset.totalInvested * ratio);
              if (asset.totalQuantity <= 0) {
                asset.totalQuantity = 0; asset.totalInvested = 0; asset.averagePrice = 0;
              } else asset.averagePrice = asset.totalInvested / asset.totalQuantity;
            }
          });

          const { setHistoricalTransactions } = useInvestmentStore.getState();
          setHistoricalTransactions(enhancedTransactions);
          setAssets(Object.values(averages).sort((a, b) => b.totalInvested - a.totalInvested));
          setLoading(false);
        } catch (err: any) {
          setError(err.message || "Erro ao processar arquivo");
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError("Erro ao ler arquivo");
      setLoading(false);
    }
  };

  const { portfolio, setPortfolio, setActiveTab } = useInvestmentStore();

  const handleSyncToDashboard = () => {
    if (!portfolio) {
      alert("Nenhum portfólio carregado no dashboard.");
      return;
    }
    const newPortfolio = { ...portfolio };
    let matches = 0;
    const sections = ['acoes', 'fiis', 'tesouro', 'renda_fixa', 'manualAssets'] as const;
    sections.forEach(sectionKey => {
      if (newPortfolio[sectionKey]) {
        newPortfolio[sectionKey] = newPortfolio[sectionKey].map((asset: any) => {
          const match = assets.find(a => a.ticker === asset.Ticker);
          if (match) {
            matches++;
            return { ...asset, PrecoMedio: match.averagePrice };
          }
          return asset;
        });
      }
    });

    if (matches === 0) {
      alert("Nenhum ativo correspondente encontrado no dashboard.");
      return;
    }

    const all = [...newPortfolio.acoes, ...newPortfolio.fiis, ...newPortfolio.tesouro, ...newPortfolio.renda_fixa, ...(newPortfolio.manualAssets || [])];
    newPortfolio.resumo = {
      ...newPortfolio.resumo,
      total_investido: all.reduce((acc, curr) => acc + ((curr.PrecoMedio || 0) * (curr.Quantidade || 0)), 0)
    };
    setPortfolio(newPortfolio);
    alert(`${matches} ativos atualizados com sucesso no dashboard!`);
  };

  const filteredAssets = assets.filter((a: AssetAverage) => a.ticker.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-background/50">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Calculator className="text-primary" size={32} />
              Preço Médio Histórico
            </h1>
            <p className="text-white/40 mt-1 font-medium">Calcule seu PM baseado na planilha de negociações da B3</p>
          </div>
          <div className="flex items-center gap-3">
            {assets.length > 0 && (
              <>
                <button 
                  onClick={() => setActiveTab('imposto-renda')}
                  className="flex items-center gap-3 px-6 py-3 bg-white/5 text-white border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-bold"
                >
                  <FileText size={20} className="text-primary" />
                  Relatório IRPF
                </button>
                <button 
                  onClick={handleSyncToDashboard}
                  className="flex items-center gap-3 px-6 py-3 bg-white/5 text-white border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-bold"
                >
                  <CheckCheck size={20} className="text-green-400" />
                  Aplicar ao Dashboard
                </button>
              </>
            )}
            <label className="flex items-center gap-3 px-6 py-3 bg-primary text-white rounded-2xl cursor-pointer hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20">
              <Upload size={20} />
              Importar Planilha B3
              <input type="file" className="hidden" accept=".xlsx" onChange={(e) => e.target.files?.[0] && parseB3Excel(e.target.files[0])} />
            </label>
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/20 p-6 rounded-3xl flex gap-4">
          <div className="bg-primary/20 p-3 rounded-2xl h-fit"><Info className="text-primary" size={24} /></div>
          <div className="space-y-1">
            <h3 className="font-bold text-white">Instruções de Uso</h3>
            <p className="text-white/60 text-sm leading-relaxed">Exporte sua planilha de <b>Negociações</b> B3. O sistema irá higienizar os tickers e calcular o PM histórico.</p>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400"><AlertCircle size={20} /><span>{error}</span></div>}

        {assets.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Ativos Negociados" value={assets.length} icon={<FileSpreadsheet size={24} />} />
              <StatCard title="Ativos em Carteira" value={assets.filter((a: AssetAverage) => a.totalQuantity > 0).length} icon={<TrendingUp size={24} />} />
              <StatCard title="Total Investido (PM)" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(assets.reduce((acc: number, curr: AssetAverage) => acc + curr.totalInvested, 0))} icon={<Calculator size={24} />} />
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={20} />
              <input type="text" placeholder="Buscar ticker..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-card border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-white focus:outline-none focus:border-primary/50 transition-all font-medium" />
            </div>
            <div className="bg-card border border-white/5 rounded-3xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5 text-white/40 text-xs font-black uppercase tracking-widest">
                    <th className="px-6 py-4">Ativo</th>
                    <th className="px-6 py-4">Qtd. Atual</th>
                    <th className="px-6 py-4">Preço Médio</th>
                    <th className="px-6 py-4">Total (Base PM)</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence mode="popLayout">
                    {filteredAssets.map((asset: AssetAverage) => (
                      <motion.tr key={asset.ticker} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`hover:bg-white/[0.02] transition-colors ${asset.totalQuantity === 0 ? 'opacity-40 grayscale' : ''}`}>
                        <td className="px-6 py-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center font-bold text-sm">{asset.ticker.substring(0, 2)}</div><div><div className="font-bold text-white">{asset.ticker}</div><div className="text-[10px] text-white/20 font-black uppercase tracking-wide">Última: {asset.lastUpdate.toLocaleDateString('pt-BR')}</div></div></div></td>
                        <td className="px-6 py-5 font-bold text-white/80">{asset.totalQuantity}</td>
                        <td className="px-6 py-5 font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(asset.averagePrice)}</td>
                        <td className="px-6 py-5 font-bold text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(asset.totalInvested)}</td>
                        <td className="px-6 py-5 text-right"><button className="p-2 hover:bg-white/5 rounded-lg text-white/20 hover:text-white transition-all" title="Ver transações"><History size={18} /></button></td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        ) : !loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-white/20"><Calculator size={40} /></div>
            <div><h2 className="text-xl font-bold text-white">Nenhum dado importado</h2><p className="text-white/40 max-w-xs mx-auto mt-2">Importe sua planilha de negociações da B3 para ver o cálculo do seu preço médio.</p></div>
          </div>
        ) : (
          <div className="py-20 text-center"><RefreshCcw className="animate-spin text-primary mx-auto mb-4" size={40} /><p className="text-white/40">Processando planilha...</p></div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon }: { title: string, value: any, icon: any }) => (
  <div className="bg-card border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-8 text-white/[0.02] group-hover:text-primary/5 transition-colors -mr-4 -mt-4">{React.cloneElement(icon, { size: 80 })}</div>
    <div className="relative z-10 space-y-2">
      <div className="text-white/40 font-black uppercase tracking-widest text-[10px]">{title}</div>
      <div className="text-2xl font-black text-white">{value}</div>
    </div>
  </div>
);
