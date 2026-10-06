// Free Models Router: sorteia entre os modelos grátis do OpenRouter que suportam o que o pedido usa (tool calling)
export const AUTO_MODEL = 'openrouter/free'

// só modelos grátis com tool calling (o Nemotron 3.5 Content Safety é um classificador e fica de fora)
export const MODEL_PRESETS = [
  { id: AUTO_MODEL, name: 'Automático', note: 'Sorteia um grátis' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra', note: '1M contexto' },
  { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1', note: '262K' },
  { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Lightning', note: '1M contexto' },
  { id: 'dots-studio/dots-3-note-preview:free', name: 'Dots3-Note Preview', note: '512K' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super', note: 'Rápido' },
  { id: 'inclusionai/ling-3.0-flash-sante:free', name: 'Ling 3.0 Flash Sante', note: 'Rápido' },
  { id: 'thinkingmachines/inkling:free', name: 'Inkling', note: '1M contexto' },
  { id: 'apodex/apodex-1.1-mini:free', name: 'Apodex 1.1 Mini', note: 'Rápido' },
  { id: 'cohere/north-mini-code:free', name: 'North Mini Code', note: '256K' },
  { id: 'thinkingmachines/inkling-small:free', name: 'Inkling Small', note: '1M contexto' },
  { id: 'poolside/laguna-xs-2.1:free', name: 'Laguna XS 2.1', note: '262K' },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni', note: 'Raciocínio' },
  { id: 'liquid/lfm-2.5-2.6b:free', name: 'LFM2.5 2.6B', note: 'Pequeno' },
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B', note: '262K' },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', note: '262K' },
]

export const DEFAULT_MODEL = MODEL_PRESETS[1].id

export const isFreeModel = (id: string): boolean => id === AUTO_MODEL || id.endsWith(':free')

export const shortModelName = (id: string): string =>
  MODEL_PRESETS.find((preset) => preset.id === id)?.name || id.split('/').pop() || id
