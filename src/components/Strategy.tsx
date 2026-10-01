import React, { useState, useEffect } from 'react';
import { useInvestmentStore } from '../store/useInvestmentStore';
import { Target, Bot, PlusCircle, Trash2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { computeAllocation } from '../domain/allocation';
import { collectCategories, listAssets } from '../domain/assets';
import { SnapshotAllocation, SnapshotDetail } from './strategy/SnapshotDetail';
import { TargetsEditor } from './strategy/TargetsEditor';

export const Strategy = () => {
  const { portfolio, portfolios, assetCategories, settings, setSettings, snapshots, addSnapshot, deleteSnapshot, contributionAmount, setContributionAmount } = useInvestmentStore();
  const [selectedSnapId, setSelectedSnapId] = useState<string | null>(null);
  const [expandedSnapIds, setExpandedSnapIds] = useState<Set<string>>(new Set());

  // Input states to avoid conversion issues while typing
  const [contributionInput, setContributionInput] = useState(contributionAmount.toString());

  // Sync with store changes
  useEffect(() => {
    if (parseFloat(contributionInput) !== contributionAmount) {
      setContributionInput(contributionAmount.toString());
    }
  }, [contributionAmount]);

  if (!portfolio) return <div className="p-10 text-center text-white/40">Faça upload da carteira primeiro.</div>;

  const allocation = computeAllocation(portfolio, settings.alvos, collectCategories(assetCategories, portfolios));
  const total = allocation.reduce((acc, row) => acc + row.value, 0);
  const currentAlloc = Object.fromEntries(allocation.map((row) => [row.name, row.currentPct]));

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(expandedSnapIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedSnapIds(newSet);
  };

  const generatePrompt = () => {
    const assetsSummary = listAssets(portfolio)
      .map((asset) => `${asset.ticker} (${asset.category}): R$ ${asset.value.toLocaleString('pt-BR')}`)
      .join('\n');
    const targetsSummary = allocation.filter((row) => row.inStrategy).map((row) => `- ${row.name}: ${row.targetPct}%`).join('\n');
    const currentSummary = allocation.map((row) => `- ${row.name}: ${row.currentPct.toFixed(1)}%${row.inStrategy ? '' : ' (sem alvo)'}`).join('\n');

    const prompt = `### 🤖 Prompt de Rebalanceamento Estratégico
Atue como um analista de investimentos sênior. 

**💰 Novo Aporte:** R$ ${contributionAmount.toLocaleString('pt-BR')}

**🎯 Alvos da Estratégia:**
${targetsSummary || '- Não definidos'}

**📈 Alocação Atual:**
${currentSummary}

**📝 Minha Política de Investimentos:**
"${settings.estrategia || 'Não definida'}"

**📂 Composição Atual da Carteira:**
${assetsSummary}

**🚀 Missão:**
Com base no aporte de R$ ${contributionAmount.toLocaleString('pt-BR')}, sugira exatamente quais ativos comprar (e quanto em cada um) para aproximar a carteira dos meus alvos, respeitando a minha política de investimentos acima. Avalie se faz sentido fazer trocas de ativos respeitando a estratégia estabelecida.`;
    
    navigator.clipboard.writeText(prompt);
    alert("Prompt completo copiado com sucesso!");
  };

  const selectedSnap = snapshots.find(s => s.id === selectedSnapId) || snapshots[0];

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar">
      <header>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Estratégia & Alocação</h2>
        <p className="text-xs md:text-sm text-white/40">Projete seus aportes com base em seus alvos estratégicos.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 items-start">
        {/* Settings & Aporte Section */}
        <div className="space-y-6">
          <Card title="Estratégia e Alvos" icon={<Target className="text-primary" size={20}/>}>
            <div className="space-y-6">
              <TargetsEditor />

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">Política de Investimentos</label>
                <textarea 
                  className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-primary/50 outline-none transition-all placeholder:text-white/10"
                  placeholder="Ex: Focar em dividendos e ativos de valor..."
                  value={settings.estrategia}
                  onChange={(e) => setSettings({ ...settings, estrategia: e.target.value })}
                />
              </div>

              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-white/30 uppercase tracking-widest">
                  <PlusCircle size={14} className="text-secondary" /> Novo Aporte
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-lg">R$</span>
                    <input 
                      type="number" 
                      step="any"
                      value={contributionInput} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setContributionInput(val);
                        const num = parseFloat(val);
                        if (!isNaN(num)) setContributionAmount(num);
                        else if (val === '') setContributionAmount(0);
                      }}
                      className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 pl-12 text-2xl font-black text-primary focus:border-primary/50 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      const id = crypto.randomUUID();
                      addSnapshot({
                        id,
                        date: new Date().toLocaleDateString(),
                        portfolio_total: total,
                        aporte: contributionAmount,
                        targets: { ...settings.alvos },
                        current: currentAlloc,
                        result: ''
                      });
                      setSelectedSnapId(id);
                    }}
                    className="flex-1 py-3 bg-secondary/10 border border-secondary/20 text-secondary font-black rounded-2xl hover:bg-secondary/20 transition-all text-[10px] uppercase tracking-widest"
                  >
                    Snapshot
                  </button>
                  <button 
                    type="button"
                    onClick={generatePrompt}
                    className="flex-1 py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
                  >
                    <Bot size={14} /> Gerar Prompt
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Snapshots & Research Area */}
        <div className="xl:col-span-2 space-y-6">
          <Card title="Notas de Research & Snapshots" icon={<FileText className="text-secondary" size={20}/>}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[500px]">
              <div className="lg:col-span-2 space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                {snapshots.map(snap => {
                  const isExpanded = expandedSnapIds.has(snap.id);
                  const isSelected = selectedSnapId === snap.id || (!selectedSnapId && snapshots[0]?.id === snap.id);
                  
                  return (
                    <div 
                      key={snap.id} 
                      onClick={() => setSelectedSnapId(snap.id)}
                      className={`rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                        isSelected 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'bg-white/2 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="p-4 flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={(e) => toggleExpand(snap.id, e)}
                            className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <div>
                            <h4 className="font-bold text-sm text-white/80">{snap.date}</h4>
                            <p className="text-[10px] text-primary/60 font-black">R$ {snap.aporte.toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSnapshot(snap.id);
                            if (selectedSnapId === snap.id) setSelectedSnapId(null);
                          }} 
                          className="p-1.5 text-white/5 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-white/5 bg-black/10">
                          <SnapshotAllocation current={snap.current} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {snapshots.length === 0 && <div className="py-12 text-center text-white/20 border-2 border-dashed border-white/5 rounded-[32px]">Nenhum snapshot salvo ainda.</div>}
              </div>

              <div className="lg:col-span-3 bg-black/40 border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl">
                {selectedSnap ? (
                  <SnapshotDetail snap={selectedSnap} />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-white/20 p-10 text-center">
                    <FileText size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">Selecione um snapshot para visualizar ou editar.</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, icon, children }: any) => (
  <div className="bg-card border border-white/10 rounded-[32px] p-6 h-full flex flex-col shadow-2xl">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">{icon}</div>
      <h3 className="text-lg font-black tracking-tight">{title}</h3>
    </div>
    <div className="flex-1">{children}</div>
  </div>
);
