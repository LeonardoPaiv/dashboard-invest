import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_MODEL } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { ModelPicker } from './ModelPicker'

const settings = () => useAiSettingsStore.getState()

beforeEach(() => {
  useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid', model: DEFAULT_MODEL, webSearch: true })
})

describe('ModelPicker', () => {
  it('shows the short name of the current model and opens the list on click', async () => {
    render(<ModelPicker />)
    expect(screen.getByRole('button', { name: /space-bunny-alpha/ })).toBeInTheDocument()
    expect(screen.queryByText('Modelos via OpenRouter')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /space-bunny-alpha/ }))
    expect(screen.getByText('Modelos via OpenRouter')).toBeInTheDocument()
  })

  it('switches to a preset and closes', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /space-bunny-alpha/ }))
    await userEvent.click(screen.getByRole('button', { name: /deepseek\/deepseek-r1/ }))
    expect(settings().model).toBe('deepseek/deepseek-r1')
    expect(screen.queryByText('Modelos via OpenRouter')).not.toBeInTheDocument()
  })

  it('accepts a custom model id', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /space-bunny-alpha/ }))
    await userEvent.type(screen.getByLabelText('Outro modelo'), 'meta-llama/llama-4{Enter}')
    expect(settings().model).toBe('meta-llama/llama-4')
  })

  it('lets the user replace the API key', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /space-bunny-alpha/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Trocar chave da API' }))
    expect(settings()).toMatchObject({ apiKey: '', keyStatus: 'missing' })
  })

  it('toggles web search', async () => {
    render(<ModelPicker />)
    await userEvent.click(screen.getByRole('button', { name: /space-bunny-alpha/ }))
    const toggle = screen.getByRole('switch', { name: /Busca na web/ })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle)
    expect(settings().webSearch).toBe(false)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
