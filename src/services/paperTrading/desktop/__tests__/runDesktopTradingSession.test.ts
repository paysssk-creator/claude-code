import { describe, expect, test } from 'bun:test'
import { runDesktopTradingSession } from '../runDesktopTradingSession.js'
import type { DesktopUINavigator, PortfolioSnapshot } from '../uiNavigator.js'
import type { MarketData, StrategySignal } from '../../types.js'

function makeMarketData(symbol: string, close: number): MarketData {
  const now = new Date('2026-06-28T09:30:00+08:00')
  return {
    symbol,
    timestamp: now,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1_000_000,
  }
}

function makeNavigator(): DesktopUINavigator & {
  orders: {
    symbol: string
    side: 'buy' | 'sell'
    price: number
    quantity: number
  }[]
  portfolio: PortfolioSnapshot
  marketData: Map<string, MarketData>
} {
  return {
    orders: [],
    portfolio: { cash: 100_000, positions: [] },
    marketData: new Map<string, MarketData>([
      ['000001', makeMarketData('000001', 10)],
    ]),
    async requestAccess() {},
    async openAndBind() {},
    async navigateToPaperTrading() {},
    async unbind() {},
    async readPortfolio() {
      return this.portfolio
    },
    async readMarketData(symbol: string) {
      return this.marketData.get(symbol) ?? makeMarketData(symbol, 10)
    },
    async placePaperOrder(order) {
      this.orders.push(order)
      if (order.side === 'buy') {
        this.portfolio.positions.push({
          symbol: order.symbol,
          quantity: order.quantity,
          averageCost: order.price,
        })
        this.portfolio.cash -= order.price * order.quantity
      }
    },
  }
}

describe('runDesktopTradingSession', () => {
  test('writes a decision log after executing signals', async () => {
    const navigator = makeNavigator()
    const decide = async (): Promise<StrategySignal> => ({
      symbol: '000001',
      side: 'buy',
      quantity: 100,
      reason: 'Test signal',
    })

    const result = await runDesktopTradingSession({
      navigator,
      symbols: ['000001'],
      initialCash: 100_000,
      decide,
      rationale: 'Test desktop session.',
      lessons: 'None.',
    })

    expect(result.signals).toHaveLength(1)
    expect(result.orders).toHaveLength(1)
    expect(result.finalPortfolio.positions[0]!.quantity).toBe(100)
    expect(result.decisionPath).toContain('decisions')
  })
})
