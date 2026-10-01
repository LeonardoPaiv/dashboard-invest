import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectionStore } from './useProjectionStore'

beforeEach(() => useProjectionStore.setState(useProjectionStore.getInitialState(), true))

describe('useProjectionStore', () => {
  it('starts with the defaults the page always used', () => {
    expect(useProjectionStore.getState()).toMatchObject({ monthlyContribution: 1000, annualRate: 10, years: 10 })
  })
  it('patches parameters and persists them', () => {
    useProjectionStore.getState().setProjection({ years: 25 })
    expect(useProjectionStore.getState()).toMatchObject({ monthlyContribution: 1000, annualRate: 10, years: 25 })
    expect(JSON.parse(localStorage.getItem('projection-settings')!).state.years).toBe(25)
  })
})
