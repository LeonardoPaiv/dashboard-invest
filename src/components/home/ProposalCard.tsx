import { useMemo } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import type { Proposal } from '../../chat/tools'
import { collectCategories } from '../../domain/assets'
import type { PreviewMode } from '../../domain/operations'
import type { SettingsPreviewRow } from '../../domain/settingsOperations'
import { categoryColor } from '../../domain/portfolioView'
import { brl, num } from '../../lib/format'
import { useChatStore } from '../../store/useChatStore'
import { useInvestmentStore } from '../../store/useInvestmentStore'

const CHIP: Record<PreviewMode, string> = {
  novo: 'bg-emerald-500/15 text-emerald-400',
  'nova categoria': 'bg-emerald-500/15 text-emerald-400',
  somar: 'bg-indigo-500/15 text-indigo-400',
  substituir: 'bg-amber-500/15 text-amber-400',
  mover: 'bg-amber-500/15 text-amber-400',
  renomear: 'bg-amber-500/15 text-amber-400',
  remover: 'bg-red-500/15 text-red-400',
  'excluir categoria': 'bg-red-500/15 text-red-400',
}

const SETTINGS_CHIP: Record<SettingsPreviewRow['mode'], string> = {
  criar: 'bg-emerald-500/15 text-emerald-400',
  alterar: 'bg-amber-500/15 text-amber-400',
  remover: 'bg-red-500/15 text-red-400',
}

interface Props {
  messageId: string
  proposal: Proposal
}

export const ProposalCard = ({ messageId, proposal }: Props) => {
  const assetCategories = useInvestmentStore((s) => s.assetCategories)
  const portfolios = useInvestmentStore((s) => s.portfolios)
  const confirmProposal = useChatStore((s) => s.confirmProposal)
  const dismissProposal = useChatStore((s) => s.dismissProposal)
  const categories = useMemo(() => collectCategories(assetCategories, portfolios), [assetCategories, portfolios])

  return (
    <div
      data-testid={`proposal-${proposal.id}`}
      className="border border-white/10 rounded-[20px] bg-black/20 overflow-hidden"
    >
      <div className="flex justify-between items-center gap-2 px-4 py-3 border-b border-white/5">
        <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Prévia de alterações</span>
        <span className="text-[10px] font-bold text-white/40 truncate">→ {proposal.portfolioName}</span>
      </div>

      {proposal.rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,.6fr)_minmax(0,.9fr)_auto] gap-2 items-center px-4 py-2.5 border-b border-white/5 text-xs"
        >
          <span className="font-black truncate">{row.label}</span>
          <span className="flex items-center gap-1.5 min-w-0 text-white/60 font-semibold text-[11px]">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: categoryColor(row.category, categories) }}
            />
            <span className="truncate">{row.category}</span>
          </span>
          <span className="text-right text-white/70 font-bold">
            {row.quantity === undefined ? '' : num(row.quantity)}
          </span>
          <span className="text-right text-white/70 font-bold">
            {row.avgPrice === undefined ? '' : brl(row.avgPrice)}
          </span>
          <span
            className={`justify-self-end px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${CHIP[row.mode]}`}
          >
            {row.mode}
          </span>
        </div>
      ))}

      {proposal.settings?.rows.map((row, index) => (
        <div
          key={`s-${index}`}
          className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_auto] gap-2 items-center px-4 py-2.5 border-b border-white/5 text-xs"
        >
          <span className="font-black truncate">{row.label}</span>
          <span className="flex items-center gap-1.5 min-w-0 justify-end text-[11px] font-bold">
            {row.before !== undefined && <span className="text-white/40 line-through truncate">{row.before}</span>}
            {row.before !== undefined && row.after !== undefined && <span className="text-white/30">→</span>}
            {row.after !== undefined && <span className="text-white/80 truncate">{row.after}</span>}
          </span>
          <span
            className={`justify-self-end px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${SETTINGS_CHIP[row.mode]}`}
          >
            {row.mode}
          </span>
        </div>
      ))}

      {proposal.summary && (
        <div className="px-4 py-2.5 text-[11px] text-white/40 font-semibold leading-relaxed">{proposal.summary}</div>
      )}

      {proposal.status === 'pending' && (
        <div className="flex gap-2 px-4 pb-3.5">
          <button
            type="button"
            onClick={() => confirmProposal(messageId, proposal.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-[11px] font-black uppercase tracking-wide hover:bg-emerald-600 transition-colors"
          >
            <Check size={14} />
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => dismissProposal(messageId, proposal.id)}
            className="px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 text-white/60 text-[11px] font-black uppercase tracking-wide hover:text-white hover:bg-white/10 transition-colors"
          >
            Descartar
          </button>
        </div>
      )}
      {proposal.status === 'done' && (
        <div className="flex items-center gap-1.5 px-4 pb-3.5 text-emerald-400 text-[11px] font-black uppercase tracking-wide">
          <CheckCircle2 size={14} />
          Salvo em {proposal.portfolioName}
        </div>
      )}
      {proposal.status === 'dismissed' && (
        <div className="px-4 pb-3.5 text-white/30 text-[11px] font-black uppercase tracking-wide">Descartado</div>
      )}
      {proposal.status === 'failed' && (
        <div className="px-4 pb-3.5 text-red-400 text-[11px] font-bold leading-relaxed whitespace-pre-wrap">
          Não foi salvo: {proposal.error} Peça uma nova prévia.
        </div>
      )}
    </div>
  )
}
