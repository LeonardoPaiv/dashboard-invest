import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeyRevalidation } from '../../hooks/useKeyRevalidation'
import { validateKey } from '../../lib/openrouter/client'
import { DEFAULT_MODEL } from '../../lib/openrouter/models'
import { useAiSettingsStore } from '../../store/useAiSettingsStore'
import { ApiKeyGate } from './ApiKeyGate'

vi.mock('../../lib/openrouter/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/openrouter/client')>()),
  validateKey: vi.fn(),
}))

const validate = vi.mocked(validateKey)
const settings = () => useAiSettingsStore.getState()

beforeEach(() => {
  validate.mockReset()
  useAiSettingsStore.setState({ apiKey: '', keyStatus: 'missing', model: DEFAULT_MODEL })
})

describe('ApiKeyGate', () => {
  it('saves a key that OpenRouter accepts', async () => {
    validate.mockResolvedValue('valid')
    render(<ApiKeyGate />)
    await userEvent.type(screen.getByLabelText('Chave da API do OpenRouter'), ' sk-or-abc ')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar chave' }))
    await waitFor(() => expect(settings()).toMatchObject({ apiKey: 'sk-or-abc', keyStatus: 'valid' }))
    expect(validate).toHaveBeenCalledWith('sk-or-abc')
  })

  it('rejects an invalid key without saving it', async () => {
    validate.mockResolvedValue('invalid')
    render(<ApiKeyGate />)
    await userEvent.type(screen.getByLabelText('Chave da API do OpenRouter'), 'bad')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar chave' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Chave inválida. Confira e tente novamente.')
    expect(settings()).toMatchObject({ apiKey: '', keyStatus: 'missing' })
  })

  it('explains when validation could not run', async () => {
    validate.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<ApiKeyGate />)
    await userEvent.type(screen.getByLabelText('Chave da API do OpenRouter'), 'sk-or-abc')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar chave' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível validar a chave agora')
    expect(settings().apiKey).toBe('')
  })

  it('tells the user when the saved key was refused', () => {
    useAiSettingsStore.setState({ apiKey: 'old', keyStatus: 'invalid' })
    render(<ApiKeyGate />)
    expect(screen.getByRole('alert')).toHaveTextContent('A chave salva foi recusada pelo OpenRouter')
  })

  it('keeps the save button disabled while the field is empty', () => {
    render(<ApiKeyGate />)
    expect(screen.getByRole('button', { name: 'Salvar chave' })).toBeDisabled()
  })
})

describe('useKeyRevalidation', () => {
  it('validates a saved key of unknown status', async () => {
    validate.mockResolvedValue('invalid')
    useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'unknown' })
    renderHook(() => useKeyRevalidation())
    await waitFor(() => expect(settings().keyStatus).toBe('invalid'))
  })

  it('leaves the status unknown when the check cannot run', async () => {
    validate.mockRejectedValue(new TypeError('Failed to fetch'))
    useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'unknown' })
    renderHook(() => useKeyRevalidation())
    await waitFor(() => expect(validate).toHaveBeenCalled())
    expect(settings().keyStatus).toBe('unknown')
  })

  it('does nothing when there is no key or the status is already known', () => {
    renderHook(() => useKeyRevalidation())
    useAiSettingsStore.setState({ apiKey: 'sk-or-abc', keyStatus: 'valid' })
    renderHook(() => useKeyRevalidation())
    expect(validate).not.toHaveBeenCalled()
  })
})
