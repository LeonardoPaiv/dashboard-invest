import { useChatStore } from '../../store/useChatStore'

export const CHAT_FILE_INPUT_ID = 'chat-file-input'

export interface ChatHelper {
  title: string
  desc: string
  run: () => void
}

export const CHAT_HELPERS: ChatHelper[] = [
  {
    title: 'Importar planilha',
    desc: 'XP, Rico, Nu, BTG, B3 — qualquer formato',
    run: () => document.getElementById(CHAT_FILE_INPUT_ID)?.click(),
  },
  {
    title: 'Registrar compra',
    desc: 'Ex.: "Comprei 100 BBSE3 a 33,10"',
    run: () => useChatStore.getState().requestCompose('Comprei 100 BBSE3 a 33,10'),
  },
  {
    title: 'Analisar alocação',
    desc: 'Peso de cada categoria na carteira',
    run: () => void useChatStore.getState().sendMessage('Como está minha alocação por categoria?'),
  },
  {
    title: 'Rebalancear',
    desc: 'Quanto aportar para chegar na meta',
    run: () => void useChatStore.getState().sendMessage('Como rebalancear para minha meta?'),
  },
]
