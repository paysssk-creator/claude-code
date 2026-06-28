import { describe, expect, test } from 'bun:test'
import { AgentStrategy } from '../agentStrategy.js'
import type { MarketData, Portfolio } from '../../types.js'

function makeData(close: number): MarketData {
  return {
    symbol: '000001',
    timestamp: new Date('2026-06-28'),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1_000_000,
  }
}

const emptyPortfolio: Portfolio = {
  cash: 100_000,
  positions: [],
  totalValue: 100_000,
}

describe('AgentStrategy', () => {
  test('evaluate returns sync signal', () => {
    const strategy = new AgentStrategy(() => ({
      symbol: '000001',
      side: 'buy',
      quantity: 100,
      reason: 'sync signal',
    }))

    const signal = strategy.evaluate(makeData(10), emptyPortfolio)
    expect(signal?.side).toBe('buy')
    expect(signal?.quantity).toBe(100)
  })

  test('evaluateAsync returns async signal', async () => {
    const strategy = new AgentStrategy(async () => ({
      symbol: '000001',
      side: 'sell',
      quantity: 200,
      reason: 'async signal',
    }))

    const signal = await strategy.evaluateAsync(makeData(11), emptyPortfolio)
    expect(signal?.side).toBe('sell')
    expect(signal?.quantity).toBe(200)
  })
})
