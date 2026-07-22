import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Layers, Wallet, Plus, Settings2, Check } from 'lucide-react';
import { useInvestmentStore } from '../store/useInvestmentStore';
import { PortfolioManagerModal } from './PortfolioManagerModal';

export const PortfolioSelector: React.FC = () => {
  const { portfolios, activePortfolioId, setActivePortfolio, addPortfolio, portfolio } = useInvestmentStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);
  const isConsolidated = activePortfolioId === 'all';

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const totalValue = portfolio?.total_live || 0;

  const handleQuickCreate = () => {
    const name = prompt('Nome da nova carteira:');
    if (name && name.trim()) {
      addPortfolio(name.trim());
      setIsOpen(false);
    }
  };

  return (
    <>
      <div className="relative w-full" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0 pr-1">
            {isConsolidated ? (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-primary/20">
                <Layers size={16} />
              </div>
            ) : (
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md"
                style={{ backgroundColor: activePortfolio?.color || '#6366f1' }}
              >
                <Wallet size={16} />
              </div>
            )}

            <div className="text-left min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-white/40 group-hover:text-white/60 transition-colors truncate">
                Carteira Ativa
              </div>
              <div className="text-xs font-black text-white truncate">
                {isConsolidated ? 'Resumo Total Consolidado' : activePortfolio?.name || 'Carteira Principal'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white/10 text-white/70">
              {formatBRL(totalValue)}
            </span>
            <ChevronDown
              size={16}
              className={`text-white/40 group-hover:text-white transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#141619] border border-white/10 rounded-2xl p-2 shadow-2xl space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Consolidated view option */}
            <button
              onClick={() => {
                setActivePortfolio('all');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left ${
                isConsolidated
                  ? 'bg-primary/20 text-white border border-primary/30'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-primary/30 text-primary flex items-center justify-center shrink-0">
                  <Layers size={14} />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold">Resumo Total (Consolidado)</div>
                  <div className="text-[10px] text-white/40">Todas as carteiras unificadas</div>
                </div>
              </div>
              {isConsolidated && <Check size={16} className="text-primary shrink-0" />}
            </button>

            <div className="my-1 border-t border-white/5" />

            <div className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/30">
              Minhas Carteiras
            </div>

            {/* Individual portfolios list */}
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {portfolios.map((p) => {
                const isSelected = activePortfolioId === p.id;
                const liveVal = p.data?.total_live || 0;

                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePortfolio(p.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left ${
                      isSelected
                        ? 'bg-primary/20 text-white border border-primary/30'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.color || '#6366f1' }}
                      />
                      <span className="text-xs font-bold truncate">{p.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold text-white/50">{formatBRL(liveVal)}</span>
                      {isSelected && <Check size={14} className="text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="my-1 border-t border-white/5" />

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-1 pt-1">
              <button
                onClick={handleQuickCreate}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/5 transition-all"
              >
                <Plus size={14} />
                Nova Carteira
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsManagerOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 p-2 rounded-xl text-[11px] font-bold text-white/70 hover:text-white hover:bg-white/5 transition-all"
              >
                <Settings2 size={14} />
                Gerenciar
              </button>
            </div>
          </div>
        )}
      </div>

      <PortfolioManagerModal isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
    </>
  );
};
