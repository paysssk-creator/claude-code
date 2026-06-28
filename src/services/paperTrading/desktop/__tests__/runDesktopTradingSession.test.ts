import { describe, expect, test } from 'bun:test'
import { runDesktopTradingSession } from '../runDesktopTradingSession.js'
import type { DesktopUINavigator, PortfolioSnapshot } from '../uiNavigator.js'
import type { MarketData, Portfolio, StrategySignal } from '../../types.js'

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
  calls: {
    requestAccess: number
    openAndBind: number
    navigateToPaperTrading: number
    unbind: number
  }
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
    calls: {
      requestAccess: 0,
      openAndBind: 0,
      navigateToPaperTrading: 0,
      unbind: 0,
    },
    orders: [],
    portfolio: { cash: 100_000, positions: [] },
    marketData: new Map<string, MarketData>([
      ['000001', makeMarketData('000001', 10)],
      ['600519', makeMarketData('600519', 200)],
    ]),
    async requestAccess() {
      this.calls.requestAccess += 1
    },
    async openAndBind() {
      this.calls.openAndBind += 1
    },
    async navigateToPaperTrading() {
      this.calls.navigateToPaperTrading += 1
    },
    async unbind() {
      this.calls.unbind += 1
    },
    async readPortfolio() {
      return this.portfolio
    },
    async readMarketData(symbol: string) {
      return this.marketData.get(symbol) ?? makeMarketData(symbol, 10)
    },
    async placePaperOrder(order) {
      this.orders.push(order)
      if (order.side === 'buy') {
        const existing = this.portfolio.positions.find(
          p => p.symbol === order.symbol,
        )
        if (existing) {
          const totalCost =
            existing.averageCost * existing.quantity +
            order.price * order.quantity
          existing.quantity += order.quantity
          existing.averageCost = totalCost / existing.quantity
        } else {
          this.portfolio.positions.push({
            symbol: order.symbol,
            quantity: order.quantity,
            averageCost: order.price,
          })
        }
        this.portfolio.cash -= order.price * order.quantity
      } else {
        const existing = this.portfolio.positions.find(
          p => p.symbol === order.symbol,
        )
        if (existing) {
          existing.quantity -= order.quantity
          if (existing.quantity === 0) {
            this.portfolio.positions = this.portfolio.positions.filter(
              p => p.symbol !== order.symbol,
            )
          }
        }
        this.portfolio.cash += order.price * order.quantity
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

  test('runs the full desktop workflow for multiple symbols', async () => {
    const navigator = makeNavigator()
    navigator.portfolio = {
      cash: 200_000,
      positions: [{ symbol: '600519', quantity: 200, averageCost: 190 }],
    }

    const decide = async (
      data: MarketData,
      portfolio: Portfolio,
    ): Promise<StrategySignal | null> => {
      if (data.symbol === '000001') {
        return {
          symbol: '000001',
          side: 'buy',
          quantity: 100,
          reason: 'Oversold',
        }
      }
      const holding = portfolio.positions.find(p => p.symbol === '600519')
      if (data.symbol === '600519' && holding && holding.quantity >= 100) {
        return {
          symbol: '600519',
          side: 'sell',
          quantity: 100,
          reason: 'Take profit',
        }
      }
      return null
    }

    const result = await runDesktopTradingSession({
      navigator,
      symbols: ['000001', '600519'],
      initialCash: 200_000,
      initialPositions: [{ symbol: '600519', quantity: 200, averageCost: 190 }],
      decide,
      rationale: 'Full desktop workflow.',
      lessons: 'Buy 000001, sell 600519.',
    })

    expect(navigator.calls.requestAccess).toBe(1)
    expect(navigator.calls.openAndBind).toBe(1)
    expect(navigator.calls.navigateToPaperTrading).toBe(1)
    expect(navigator.calls.unbind).toBe(1)

    expect(result.signals).toHaveLength(2)
    expect(result.orders).toHaveLength(2)

    const buyOrder = navigator.orders.find(o => o.symbol === '000001')
    const sellOrder = navigator.orders.find(o => o.symbol === '600519')
    expect(buyOrder).toBeDefined()
    expect(buyOrder!.side).toBe('buy')
    expect(buyOrder!.quantity).toBe(100)
    expect(sellOrder).toBeDefined()
    expect(sellOrder!.side).toBe('sell')
    expect(sellOrder!.quantity).toBe(100)

    const kweichow = result.finalPortfolio.positions.find(
      p => p.symbol === '600519',
    )
    expect(kweichow).toBeDefined()
    expect(kweichow!.quantity).toBe(100)

    expect(result.decisionPath).toContain('decisions')
    expect(result.decisionPath).toContain(new Date().toISOString().slice(0, 10))
  })

  test('holds when the decide callback returns null', async () => {
    const navigator = makeNavigator()
    const decide = async (): Promise<StrategySignal | null> => null

    const result = await runDesktopTradingSession({
      navigator,
      symbols: ['000001'],
      initialCash: 100_000,
      decide,
    })

    expect(result.signals).toHaveLength(0)
    expect(result.orders).toHaveLength(0)
    expect(navigator.calls.unbind).toBe(1)
  })
})
