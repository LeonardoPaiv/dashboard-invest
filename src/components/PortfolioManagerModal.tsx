import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Edit3, Check, Layers, Wallet } from 'lucide-react';
import { useInvestmentStore } from '../store/useInvestmentStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PortfolioManagerModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { portfolios, addPortfolio, renamePortfolio, deletePortfolio, setActivePortfolio, activePortfolioId } = useInvestmentStore();
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;
    addPortfolio(newPortfolioName.trim());
    setNewPortfolioName('');
  };

  const handleStartRename = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      renamePortfolio(id, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#121316] border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Wallet size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Gerenciar Carteiras</h2>
            <p className="text-xs text-white/50">Crie, renomeie ou exclua suas carteiras de investimento.</p>
          </div>
        </div>

        {/* Create new portfolio form */}
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            placeholder="Nome da nova carteira..."
            value={newPortfolioName}
            onChange={(e) => setNewPortfolioName(e.target.value)}
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary transition-all"
          />
          <button
            type="submit"
            disabled={!newPortfolioName.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 shrink-0"
          >
            <Plus size={18} />
            Criar
          </button>
        </form>

        {/* Portfolio List */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
          {portfolios.map((p) => {
            const isEditing = editingId === p.id;
            const isActive = activePortfolioId === p.id;
            const totalLive = p.data?.total_live || 0;
            const assetCount =
              (p.data?.acoes?.length || 0) +
              (p.data?.fiis?.length || 0) +
              (p.data?.tesouro?.length || 0) +
              (p.data?.renda_fixa?.length || 0) +
              (p.data?.manualAssets?.length || 0);

            return (
              <div
                key={p.id}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-primary/10 border-primary/40 text-white'
                    : 'bg-white/5 border-white/5 text-white/80 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color || '#6366f1' }}
                  />

                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 px-3 py-1 bg-black/40 border border-primary rounded-xl text-sm text-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRename(p.id)}
                        className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary/80"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate text-white">{p.name}</span>
                        {isActive && (
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30">
                            Ativa
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/40 flex items-center gap-3 mt-0.5">
                        <span>{assetCount} {assetCount === 1 ? 'ativo' : 'ativos'}</span>
                        <span>•</span>
                        <span className="font-semibold text-white/70">{formatBRL(totalLive)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => setActivePortfolio(p.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-primary hover:text-white rounded-xl text-white/60 transition-all border border-white/10"
                      >
                        Selecionar
                      </button>
                    )}
                    <button
                      onClick={() => handleStartRename(p.id, p.name)}
                      className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                      title="Renomear"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir a carteira "${p.name}"? Todos os seus dados serão apagados.`)) {
                          deletePortfolio(p.id);
                        }
                      }}
                      disabled={portfolios.length <= 1}
                      className="p-2 text-white/30 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white/30 rounded-xl transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-white/5 flex justify-between items-center">
          <div className="text-[11px] text-white/40 flex items-center gap-2">
            <Layers size={14} className="text-primary" />
            <span>Total de {portfolios.length} carteira(s) cadastrada(s)</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
