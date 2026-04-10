import React, { useState, useMemo } from 'react';
import { Landmark, Calculator, Globe, FileText, DollarSign, ArrowRightLeft, Upload } from 'lucide-react';
import { useInvestmentStore } from '../store/useInvestmentStore';
import * as XLSX from 'xlsx';

interface InternationalAsset {
  id: string;
  ticker: string;
  quantity: number;
  costBasisUSD: number;
  costBasisBRL: number;
  purchaseDate: string;
}

export const TaxModule = () => {
  const { historicalTransactions, setHistoricalTransactions } = useInvestmentStore();
  const [activeSection, setActiveSection] = useState<'br' | 'exterior'>('br');
  const [selectedYear] = useState(new Date().getFullYear() - 1);

  // Shared B3 parsing logic
  const parseB3Excel = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          const headers = jsonData[0] as string[];
          const getIndex = (name: string) => headers.findIndex(h => h?.includes(name));

          const dateIdx = getIndex('Data do Negócio');
          const typeIdx = getIndex('Tipo de Movimentação');
          const tickerIdx = getIndex('Código de Negociação');
          const qtyIdx = getIndex('Quantidade');
          const priceIdx = getIndex('Preço');
          const totalIdx = getIndex('Valor');

          if (dateIdx === -1 || tickerIdx === -1) throw new Error("Formato inválido.");

          const rawTransactions: any[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row[tickerIdx]) continue;
            let ticker = String(row[tickerIdx]).trim().toUpperCase();
            if (ticker.endsWith('F') && ticker.length > 5) ticker = ticker.slice(0, -1);

            const cleanValue = (val: any) => {
              if (typeof val === 'number') return val;
              if (!val) return 0;
              let s = String(val).replace('R$', '').trim();
              if (s.includes(',') && s.includes('.')) {
                if (s.indexOf(',') < s.indexOf('.')) s = s.replace(/,/g, '');
                else s = s.replace(/\./g, '').replace(',', '.');
              } else if (s.includes(',')) s = s.replace(',', '.');
              return parseFloat(s) || 0;
            };

            const dateStr = row[dateIdx];
            let date: Date;
            if (typeof dateStr === 'number') date = new Date((dateStr - 25569) * 86400 * 1000);
            else {
              const parts = String(dateStr).split('/');
              date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }

            rawTransactions.push({
              date,
              type: row[typeIdx]?.trim() as 'Compra' | 'Venda',
              ticker,
              quantity: Number(row[qtyIdx]),
              price: cleanValue(row[priceIdx]),
              total: cleanValue(row[totalIdx])
            });
          }

          rawTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());
          const enhanced = rawTransactions.map((t, idx) => {
             const isFII = t.ticker.endsWith('11') && !['VALE11', 'ITUB11', 'BOVA11'].includes(t.ticker);
             const isDayTrade = rawTransactions.some((other, oIdx) => idx !== oIdx && other.ticker === t.ticker && other.date.getTime() === t.date.getTime() && other.type !== t.type);
             return { ...t, isFII, isDayTrade };
          });

          setHistoricalTransactions(enhanced);
        } catch (err: any) {
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
    }
  };

  // Brazil calculations based on B3 Excel
  const brAnalysis = useMemo(() => {
    if (!historicalTransactions.length) return null;

    const yearTransactions = historicalTransactions.filter(t => new Date(t.date).getFullYear() <= selectedYear);
    const positionsAtYearEnd: Record<string, any> = {};
    const monthlySales: Record<string, { total: number, profit: number, exempt: boolean, isFII: boolean, ops: any[] }> = {};

    yearTransactions.forEach(t => {
      const tDate = new Date(t.date);
      const isDeclaringYear = tDate.getFullYear() === selectedYear;
      const monthKey = `${tDate.getFullYear()}-${tDate.getMonth() + 1}`;

      if (!positionsAtYearEnd[t.ticker]) {
        positionsAtYearEnd[t.ticker] = { ticker: t.ticker, qty: 0, totalInvested: 0, avgPrice: 0, isFII: t.isFII };
      }
      const p = positionsAtYearEnd[t.ticker];
      if (t.type === 'Compra') {
        p.qty += t.quantity;
        p.totalInvested += t.total;
        p.avgPrice = p.totalInvested / p.qty;
      } else {
        const saleProfit = (t.price - p.avgPrice) * t.quantity;
        const ratio = t.quantity / p.qty;
        if (isDeclaringYear) {
          if (!monthlySales[monthKey]) monthlySales[monthKey] = { total: 0, profit: 0, exempt: false, isFII: t.isFII, ops: [] };
          monthlySales[monthKey].total += t.total;
          monthlySales[monthKey].profit += saleProfit;
          monthlySales[monthKey].ops.push({ ticker: t.ticker, profit: saleProfit, quantity: t.quantity, price: t.price });
        }
        p.qty -= t.quantity;
        p.totalInvested -= (p.totalInvested * ratio);
        if (p.qty <= 0) { p.qty = 0; p.totalInvested = 0; p.avgPrice = 0; }
      }
    });

    Object.keys(monthlySales).forEach(m => {
      const s = monthlySales[m];
      const isFII = s.ops.every(o => o.ticker.endsWith('11')); // Simplificação
      if (!isFII && s.total <= 20000) s.exempt = true;
    });

    return { 
      finalPositions: Object.values(positionsAtYearEnd).filter((p: any) => p.qty > 0),
      monthlySales: Object.entries(monthlySales).sort((a,b) => b[0].localeCompare(a[0]))
    };
  }, [historicalTransactions, selectedYear]);

  const [extAssets, setExtAssets] = useState<InternationalAsset[]>([]);
  const [showExtForm, setShowExtForm] = useState(false);
  const [newExt, setNewExt] = useState({ ticker: '', qty: 0, costUSD: 0, costBRL: 0 });
  const [newExtInputs, setNewExtInputs] = useState({ qty: '0', costUSD: '0', costBRL: '0' });

  const handleAddExt = (e: React.FormEvent) => {
    e.preventDefault();
    setExtAssets([...extAssets, { 
      id: crypto.randomUUID(), 
      ticker: newExt.ticker.toUpperCase(), 
      quantity: newExt.qty, 
      costBasisUSD: newExt.costUSD, 
      costBasisBRL: newExt.costBRL, 
      purchaseDate: new Date().toISOString() 
    }]);
    setNewExt({ ticker: '', qty: 0, costUSD: 0, costBRL: 0 });
    setNewExtInputs({ qty: '0', costUSD: '0', costBRL: '0' });
    setShowExtForm(false);
  };

  return (
    <div className="flex-1 h-full p-8 bg-background/50">
      <div className="h-full mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3"><Landmark className="text-primary" size={32} />Auxiliar IRPF {selectedYear + 1}</h1>
            <p className="text-white/40 mt-1 font-medium">Fluxo de negociações de {selectedYear}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
              <button onClick={() => setActiveSection('br')} className={`px-6 py-2 rounded-xl font-bold transition-all ${activeSection === 'br' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>Brasil</button>
              <button onClick={() => setActiveSection('exterior')} className={`px-6 py-2 rounded-xl font-bold transition-all ${activeSection === 'exterior' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>Exterior</button>
            </div>
            {activeSection === 'br' && (
              <label className="flex items-center gap-3 px-6 py-2.5 bg-white/5 text-white border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all font-bold">
                <Upload size={18} /><span>Importar B3</span>
                <input type="file" className="hidden" accept=".xlsx" onChange={(e) => e.target.files?.[0] && parseB3Excel(e.target.files[0])} />
              </label>
            )}
          </div>
        </div>

        {activeSection === 'br' ? (
          <div className="space-y-8">
            {!brAnalysis ? (
              <div className="bg-card border border-white/5 p-20 rounded-[40px] text-center space-y-4">
                <Calculator className="mx-auto text-white/5" size={80} />
                <h2 className="text-2xl font-bold text-white">Pronto para a Declaração?</h2>
                <p className="text-white/40 max-sm mx-auto">Importe sua planilha de negociações da B3 para gerar automaticamente os relatórios de Bens e Direitos e Renda Variável.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-220px)]">
                {/* Coluna 1: Bens e Direitos */}
                <Section title="Bens e Direitos (31/12)" icon={<FileText size={18} />} className="min-h-0">
                  <div className="bg-card border border-white/5 rounded-3xl overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-sm border-separate border-spacing-0">
                        <thead className="bg-white/5 text-[10px] font-black uppercase text-white/40 tracking-widest sticky top-0 z-10">
                          <tr><th className="px-6 py-4 bg-[#1a1c1e] border-b border-white/5">Ativo</th><th className="px-6 py-4 bg-[#1a1c1e] border-b border-white/5">Qtd.</th><th className="px-6 py-4 bg-[#1a1c1e] border-b border-white/5">PM</th><th className="px-6 py-4 bg-[#1a1c1e] border-b border-white/5">Custo Total</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {brAnalysis.finalPositions.map((p: any) => (
                            <tr key={p.ticker} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4 font-bold text-white border-b border-white/5">{p.ticker}</td>
                              <td className="px-6 py-4 text-white/60 border-b border-white/5">{p.qty}</td>
                              <td className="px-6 py-4 text-white/40 border-b border-white/5">{formatBRL(p.avgPrice)}</td>
                              <td className="px-6 py-4 font-bold text-primary border-b border-white/5">{formatBRL(p.totalInvested)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Section>

                {/* Coluna 2: Renda Variável */}
                <Section title="Ganhos e Perdas Mensais" icon={<ArrowRightLeft size={18} />} className="min-h-0">
                  <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {brAnalysis.monthlySales.map(([month, data]: [string, any]) => (
                      <div key={month} className="bg-card border border-white/5 rounded-3xl overflow-hidden shrink-0">
                        <div className="p-5 flex justify-between items-center bg-white/5 border-b border-white/5">
                          <span className="font-bold text-white">{formatMonth(month)}</span>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${data.exempt ? 'bg-green-500/10 text-green-400' : 'bg-primary/10 text-primary'}`}>
                            {data.exempt ? 'Vendas Isentas' : 'Tributável'}
                          </span>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-2xl"><div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Vendas Totais</div><div className="text-sm font-bold text-white">{formatBRL(data.total)}</div></div>
                            <div className="bg-white/5 p-4 rounded-2xl"><div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Resultado Líquido</div><div className={`text-sm font-bold ${data.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatBRL(data.profit)}</div></div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-[10px] font-black text-white/30 uppercase tracking-widest px-1">Detalhamento das Vendas</div>
                            <div className="space-y-1">
                              {data.ops.map((op: any, i: number) => (
                                <div key={i} className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors border border-dashed border-white/5">
                                  <div>
                                    <div className="font-bold text-white text-xs">{op.ticker}</div>
                                    <div className="text-[10px] text-white/40">{op.quantity} un. @ {formatBRL(op.price)}</div>
                                  </div>
                                  <div className={`text-xs font-bold ${op.profit >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                                    {op.profit >= 0 ? '+' : ''}{formatBRL(op.profit)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 h-[calc(100vh-200px)]">
            <div className="bg-primary/10 border border-primary/20 p-6 rounded-3xl flex gap-4 shrink-0">
              <Globe className="text-primary shrink-0" size={24} /><div className="space-y-1"><h3 className="font-bold text-white">Regras para o Exterior</h3><p className="text-white/60 text-sm leading-relaxed">Lucros anuais no exterior são tributados em <b>15%</b>. Converta os valores usando a PTAX de compra da data da transação.</p></div>
            </div>
            {extAssets.length > 0 && (
              <Section title="Bens e Direitos (Exterior)" icon={<Globe size={18} />} className="flex-1 min-h-0">
                <div className="bg-card border border-white/5 rounded-3xl overflow-hidden h-full overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-[10px] font-black uppercase text-white/40 tracking-widest sticky top-0 z-10">
                      <tr><th className="px-6 py-4">Ativo</th><th className="px-6 py-4">Qtd.</th><th className="px-6 py-4">Total (USD)</th><th className="px-6 py-4">Total (BRL)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {extAssets.map((a) => (
                        <tr key={a.id} className="hover:bg-white/[0.02] transition-colors"><td className="px-6 py-4 font-bold text-white">{a.ticker}</td><td className="px-6 py-4 text-white/60">{a.quantity}</td><td className="px-6 py-4 text-white/40">${a.costBasisUSD.toFixed(2)}</td><td className="px-6 py-4 font-bold text-primary">{formatBRL(a.costBasisBRL)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
            <div className="bg-card border border-white/5 p-12 rounded-[40px] text-center space-y-4 shrink-0">
              {!showExtForm ? (
                <div className="max-w-md mx-auto"><DollarSign className="mx-auto text-white/10" size={64} /><h2 className="text-xl font-bold text-white">Ativos Internacionais</h2><p className="text-white/40 mt-2">Gestão manual de Stocks e ETFs globais.</p><button onClick={() => setShowExtForm(true)} className="mt-6 px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold border border-white/10 transition-all">Cadastrar Ativo</button></div>
              ) : (
                <form onSubmit={handleAddExt} className="max-w-md mx-auto text-left space-y-4"><h3 className="text-lg font-bold text-white text-center mb-4">Novo Ativo Exterior</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase">Ticker</label>
                        <input type="text" required value={newExt.ticker} onChange={e => setNewExt({...newExt, ticker: e.target.value})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white focus:outline-none focus:border-primary" placeholder="Ex: TSLA" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase">Qtd.</label>
                        <input 
                          type="number" 
                          step="any"
                          required 
                          value={newExtInputs.qty} 
                          onChange={e => {
                            const val = e.target.value;
                            setNewExtInputs(prev => ({ ...prev, qty: val }));
                            const num = parseFloat(val);
                            if (!isNaN(num)) setNewExt({ ...newExt, qty: num });
                          }} 
                          className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white focus:outline-none focus:border-primary" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase">Custo (USD)</label>
                        <input 
                          type="number" 
                          step="any" 
                          required 
                          value={newExtInputs.costUSD} 
                          onChange={e => {
                            const val = e.target.value;
                            setNewExtInputs(prev => ({ ...prev, costUSD: val }));
                            const num = parseFloat(val);
                            if (!isNaN(num)) setNewExt({ ...newExt, costUSD: num });
                          }} 
                          className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white focus:outline-none focus:border-primary" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-white/40 uppercase">Custo (BRL)</label>
                        <input 
                          type="number" 
                          step="any" 
                          required 
                          value={newExtInputs.costBRL} 
                          onChange={e => {
                            const val = e.target.value;
                            setNewExtInputs(prev => ({ ...prev, costBRL: val }));
                            const num = parseFloat(val);
                            if (!isNaN(num)) setNewExt({ ...newExt, costBRL: num });
                          }} 
                          className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white focus:outline-none focus:border-primary" 
                        />
                      </div>
                    </div>
                   <div className="flex gap-2 pt-4"><button type="button" onClick={() => setShowExtForm(false)} className="flex-1 px-6 py-3 bg-white/5 text-white rounded-xl font-bold">Cancelar</button><button type="submit" className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20">Salvar</button></div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Section = ({ title, icon, children, className = "" }: { title: string, icon: any, children: React.ReactNode, className?: string }) => (
  <div className={`space-y-5 flex flex-col ${className}`}>
    <div className="flex items-center gap-3 px-2">
      <div className="p-2 bg-primary/10 rounded-lg text-primary">{icon}</div>
      <h2 className="text-lg font-black text-white uppercase tracking-tight">{title}</h2>
    </div>
    {children}
  </div>
);

const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatMonth = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
