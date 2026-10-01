export const MODEL_PRESETS = [
  { id: 'stealth/space-bunny-alpha', note: 'Padrão' },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', note: 'Grátis' },
  { id: 'deepseek/deepseek-r1', note: 'Raciocínio' },
  { id: 'openrouter/auto', note: 'Automático' },
]

export const DEFAULT_MODEL = MODEL_PRESETS[0].id

export const shortModelName = (id: string): string => id.split('/').pop() || id
