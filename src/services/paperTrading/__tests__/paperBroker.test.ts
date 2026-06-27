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

  test('allows first-day market order without prior close', () => {
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
  })

  test('rejects market order beyond A-share upper price limit', () => {
    const data = makeAshareDataMap({ '000001': 10 })
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: data,
    })
    broker.setMarketData('000001', makeAshareMarketData('000001', 12))
    const order = broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'market',
      quantity: 100,
    })
    expect(order.status).toBe('rejected')
    expect(order.rejectReason).toContain('daily limit')
  })

  test('rejects market order beyond A-share lower price limit', () => {
    const data = makeAshareDataMap({ '000001': 10 })
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: data,
    })
    broker.setMarketData('000001', makeAshareMarketData('000001', 8.9))
    const order = broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'market',
      quantity: 100,
    })
    expect(order.status).toBe('rejected')
    expect(order.rejectReason).toContain('daily limit')
  })

  test('fills market order at exact A-share limit price', () => {
    const data = makeAshareDataMap({ '000001': 10 })
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: data,
    })
    broker.setMarketData('000001', makeAshareMarketData('000001', 11))
    const order = broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'market',
      quantity: 100,
    })
    expect(order.status).toBe('filled')
  })

  test('rejects limit order outside A-share price limit', () => {
    const data = makeAshareDataMap({ '000001': 10 })
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: data,
    })
    broker.setMarketData('000001', makeAshareMarketData('000001', 10.5))
    const order = broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'limit',
      price: 12.5,
      quantity: 100,
    })
    expect(order.status).toBe('rejected')
    expect(order.rejectReason).toContain('upper price limit')
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
