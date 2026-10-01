import { ChatPanel } from './ChatPanel'
import { PortfolioPanel } from './PortfolioPanel'

export const HomePage = () => (
  <div className="flex-1 min-h-0 flex flex-col p-4 md:p-6 overflow-hidden">
    <div className="flex-1 min-h-0 grid gap-6 overflow-y-auto custom-scrollbar [grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr))] [grid-auto-rows:minmax(640px,1fr)]">
      <ChatPanel />
      <PortfolioPanel />
    </div>
  </div>
)
