import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_MODEL, MODEL_PRESETS, isFreeModel } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { ModelPicker } from './ModelPicker'

const settings = () => useAiSettingsStore.getState()

beforeEach(() => {
  useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid', model: DEFAULT_MODEL, webSearch: true })
})

describe('ModelPicker', () => {
  it('shows the short name of the current model and opens the list on click', async () => {
    render(<ModelPicker />)
    expect(screen.getByRole('button', { name: /Nemotron 3 Ultra/ })).toBeInTheDocument()
    expect(screen.queryByText('Modelos grátis via OpenRouter')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Nemotron 3 Ultra/ }))
    expect(screen.getByText('Modelos grátis via OpenRouter')).toBeInTheDocument()
  })

  it('switches to a preset and closes', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /Nemotron 3 Ultra/ }))
    await userEvent.click(screen.getByRole('button', { name: /Automático/ }))
    expect(settings().model).toBe('openrouter/free')
    expect(screen.queryByText('Modelos grátis via OpenRouter')).not.toBeInTheDocument()
  })

  it('accepts a custom free model id', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /Nemotron 3 Ultra/ }))
    await userEvent.type(screen.getByLabelText('Outro modelo'), 'meta-llama/llama-4:free{Enter}')
    expect(settings().model).toBe('meta-llama/llama-4:free')
  })

  it('ignores a custom paid model id', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /Nemotron 3 Ultra/ }))
    await userEvent.type(screen.getByLabelText('Outro modelo'), 'deepseek/deepseek-r1{Enter}')
    expect(settings().model).toBe(DEFAULT_MODEL)
  })

  it('lists only free models', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /Nemotron 3 Ultra/ }))
    for (const preset of MODEL_PRESETS) {
      expect(isFreeModel(preset.id)).toBe(true)
      expect(screen.getAllByTitle(preset.id).length).toBeGreaterThan(0)
    }
  })

  it('lets the user replace the API key', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /Nemotron 3 Ultra/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Trocar chave da API' }))
    expect(settings()).toMatchObject({ apiKey: '', keyStatus: 'missing' })
  })

  it('toggles web search', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /Nemotron 3 Ultra/ }))
    const toggle = screen.getByRole('switch', { name: /Busca na web/ })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle)
    expect(settings().webSearch).toBe(false)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
