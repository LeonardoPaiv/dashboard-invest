import React, { useState } from 'react';
import { ExtraAmortizationConfig, LumpSumAmortization } from '../../types/financing';
import {
  Zap,
  Target,
  Clock,
  CalendarPlus,
  Trash2,
  Plus,
  Sparkles
} from 'lucide-react';

interface Props {
  config: ExtraAmortizationConfig;
  onChange: (partial: Partial<ExtraAmortizationConfig>) => void;
  onAddLumpSum: (lumpSum: Omit<LumpSumAmortization, 'id'>) => void;
  onRemoveLumpSum: (id: string) => void;
}

export const AmortizationStrategyPanel: React.FC<Props> = ({
  config,
  onChange,
  onAddLumpSum,
  onRemoveLumpSum
}) => {
  const [newLumpMonth, setNewLumpMonth] = useState('12');
  const [newLumpAmount, setNewLumpAmount] = useState('10000');
  const [newLumpRecalc, setNewLumpRecalc] = useState<'prazo' | 'parcela'>('prazo');
  const [newLumpDesc, setNewLumpDesc] = useState('Saque FGTS');

  const handleAddLump = (e: React.FormEvent) => {
    e.preventDefault();
    const month = parseInt(newLumpMonth);
    const amount = parseFloat(newLumpAmount);
    if (!isNaN(month) && month > 0 && !isNaN(amount) && amount > 0) {
      onAddLumpSum({
        month,
        amount,
        recalculation: newLumpRecalc,
        description: newLumpDesc || 'Aporte Extraordinário'
      });
      setNewLumpAmount('');
      setNewLumpDesc('Aporte Extra');
    }
  };

  return (
    <div className="bg-card border border-white/10 rounded-2xl p-5 space-y-6">
      {/* Header com Toggle Geral de Ativação */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-amber-400" />
          <h3 className="font-bold text-sm text-white">Estratégia de Amortização Extraordinária</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {!config.enabled ? (
        <div className="text-center py-6 px-4 bg-white/5 border border-white/5 rounded-2xl">
          <Sparkles size={28} className="mx-auto text-amber-400/60 mb-2" />
          <h4 className="text-xs font-bold text-white mb-1">Turbine sua Quitação</h4>
          <p className="text-[11px] text-white/40 max-w-sm mx-auto leading-relaxed">
            Ative para simular aportes mensais, meta de parcela alvo, janelas de tempo ou uso periódico do FGTS e descubra quanto você economiza em juros e anos de dívida.
          </p>
          <button
            type="button"
            onClick={() => onChange({ enabled: true })}
            className="mt-3 px-4 py-1.5 bg-primary text-black font-black text-xs rounded-xl hover:bg-emerald-400 transition-colors"
          >
            Ativar Simulador de Estratégia
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Modalidade de Recálculo (Prazo vs Parcela) */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-white/40 flex items-center justify-between">
              <span>Modalidade de Recálculo do Contrato</span>
              <span className="text-primary font-bold lowercase">
                {config.recalculation === 'prazo' ? 'maximiza corte de juros' : 'alivia orçamento mensal'}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange({ recalculation: 'prazo' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  config.recalculation === 'prazo'
                    ? 'bg-primary/10 border-primary text-white shadow-lg shadow-primary/10'
                    : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">Reduzir Prazo</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-primary uppercase">
                    Recomendado
                  </span>
                </div>
                <p className="text-[10px] text-white/40 leading-tight">
                  Encurta os anos mantendo a parcela. Elimina a maior quantidade de juros futuros.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChange({ recalculation: 'parcela' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  config.recalculation === 'parcela'
                    ? 'bg-secondary/10 border-secondary text-white shadow-lg shadow-secondary/10'
                    : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">Reduzir Parcela</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-secondary uppercase">
                    Fluxo de Caixa
                  </span>
                </div>
                <p className="text-[10px] text-white/40 leading-tight">
                  Mantém o prazo original e reduz o valor das parcelas seguintes para dar fôlego mensal.
                </p>
              </button>
            </div>
          </div>

          {/* Seleção de Modo de Amortização */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-white/40">
              Tipo de Estratégia
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange({ mode: 'constant' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  config.mode === 'constant'
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-amber-400" />
                  <span className="font-bold text-xs text-white">Constante até o Final</span>
                </div>
                <p className="text-[10px] text-white/40">
                  Aporte extra todo mês até quitar totalmente o imóvel.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChange({ mode: 'target_installment', recalculation: 'parcela' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  config.mode === 'target_installment'
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Target size={14} className="text-emerald-400" />
                  <span className="font-bold text-xs text-white">Parcela Alvo ($X)</span>
                </div>
                <p className="text-[10px] text-white/40">
                  Amortizar até a parcela mensal cair para um valor confortável.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChange({ mode: 'time_period' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  config.mode === 'time_period'
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-sky-400" />
                  <span className="font-bold text-xs text-white">Por Período de Tempo</span>
                </div>
                <p className="text-[10px] text-white/40">
                  Aportar extras durante uma janela definida (ex: primeiros 3 ou 5 anos).
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChange({ mode: 'lump_sum' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  config.mode === 'lump_sum'
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CalendarPlus size={14} className="text-purple-400" />
                  <span className="font-bold text-xs text-white">Aportes Avulsos & FGTS</span>
                </div>
                <p className="text-[10px] text-white/40">
                  Aportes pontuais com bônus ou saques bienais de FGTS.
                </p>
              </button>
            </div>
          </div>

          {/* Inputs Dinâmicos Conforme o Modo */}
          {config.mode === 'constant' && (
            <div className="space-y-1.5 bg-black/20 p-3.5 rounded-xl border border-white/5">
              <label className="text-[10px] font-black uppercase tracking-wider text-white/40 flex justify-between">
                <span>Aporte Extra Mensal (R$)</span>
                <span className="text-primary font-bold">Todo mês</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">R$</span>
                <input
                  type="number"
                  step="100"
                  value={config.monthlyAmount}
                  onChange={(e) => onChange({ monthlyAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-3 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {config.mode === 'target_installment' && (
            <div className="space-y-3 bg-black/20 p-3.5 rounded-xl border border-white/5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-white/40 flex justify-between">
                  <span>Meta de Parcela Alvo Desejada (R$)</span>
                  <span className="text-emerald-400 font-bold">Teto pretendido</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">R$</span>
                  <input
                    type="number"
                    step="100"
                    value={config.targetInstallment}
                    onChange={(e) => onChange({ targetInstallment: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-3 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-white/40 flex justify-between">
                  <span>Aporte Mensal Extra até Atingir a Meta (R$)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">R$</span>
                  <input
                    type="number"
                    step="100"
                    value={config.monthlyAmount}
                    onChange={(e) => onChange({ monthlyAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-3 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
                  />
                </div>
              </div>
              <p className="text-[11px] text-white/40 leading-tight">
                💡 O simulador aplicará os aportes mensais na modalidade "Reduzir Parcela" até que o encargo mensal caia para R$ {config.targetInstallment.toLocaleString('pt-BR')}. Depois disso, os aportes extras cessarão automaticamente.
              </p>
            </div>
          )}

          {config.mode === 'time_period' && (
            <div className="space-y-3 bg-black/20 p-3.5 rounded-xl border border-white/5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-white/40">
                  Aporte Extra Mensal no Período (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">R$</span>
                  <input
                    type="number"
                    step="100"
                    value={config.monthlyAmount}
                    onChange={(e) => onChange({ monthlyAmount: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-3 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/40">Do Mês:</label>
                  <input
                    type="number"
                    min="1"
                    value={config.periodStartMonth}
                    onChange={(e) => onChange({ periodStartMonth: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 px-3 text-xs font-bold text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/40">Até o Mês:</label>
                  <input
                    type="number"
                    min="1"
                    value={config.periodEndMonth}
                    onChange={(e) => onChange({ periodEndMonth: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 px-3 text-xs font-bold text-white outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Seção de Aportes Avulsos / FGTS Adicionais */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                <CalendarPlus size={14} className="text-purple-400" />
                <span>Aportes Pontuais & FGTS</span>
                <span className="text-white/30 font-normal">({config.lumpSums.length})</span>
              </label>
            </div>

            {/* Formulário para Inserir Aporte Pontual */}
            <form onSubmit={handleAddLump} className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-white/40 uppercase">Mês</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Mês (ex: 12)"
                    value={newLumpMonth}
                    onChange={(e) => setNewLumpMonth(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-xs font-bold text-white outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-bold text-white/40 uppercase">Valor do Aporte (R$)</label>
                  <input
                    type="number"
                    step="500"
                    placeholder="Valor (R$)"
                    value={newLumpAmount}
                    onChange={(e) => setNewLumpAmount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-xs font-bold text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-white/40 uppercase">Estratégia</label>
                  <select
                    value={newLumpRecalc}
                    onChange={(e) => setNewLumpRecalc(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-1.5 text-xs font-bold text-white outline-none"
                  >
                    <option value="prazo" className="bg-card">Reduzir Prazo</option>
                    <option value="parcela" className="bg-card">Reduzir Parcela</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Motivo / Descrição (ex: Bônus Anual, FGTS Bienal)"
                  value={newLumpDesc}
                  onChange={(e) => setNewLumpDesc(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-xs text-white/80 outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-primary/20 text-primary hover:bg-primary/30 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
            </form>

            {/* Lista de Aportes Cadastrados */}
            {config.lumpSums.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                {config.lumpSums.map((lump) => (
                  <div
                    key={lump.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 text-[10px]">
                        Mês {lump.month}
                      </span>
                      <span className="text-white font-bold">
                        R$ {lump.amount.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-[10px] text-white/40 truncate max-w-[120px]">
                        {lump.description}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white/60">
                        {lump.recalculation === 'prazo' ? 'Prazo' : 'Parcela'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveLumpSum(lump.id)}
                      className="p-1 text-white/30 hover:text-rose-400 transition-colors"
                      title="Excluir aporte"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
