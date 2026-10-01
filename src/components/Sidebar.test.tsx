import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useChatStore } from '../store/useChatStore'
import { useInvestmentStore } from '../store/useInvestmentStore'
import { Sidebar } from './Sidebar'

beforeEach(() => {
  useChatStore.setState(useChatStore.getInitialState(), true)
  useInvestmentStore.getState().clearAllData()
})

describe('Sidebar', () => {
  it('hands an imported spreadsheet to the chat and opens the dashboard', async () => {
    useInvestmentStore.getState().setActiveTab('history')
    const { container } = render(<Sidebar />)
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"][accept=".csv,.xlsx,.xls"]')
    expect(inputs.length).toBeGreaterThanOrEqual(2)

    const file = new File(['Ativo;Cotas\nTAEE11;80\n'], 'posicao.csv', { type: 'text/csv' })
    await userEvent.upload(inputs[0], file)

    expect(useChatStore.getState().stagedFile).toBe(file)
    expect(useInvestmentStore.getState().activeTab).toBe('dashboard')
  })

  it('no longer exports importConfig in the backup payload', () => {
    expect('importConfig' in useInvestmentStore.getState()).toBe(false)
  })
})
