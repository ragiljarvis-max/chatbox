import { describe, expect, it } from 'vitest'
import { filterAndSortResults, type ProviderHealthResult } from '@/utils/provider-health'

const result = (overrides: Partial<ProviderHealthResult>): ProviderHealthResult => ({
  providerId: 'p1',
  modelId: 'm1',
  status: 'alive',
  latencyMs: 100,
  tokensPerSecond: 10,
  checkedAt: 0,
  ...overrides,
})

describe('filterAndSortResults', () => {
  const results = [
    result({ modelId: 'fast-alive', latencyMs: 80 }),
    result({ modelId: 'slow-alive', latencyMs: 900 }),
    result({ modelId: 'dead-no-latency', status: 'dead' }),
    result({ modelId: 'dead-slow', status: 'dead', latencyMs: 500 }),
  ]

  it('sorts dead models first, then by latency ascending', () => {
    const sorted = filterAndSortResults(results, 'all')
    expect(sorted.map((r) => r.modelId)).toEqual([
      'dead-no-latency',
      'dead-slow',
      'fast-alive',
      'slow-alive',
    ])
  })

  it('filters alive only', () => {
    expect(filterAndSortResults(results, 'alive').map((r) => r.modelId)).toEqual([
      'fast-alive',
      'slow-alive',
    ])
  })

  it('filters dead only', () => {
    expect(filterAndSortResults(results, 'dead').map((r) => r.modelId)).toEqual([
      'dead-no-latency',
      'dead-slow',
    ])
  })
})
