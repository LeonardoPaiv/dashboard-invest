import { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { CLASS_CATALOG, computeAllocation, normalizeWeights } from '../../domain/allocation';
import { collectCategories, isBuiltinCategory, listAssets } from '../../domain/assets';
import type { AssetOperation } from '../../domain/operations';
import { categoryColor } from '../../domain/portfolioView';
import { resolveWritablePortfolioId, useInvestmentStore } from '../../store/useInvestmentStore';

interface DraftRow {
  name: string
  /** Peso digitado; vazio ou zero deixa a classe fora da estratégia. */
  weight: string
  /** Nome da categoria já salva que esta linha representa. */
  original?: string
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const pct = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const TargetsEditor = () => {
  const { portfolio, portfolios, activePortfolioId, settings, assetCategories, setSettings, applyAssetOperations } = useInvestmentStore();

  const categories = useMemo(() => collectCategories(assetCategories, portfolios), [assetCategories, portfolios]);
  const rows = useMemo(() => computeAllocation(portfolio, settings.alvos, categories), [portfolio, settings.alvos, categories]);
  const usedCategories = useMemo(
    () => new Set(portfolios.flatMap((p) => listAssets(p.data).map((asset) => asset.category))),
    [portfolios],
  );

  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ index: number; value: string } | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // O rascunho recomeça sempre que as metas ou as classes salvas mudam (inclusive pelo assistente).
  const savedKey = JSON.stringify([settings.alvos, rows.map((row) => row.name)]);
  useEffect(() => {
    setDraft(rows.map((row) => ({ name: row.name, original: row.name, weight: row.inStrategy ? String(row.targetPct) : '' })));
    setRemoved([]);
    setRenaming(null);
  }, [savedKey]);

  const preview = normalizeWeights(Object.fromEntries(draft.map((row) => [row.name, parseFloat(row.weight) || 0])));
  const weightSum = draft.reduce((acc, row) => acc + Math.max(parseFloat(row.weight) || 0, 0), 0);
  const palette = Array.from(new Set([...categories, ...draft.map((row) => row.name)]));
  const suggestions = CLASS_CATALOG.filter((item) => !draft.some((row) => sameName(row.name, item.name)));

  const update = (index: number, patch: Partial<DraftRow>) => {
    setMessage(null);
    setDraft((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addClass = (raw: string) => {
    const typed = raw.trim();
    if (!typed) return;
    if (draft.some((row) => sameName(row.name, typed))) {
      setMessage({ kind: 'error', text: `A classe "${typed}" já está na lista.` });
      return;
    }
    const existing = categories.find((c) => sameName(c, typed));
    setMessage(null);
    setRemoved((current) => current.filter((name) => !sameName(name, typed)));
    setDraft((current) => [...current, { name: existing ?? typed, original: existing, weight: '' }]);
    setNewName('');
  };

  const removeClass = (index: number) => {
    const row = draft[index];
    setMessage(null);
    const current = row.original ? rows.find((r) => r.name === row.original) : undefined;
    if (current?.hasAssets) {
      // Classe com ativos continua visível, só fica sem alvo.
      update(index, { weight: '' });
      return;
    }
    if (row.original) setRemoved((names) => [...names, row.original!]);
    setDraft((rowsNow) => rowsNow.filter((_, i) => i !== index));
  };

  const confirmRename = () => {
    if (!renaming) return;
    const name = renaming.value.trim();
    const clash = draft.some((row, i) => i !== renaming.index && sameName(row.name, name))
      || categories.some((c) => sameName(c, name) && c !== draft[renaming.index].original);
    if (!name || clash) {
      setMessage({ kind: 'error', text: name ? `A classe "${name}" já existe.` : 'Nome de classe vazio.' });
      return;
    }
    update(renaming.index, { name });
    setRenaming(null);
  };

  const save = () => {
    const operations: AssetOperation[] = [
      ...draft
        .filter((row) => row.original && row.original !== row.name)
        .map((row): AssetOperation => ({ type: 'rename_category', from: row.original!, to: row.name })),
      ...draft
        .filter((row) => !row.original)
        .map((row): AssetOperation => ({ type: 'add_category', name: row.name })),
      ...removed
        .filter((name) => !isBuiltinCategory(name) && !usedCategories.has(name) && categories.includes(name))
        .map((name): AssetOperation => ({ type: 'remove_category', name })),
    ];
    try {
      if (operations.length > 0) applyAssetOperations(resolveWritablePortfolioId(portfolios, activePortfolioId), operations);
      setSettings({ ...useInvestmentStore.getState().settings, alvos: preview });
      setMessage({ kind: 'ok', text: 'Alvos salvos e ajustados para somar 100%.' });
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_3.5rem_4.5rem_3.5rem_3.5rem] gap-2 px-1 text-[9px] font-black text-white/30 uppercase tracking-widest">
          <span>Classe</span>
          <span className="text-right">Atual</span>
          <span className="text-center">Peso</span>
          <span className="text-right">Alvo</span>
          <span />
        </div>

        {draft.map((row, index) => {
          const current = row.original ? rows.find((r) => r.name === row.original) : undefined;
          const target = Object.prototype.hasOwnProperty.call(preview, row.name) ? preview[row.name] : 0;
          const builtin = isBuiltinCategory(row.original ?? row.name);
          return (
            <div key={row.original ?? `new-${index}`} className="grid grid-cols-[1fr_3.5rem_4.5rem_3.5rem_3.5rem] gap-2 items-center bg-white/5 border border-white/5 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: categoryColor(row.name, palette) }} />
                {renaming?.index === index ? (
                  <input
                    autoFocus
                    aria-label={`Novo nome de ${row.name}`}
                    value={renaming.value}
                    onChange={(e) => setRenaming({ index, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); confirmRename(); }
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    className="w-full min-w-0 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-primary/50"
                  />
                ) : (
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{row.name}</div>
                    {target === 0 && <div className="text-[9px] text-orange-400/80 font-bold uppercase tracking-wider">sem alvo</div>}
                  </div>
                )}
              </div>
              <span className="text-right text-xs text-white/50 tabular-nums">{pct(current?.currentPct ?? 0)}</span>
              <input
                type="number"
                min="0"
                step="any"
                aria-label={`Peso ${row.name}`}
                value={row.weight}
                placeholder="0"
                onChange={(e) => update(index, { weight: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-center outline-none focus:border-primary/50"
              />
              <span className="text-right text-xs font-black text-primary tabular-nums">{pct(target)}</span>
              <div className="flex justify-end gap-1">
                {renaming?.index === index ? (
                  <button type="button" aria-label="Confirmar nome" onClick={confirmRename} className="p-1 text-primary hover:text-white transition-colors">
                    <Check size={13} />
                  </button>
                ) : !builtin && (
                  <button type="button" aria-label={`Renomear ${row.name}`} onClick={() => setRenaming({ index, value: row.name })} className="p-1 text-white/20 hover:text-white transition-colors">
                    <Pencil size={13} />
                  </button>
                )}
                <button type="button" aria-label={`Remover ${row.name}`} onClick={() => removeClass(index)} className="p-1 text-white/20 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
        {draft.length === 0 && (
          <div className="py-6 text-center text-xs text-white/30 border border-dashed border-white/10 rounded-xl">Nenhuma classe na estratégia. Adicione abaixo.</div>
        )}
      </div>

      <p className="text-[10px] text-white/40">
        Soma dos pesos: <span className="font-bold text-white/70">{weightSum.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>.
        {' '}Digite pesos livres: ao salvar, os alvos são ajustados para somar 100%.
      </p>

      <div className="space-y-2">
        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">Adicionar classe</label>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((item) => (
            <button
              key={item.name}
              type="button"
              title={item.about}
              onClick={() => addClass(item.name)}
              className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/60 hover:text-white hover:border-primary/40 transition-all"
            >
              + {item.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            aria-label="Nome da nova classe"
            value={newName}
            placeholder="Outra classe (nome livre)"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addClass(newName); }
            }}
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary/50 placeholder:text-white/20"
          />
          <button type="button" aria-label="Adicionar classe" onClick={() => addClass(newName)} className="px-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {message && (
        <p role="status" className={`text-[11px] font-bold ${message.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</p>
      )}

      <button type="button" onClick={save} className="w-full py-3 bg-white/5 border border-white/10 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all text-xs uppercase tracking-widest">
        <Save size={16} /> Salvar Alvos
      </button>
    </div>
  );
};
