import React, { useState } from 'react';
import { useInvestmentStore } from '../store/useInvestmentStore';
import { Target, Bot, PlusCircle, Trash2, Save, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SnapshotDetail = ({ snap }: { snap: any }) => {
  const { updateSnapshotResult } = useInvestmentStore();
  const [isEditing, setIsEditing] = useState(!snap.result);

  return (
    <div className="flex flex-col h-full bg-black/20">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
        <div>
          <h4 className="font-bold text-sm">{snap.date}</h4>
          <p className="text-[10px] text-primary uppercase font-bold tracking-widest">Aporte: R$ {snap.aporte.toLocaleString('pt-BR')}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-primary/20 text-primary' : 'text-white/20 hover:text-white'}`}
          >
            {isEditing ? <Save size={16} /> : <FileText size={16} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 p-2 bg-black/40 text-[9px] uppercase font-bold text-white/40 border-b border-white/5">
        <div className="text-center">FIIs: {snap.current.fiis.toFixed(1)}%</div>
        <div className="text-center">Ações: {snap.current.acoes.toFixed(1)}%</div>
        <div className="text-center">RF: {snap.current.rf.toFixed(1)}%</div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {isEditing ? (
          <textarea 
            className="w-full h-full bg-transparent p-6 text-sm outline-none focus:ring-0 resize-none font-mono text-white/80"
            placeholder="Cole o resultado da IA aqui (Markdown aceito)..."
            value={snap.result}
            onChange={(e) => updateSnapshotResult(snap.id, e.target.value)}
          />
        ) : (
          <div className="h-full overflow-y-auto p-8 prose prose-invert prose-sm max-w-none scrollbar-thin scrollbar-thumb-white/10">
            <ReactMarkdown>{snap.result || "*Nenhum resultado inserido. Clique no ícone de arquivo para editar.*"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

export const Strategy = () => {
  const { portfolio, settings, setSettings, snapshots, addSnapshot, deleteSnapshot } = useInvestmentStore();
  const [aporte, setAporte] = useState(1000);
  const [selectedSnapId, setSelectedSnapId] = useState<string | null>(null);
  const [expandedSnapIds, setExpandedSnapIds] = useState<Set<string>>(new Set());

  if (!portfolio) return <div className="p-10 text-center text-white/40">Faça upload da carteira primeiro.</div>;

  const total = portfolio.total_live;
  const currentAlloc = {
    fiis: (portfolio.fiis.reduce((acc, curr) => acc + (curr.Posicao || 0), 0) / total) * 100,
    acoes: (portfolio.acoes.reduce((acc, curr) => acc + (curr.Posicao || 0), 0) / total) * 100,
    rf: ((portfolio.tesouro.reduce((acc, curr) => acc + (curr.Posicao || 0), 0) + portfolio.renda_fixa.reduce((acc, curr) => acc + (curr.Posicao || 0), 0)) / total) * 100,
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(expandedSnapIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedSnapIds(newSet);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings({
      alvos: settings.alvos,
      estrategia: settings.estrategia,
    });
    alert("Configurações salvas com sucesso!");
  };

  const handleAlvoChange = (key: keyof typeof settings.alvos, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSettings({ ...settings, alvos: { ...settings.alvos, [key]: numValue } });
  };

  const generatePrompt = () => {
    const assetsSummary = [
      ...portfolio.fiis.map(f => `${f.Ticker} (FII): R$ ${f.Posicao.toLocaleString('pt-BR')}`),
      ...portfolio.acoes.map(a => `${a.Ticker} (Ação): R$ ${a.Posicao.toLocaleString('pt-BR')}`),
      ...portfolio.tesouro.map(t => `${t.Titulo} (Tesouro): R$ ${t.Posicao.toLocaleString('pt-BR')}`),
      ...portfolio.renda_fixa.map(r => `${r.Ativo} (RF): R$ ${r.Posicao.toLocaleString('pt-BR')}`),
    ].join('\n');

    const prompt = `### 🤖 Prompt de Rebalanceamento Estratégico
Atue como um analista de investimentos sênior. 

**💰 Novo Aporte:** R$ ${aporte.toLocaleString('pt-BR')}

**🎯 Alvos da Estratégia:**
- FIIs: ${settings.alvos.fiis}%
- Ações: ${settings.alvos.acoes}%
- Renda Fixa: ${settings.alvos.renda_fixa}%

**📈 Alocação Atual:**
- FIIs: ${currentAlloc.fiis.toFixed(1)}%
- Ações: ${currentAlloc.acoes.toFixed(1)}%
- Renda Fixa: ${currentAlloc.rf.toFixed(1)}%

**📝 Minha Política de Investimentos:**
"${settings.estrategia || 'Não definida'}"

**📂 Composição Atual da Carteira:**
${assetsSummary}

**🚀 Missão:**
Com base no aporte de R$ ${aporte.toLocaleString('pt-BR')}, sugira exatamente quais ativos comprar (e quanto em cada um) para aproximar a carteira dos meus alvos, respeitando a minha política de investimentos acima. Priorize os ativos que estão mais "para trás" in relação ao equilíbrio desejado.`;
    
    navigator.clipboard.writeText(prompt);
    alert("Prompt completo copiado com sucesso!");
  };

  const selectedSnap = snapshots.find(s => s.id === selectedSnapId) || snapshots[0];

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto scrollbar-hide">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Estratégia & Alocação</h2>
        <p className="text-white/40">Projete seus aportes com base em seus alvos estratégicos.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Settings & Aporte Section */}
        <div className="space-y-6">
          <Card title="Estratégia e Alvos" icon={<Target className="text-primary" size={20}/>}>
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Input label="FIIs (%)" value={settings.alvos.fiis} onChange={(e: any) => handleAlvoChange('fiis', e.target.value)} />
                <Input label="Ações (%)" value={settings.alvos.acoes} onChange={(e: any) => handleAlvoChange('acoes', e.target.value)} />
                <Input label="RF (%)" value={settings.alvos.renda_fixa} onChange={(e: any) => handleAlvoChange('renda_fixa', e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">Política de Investimentos</label>
                <textarea 
                  className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-primary/50 outline-none transition-all placeholder:text-white/10"
                  placeholder="Ex: Focar em dividendos e ativos de valor..."
                  value={settings.estrategia}
                  onChange={(e) => setSettings({ ...settings, estrategia: e.target.value })}
                />
              </div>

              <button type="submit" className="w-full py-3 bg-white/5 border border-white/10 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all text-xs uppercase tracking-widest">
                <Save size={16} /> Salvar Alvos
              </button>

              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-white/30 uppercase tracking-widest">
                  <PlusCircle size={14} className="text-secondary" /> Novo Aporte
                </div>
                
                <div className="space-y-2">
                  <input 
                    type="number" 
                    value={aporte} 
                    onChange={(e) => setAporte(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-2xl font-black text-primary focus:border-primary/50 outline-none transition-all"
                  />
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
                        aporte,
                        targets: { 
                          fiis: settings.alvos.fiis, 
                          acoes: settings.alvos.acoes, 
                          rf: settings.alvos.renda_fixa 
                        },
                        current: currentAlloc as any,
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
            </form>
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
                          <div className="grid grid-cols-3 gap-2">
                             <div className="text-center p-2 bg-white/5 rounded-xl border border-white/5">
                                <div className="text-[8px] text-white/30 uppercase font-black mb-1">FIIs</div>
                                <div className="text-[10px] font-bold text-primary">{snap.current.fiis.toFixed(1)}%</div>
                             </div>
                             <div className="text-center p-2 bg-white/5 rounded-xl border border-white/5">
                                <div className="text-[8px] text-white/30 uppercase font-black mb-1">Ações</div>
                                <div className="text-[10px] font-bold text-emerald-500">{snap.current.acoes.toFixed(1)}%</div>
                             </div>
                             <div className="text-center p-2 bg-white/5 rounded-xl border border-white/5">
                                <div className="text-[8px] text-white/30 uppercase font-black mb-1">RF</div>
                                <div className="text-[10px] font-bold text-orange-400">{snap.current.rf.toFixed(1)}%</div>
                             </div>
                          </div>
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

const Input = ({ label, value, onChange }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">{label}</label>
    <input 
      type="number" 
      value={value} 
      onChange={onChange}
      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
    />
  </div>
);
