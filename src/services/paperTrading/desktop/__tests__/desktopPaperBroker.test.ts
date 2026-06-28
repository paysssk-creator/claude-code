import { describe, expect, test } from 'bun:test'
import { DesktopBroker } from '../../brokers/desktopPaperBroker.js'
import type { DesktopUINavigator, PortfolioSnapshot } from '../uiNavigator.js'
import type { MarketData } from '../../types.js'

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
    marketData: new Map<string, MarketData>(),
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
      // Simulate the app updating its portfolio after a fill.
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

describe('DesktopBroker', () => {
  test('rejects non-lot-sized orders', async () => {
    const navigator = makeNavigator()
    navigator.marketData.set('000001', makeMarketData('000001', 10))
    const broker = new DesktopBroker({
      navigator,
      initialCash: 100_000,
    })
    await broker.refreshMarketData('000001')

    const order = broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      quantity: 50,
      type: 'limit',
      price: 10,
    })

    expect(order.status).toBe('rejected')
    expect(order.rejectReason).toContain('multiple of 100')
  })

  test('delegates valid buy order to navigator and updates shadow ledger', async () => {
    const navigator = makeNavigator()
    navigator.marketData.set('000001', makeMarketData('000001', 10))
    const broker = new DesktopBroker({
      navigator,
      initialCash: 100_000,
    })
    await broker.refreshMarketData('000001')

    broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      quantity: 100,
      type: 'limit',
      price: 10,
    })
    await broker.flush()

    expect(navigator.orders).toHaveLength(1)
    expect(navigator.orders[0]!.quantity).toBe(100)
    expect(broker.getPortfolio().positions[0]!.quantity).toBe(100)
  })

  test('reconciles portfolio from navigator', async () => {
    const navigator = makeNavigator()
    navigator.portfolio = {
      cash: 80_000,
      positions: [{ symbol: '000001', quantity: 200, averageCost: 9.5 }],
    }
    const broker = new DesktopBroker({
      navigator,
      initialCash: 100_000,
    })

    await broker.reconcilePortfolio()

    const portfolio = broker.getPortfolio()
    expect(portfolio.cash).toBe(80_000)
    expect(portfolio.positions).toHaveLength(1)
    expect(portfolio.positions[0]!.quantity).toBe(200)
  })
})
