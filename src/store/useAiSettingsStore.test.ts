import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_MODEL } from '../lib/openrouter/models'
import { useAiSettingsStore } from './useAiSettingsStore'

const store = () => useAiSettingsStore.getState()

beforeEach(() => {
  useAiSettingsStore.setState({ apiKey: '', keyStatus: 'missing', model: DEFAULT_MODEL })
})

describe('useAiSettingsStore', () => {
  it('starts without a key and with the default model', () => {
    expect(store()).toMatchObject({ apiKey: '', keyStatus: 'missing', model: 'stealth/space-bunny-alpha' })
  })

  it('saves and clears the key', () => {
    store().setApiKey('  sk-or-abc  ', 'valid')
    expect(store()).toMatchObject({ apiKey: 'sk-or-abc', keyStatus: 'valid' })
    store().clearApiKey()
    expect(store()).toMatchObject({ apiKey: '', keyStatus: 'missing' })
  })

  it('ignores an empty model id', () => {
    store().setModel('   ')
    expect(store().model).toBe(DEFAULT_MODEL)
    store().setModel(' deepseek/deepseek-r1 ')
    expect(store().model).toBe('deepseek/deepseek-r1')
  })

  it('persists key and model but not the key status', () => {
    store().setApiKey('sk-or-abc', 'valid')
    const saved = JSON.parse(localStorage.getItem('ai-settings') || '{}')
    expect(saved.state).toEqual({ apiKey: 'sk-or-abc', model: DEFAULT_MODEL })
  })

  it('rehydrates a saved key as "unknown" so it is validated again', async () => {
    localStorage.setItem('ai-settings', JSON.stringify({ state: { apiKey: 'sk-or-abc', model: 'x/y' }, version: 0 }))
    await useAiSettingsStore.persist.rehydrate()
    expect(store()).toMatchObject({ apiKey: 'sk-or-abc', keyStatus: 'unknown', model: 'x/y' })
  })

  it('rehydrates as "missing" when nothing is saved', async () => {
    localStorage.removeItem('ai-settings')
    store().markKeyStatus('valid')
    localStorage.setItem('ai-settings', JSON.stringify({ state: { apiKey: '', model: DEFAULT_MODEL }, version: 0 }))
    await useAiSettingsStore.persist.rehydrate()
    expect(store().keyStatus).toBe('missing')
  })
})
