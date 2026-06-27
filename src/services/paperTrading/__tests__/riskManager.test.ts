import { describe, expect, test } from 'bun:test'
import { BasicRiskManager } from '../risk/riskManager.js'
import type { MarketData, Portfolio } from '../types.js'

const data: MarketData = {
  symbol: '000001',
  timestamp: new Date('2026-06-28'),
  open: 10,
  high: 11,
  low: 9,
  close: 10,
  volume: 1_000_000,
}

describe('BasicRiskManager', () => {
  test('allows a reasonably sized buy', () => {
    const risk = new BasicRiskManager()
    const portfolio: Portfolio = {
      cash: 100_000,
      positions: [],
      totalValue: 100_000,
    }
    const signal = risk.approve(
      { symbol: '000001', side: 'buy', quantity: 100, reason: 'dip' },
      data,
      portfolio,
    )
    expect(signal).not.toBeNull()
  })

  test('blocks oversized buy', () => {
    const risk = new BasicRiskManager({ maxCashDeployPct: 0.05 })
    const portfolio: Portfolio = {
      cash: 100_000,
      positions: [],
      totalValue: 100_000,
    }
    const signal = risk.approve(
      { symbol: '000001', side: 'buy', quantity: 1000, reason: 'dip' },
      data,
      portfolio,
    )
    expect(signal).toBeNull()
  })

  test('enforces daily order limit', () => {
    const risk = new BasicRiskManager({ maxOrdersPerDay: 1 })
    const portfolio: Portfolio = {
      cash: 100_000,
      positions: [],
      totalValue: 100_000,
    }
    const first = risk.approve(
      { symbol: '000001', side: 'buy', quantity: 100, reason: 'dip' },
      data,
      portfolio,
    )
    expect(first).not.toBeNull()
    const second = risk.approve(
      { symbol: '000001', side: 'buy', quantity: 100, reason: 'dip' },
      data,
      portfolio,
    )
    expect(second).toBeNull()
  })

  test('halts new orders after max drawdown is exceeded', () => {
    const risk = new BasicRiskManager({ maxDrawdownPct: 0.05 })
    const portfolio: Portfolio = {
      cash: 100_000,
      positions: [],
      totalValue: 100_000,
    }
    const first = risk.approve(
      { symbol: '000001', side: 'buy', quantity: 100, reason: 'dip' },
      data,
      portfolio,
    )
    expect(first).not.toBeNull()

    portfolio.totalValue = 94_000
    const second = risk.approve(
      { symbol: '000001', side: 'buy', quantity: 100, reason: 'dip' },
      data,
      portfolio,
    )
    expect(second).toBeNull()
  })
})
