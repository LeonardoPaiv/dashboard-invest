import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useInvestmentStore } from '../../store/useInvestmentStore'
import { TargetsEditor } from './TargetsEditor'

const store = () => useInvestmentStore.getState()
const weight = (name: string) => screen.getByLabelText(`Peso ${name}`) as HTMLInputElement
const save = () => fireEvent.click(screen.getByRole('button', { name: /Salvar Alvos/ }))

beforeEach(() => {
  store().clearAllData()
})

describe('TargetsEditor', () => {
  it('lists the classes of the saved strategy', () => {
    render(<TargetsEditor />)
    expect(weight('FIIs').value).toBe('33.3')
    expect(weight('Ações').value).toBe('33.3')
    expect(weight('Renda Fixa').value).toBe('33.4')
    expect(screen.queryByLabelText('Peso Tesouro Direto')).toBeNull()
  })

  it('adds catalog and free-name classes and rescales the weights to 100 on save', () => {
    render(<TargetsEditor />)
    fireEvent.click(screen.getByRole('button', { name: '+ ETFs' }))
    fireEvent.change(screen.getByLabelText('Nome da nova classe'), { target: { value: 'Startups' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar classe' }))
    fireEvent.change(weight('FIIs'), { target: { value: '1' } })
    fireEvent.change(weight('Ações'), { target: { value: '1' } })
    fireEvent.change(weight('Renda Fixa'), { target: { value: '0' } })
    fireEvent.change(weight('ETFs'), { target: { value: '1' } })
    fireEvent.change(weight('Startups'), { target: { value: '1' } })
    save()

    expect(store().settings.alvos).toEqual({ 'FIIs': 25, 'Ações': 25, 'ETFs': 25, 'Startups': 25 })
    expect(store().assetCategories).toEqual(expect.arrayContaining(['ETFs', 'Startups']))
    expect(screen.getByRole('status').textContent).toMatch(/somar 100%/)
    expect(screen.queryByLabelText('Peso Renda Fixa')).toBeNull()
  })

  it('removes an empty custom class from the strategy and from the categories', () => {
    store().applyAssetOperations('default', [{ type: 'add_category', name: 'ETFs' }])
    store().setSettings({ estrategia: '', alvos: { 'Ações': 60, 'ETFs': 40 } })
    render(<TargetsEditor />)
    fireEvent.click(screen.getByRole('button', { name: 'Remover ETFs' }))
    save()
    expect(store().settings.alvos).toEqual({ 'Ações': 100 })
    expect(store().assetCategories).not.toContain('ETFs')
  })

  it('keeps a class that still has assets, without target', () => {
    store().applyAssetOperations('default', [
      { type: 'upsert_asset', ticker: 'BTC', category: 'Cripto', quantity: 1, avgPrice: 1000, mode: 'add' },
    ])
    store().setSettings({ estrategia: '', alvos: { 'Ações': 60, 'Cripto': 40 } })
    render(<TargetsEditor />)
    fireEvent.click(screen.getByRole('button', { name: 'Remover Cripto' }))
    save()
    expect(store().settings.alvos).toEqual({ 'Ações': 100 })
    expect(store().assetCategories).toContain('Cripto')
    expect(weight('Cripto').value).toBe('')
    expect(screen.getByText('sem alvo')).toBeTruthy()
  })

  it('renames a custom class and carries its target, but not builtin ones', () => {
    store().setSettings({ estrategia: '', alvos: { 'Ações': 60, 'Cripto': 40 } })
    render(<TargetsEditor />)
    expect(screen.queryByRole('button', { name: 'Renomear Ações' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Renomear Cripto' }))
    fireEvent.change(screen.getByLabelText('Novo nome de Cripto'), { target: { value: 'Criptomoedas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nome' }))
    save()
    expect(store().settings.alvos).toEqual({ 'Ações': 60, 'Criptomoedas': 40 })
    expect(store().assetCategories).toContain('Criptomoedas')
    expect(store().assetCategories).not.toContain('Cripto')
  })

  it('refuses duplicate class names', () => {
    render(<TargetsEditor />)
    fireEvent.change(screen.getByLabelText('Nome da nova classe'), { target: { value: 'ações' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar classe' }))
    expect(screen.getByRole('status').textContent).toMatch(/já está na lista/)
  })

  it('follows targets changed outside the editor', () => {
    render(<TargetsEditor />)
    fireEvent.change(weight('FIIs'), { target: { value: '90' } })
    act(() => store().setSettings({ estrategia: '', alvos: { 'Ações': 100 } }))
    expect(screen.queryByLabelText('Peso FIIs')).toBeNull()
    expect(weight('Ações').value).toBe('100')
  })
})
