import { describe, expect, test } from 'bun:test'
import { PaperBroker } from '../brokers/paperBroker.js'
import {
  makeAshareDataMap,
  makeAshareMarketData,
} from '../brokers/ashareMockData.js'
import { AShareFeeModel } from '../fees/feeModel.js'

describe('PaperBroker', () => {
  test('starts with initial cash and empty positions', () => {
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: makeAshareDataMap({ '000001': 10 }),
    })
    expect(broker.getCash()).toBe(100_000)
    expect(broker.getPortfolio().positions).toHaveLength(0)
  })

  test('buys shares and reduces cash', () => {
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: makeAshareDataMap({ '000001': 10 }),
    })
    const order = broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'market',
      quantity: 1000,
    })
    expect(order.status).toBe('filled')
    expect(broker.getCash()).toBe(90_000)
    expect(broker.getPortfolio().positions[0]?.quantity).toBe(1000)
  })

  test('rejects non-lot-multiple quantity', () => {
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: makeAshareDataMap({ '000001': 10 }),
    })
    const order = broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'market',
      quantity: 150,
    })
    expect(order.status).toBe('rejected')
  })

  test('rejects buy when cash is insufficient', () => {
    const broker = new PaperBroker({
      initialCash: 100,
      marketData: makeAshareDataMap({ '000001': 10 }),
    })
    const order = broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'market',
      quantity: 1000,
    })
    expect(order.status).toBe('rejected')
  })

  test('rejects same-day sell due to T+1', () => {
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: makeAshareDataMap({ '000001': 10 }),
    })
    broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'market',
      quantity: 1000,
    })
    const sell = broker.placeOrder({
      symbol: '000001',
      side: 'sell',
      type: 'market',
      quantity: 1000,
    })
    expect(sell.status).toBe('rejected')
    expect(sell.rejectReason).toContain('T+1')
  })

  test('portfolio value reflects market price changes', () => {
    const data = makeAshareDataMap({ '000001': 10 })
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: data,
    })
    broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'market',
      quantity: 1000,
    })

    data.set('000001', makeAshareMarketData('000001', 12))
    const portfolio = broker.getPortfolio()
    expect(portfolio.totalValue).toBe(102_000)
  })

  test('applies fees when fee model is configured', () => {
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: makeAshareDataMap({ '000001': 10 }),
      feeModel: new AShareFeeModel(),
      enforceT1: false,
    })
    const buy = broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'market',
      quantity: 1000,
    })
    expect(buy.fee).toBeGreaterThan(0)
    expect(buy.status).toBe('filled')
    expect(broker.getStats().totalFees).toBe(buy.fee ?? 0)

    const sell = broker.placeOrder({
      symbol: '000001',
      side: 'sell',
      type: 'market',
      quantity: 1000,
    })
    expect(sell.fee).toBeGreaterThan(buy.fee ?? 0)
    expect(sell.status).toBe('filled')
    expect(broker.getStats().totalTurnover).toBe(20_000)
  })

  test('records equity curve snapshots', () => {
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: makeAshareDataMap({ '000001': 10 }),
    })
    broker.recordEquity(new Date('2026-06-28'))
    broker.recordEquity(new Date('2026-06-29'))
    const curve = broker.getEquityCurve()
    expect(curve).toHaveLength(2)
    expect(curve[0]?.timestamp.toISOString().slice(0, 10)).toBe('2026-06-28')
    expect(curve[1]?.timestamp.toISOString().slice(0, 10)).toBe('2026-06-29')
  })
})
