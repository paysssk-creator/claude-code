import { describe, expect, test } from 'bun:test'
import { PaperBroker } from '../brokers/paperBroker.js'
import { makeAshareDataMap } from '../brokers/ashareMockData.js'
import {
  MomentumStrategy,
  runStrategyTick,
} from '../strategy/momentumStrategy.js'

describe('MomentumStrategy', () => {
  test('emits buy signal on dip', () => {
    const data = makeAshareDataMap({ '000001': 10 })
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: data,
    })
    const strategy = new MomentumStrategy({
      dipThreshold: 0.05,
      profitThreshold: 0.1,
      lotSize: 100,
    })

    // First tick records previous close = 10, no signal
    runStrategyTick(broker, strategy, '000001')

    // Price drops 6% -> buy
    data.set('000001', {
      ...data.get('000001')!,
      close: 9.4,
    })
    const signal = runStrategyTick(broker, strategy, '000001')

    expect(signal?.side).toBe('buy')
    expect(signal?.quantity).toBe(100)
    expect(broker.getPortfolio().positions[0]?.quantity).toBe(100)
  })

  test('emits sell signal on profit', () => {
    const data = makeAshareDataMap({ '000001': 10 })
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: data,
      enforceT1: false,
    })
    const strategy = new MomentumStrategy({
      dipThreshold: 0.05,
      profitThreshold: 0.1,
      lotSize: 100,
    })

    broker.placeOrder({
      symbol: '000001',
      side: 'buy',
      type: 'market',
      quantity: 100,
    })

    // Price rises 15% -> take profit
    data.set('000001', {
      ...data.get('000001')!,
      close: 11.5,
    })

    // Need a previous close for profit calculation; seed it by evaluating once
    strategy.evaluate(data.get('000001')!, broker.getPortfolio())

    const signal = runStrategyTick(broker, strategy, '000001')

    expect(signal?.side).toBe('sell')
    expect(broker.getPortfolio().positions).toHaveLength(0)
  })
})
