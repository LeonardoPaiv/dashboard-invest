import { useState } from 'react';
import { FileText, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CHART_COLORS } from '../../domain/portfolioView';
import { useInvestmentStore, type Snapshot } from '../../store/useInvestmentStore';

/** Alocação registrada num snapshot, uma célula por classe. */
export const SnapshotAllocation = ({ current, compact = false }: { current: Record<string, number>; compact?: boolean }) => {
  const entries = Object.entries(current || {});
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([name, value], index) => (
        <div key={name} className={`flex-1 min-w-[4.5rem] text-center bg-white/5 rounded-xl border border-white/5 ${compact ? 'p-1.5' : 'p-2'}`}>
          <div className="text-[8px] text-white/30 uppercase font-black mb-1 truncate">{name}</div>
          <div className="text-[10px] font-bold" style={{ color: CHART_COLORS[index % CHART_COLORS.length] }}>{(Number(value) || 0).toFixed(1)}%</div>
        </div>
      ))}
    </div>
  );
};

export const SnapshotDetail = ({ snap }: { snap: Snapshot }) => {
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

      <div className="p-2 bg-black/40 border-b border-white/5">
        <SnapshotAllocation current={snap.current} compact />
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
