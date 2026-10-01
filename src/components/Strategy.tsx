import { useState, useEffect } from 'react';
import { useInvestmentStore } from '../store/useInvestmentStore';
import { Target, Bot, Check, Copy, PlusCircle, ScrollText } from 'lucide-react';
import { computeAllocation } from '../domain/allocation';
import { collectCategories, listAssets } from '../domain/assets';
import { TargetsEditor } from './strategy/TargetsEditor';

export const Strategy = () => {
  const { portfolio, portfolios, assetCategories, settings, setSettings, contributionAmount, setContributionAmount } = useInvestmentStore();
  const [copied, setCopied] = useState(false);

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
${currentSummary || '- Carteira vazia'}

**📝 Minha Política de Investimentos:**
"${settings.estrategia || 'Não definida'}"

**📂 Composição Atual da Carteira:**
${assetsSummary || 'Sem ativos'}

**🚀 Missão:**
Com base no aporte de R$ ${contributionAmount.toLocaleString('pt-BR')}, sugira exatamente quais ativos comprar (e quanto em cada um) para aproximar a carteira dos meus alvos, respeitando a minha política de investimentos acima. Avalie se faz sentido fazer trocas de ativos respeitando a estratégia estabelecida.`;

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar">
      <header>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Estratégia & Alocação</h2>
        <p className="text-xs md:text-sm text-white/40">Projete seus aportes com base em seus alvos estratégicos.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8 items-start">
        <Card title="Classes e Alvos" icon={<Target className="text-primary" size={20}/>}>
          <TargetsEditor />
        </Card>

        <div className="space-y-6 md:space-y-8">
          <Card title="Política e Aporte" icon={<ScrollText className="text-secondary" size={20}/>}>
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="strategy-policy" className="text-[10px] font-black text-white/30 uppercase tracking-widest">Política de Investimentos</label>
                <textarea
                  id="strategy-policy"
                  className="w-full h-36 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-primary/50 outline-none transition-all placeholder:text-white/10"
                  placeholder="Ex: Focar em dividendos e ativos de valor..."
                  value={settings.estrategia}
                  onChange={(e) => setSettings({ ...settings, estrategia: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="strategy-contribution" className="flex items-center gap-2 text-[10px] font-black text-white/30 uppercase tracking-widest">
                  <PlusCircle size={14} className="text-secondary" /> Novo Aporte
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-bold text-lg">R$</span>
                  <input
                    id="strategy-contribution"
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
            </div>
          </Card>

          <Card title="Prompt de Rebalanceamento" icon={<Bot className="text-primary" size={20}/>}>
            <div className="space-y-4">
              <p className="text-[11px] text-white/40">
                Montado com os alvos salvos, a alocação atual, a política e o aporte. Copie e cole na IA de sua preferência.
              </p>
              <pre aria-label="Prévia do prompt" className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words bg-black/40 border border-white/5 rounded-2xl p-4 text-[11px] leading-relaxed text-white/70 font-mono scrollbar-thin scrollbar-thumb-white/10">
                {prompt}
              </pre>
              <button
                type="button"
                onClick={copyPrompt}
                className="w-full py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
              >
                {copied ? <><Check size={14} /> Prompt copiado</> : <><Copy size={14} /> Copiar Prompt</>}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, icon, children }: any) => (
  <div className="bg-card border border-white/10 rounded-[32px] p-6 flex flex-col shadow-2xl">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">{icon}</div>
      <h3 className="text-lg font-black tracking-tight">{title}</h3>
    </div>
    <div className="flex-1">{children}</div>
  </div>
);
