import { describe, expect, test } from 'bun:test'
import { PaperBroker } from '../brokers/paperBroker.js'
import { MomentumStrategy, runBacktest } from '../index.js'
import { makeAshareMarketData } from '../brokers/ashareMockData.js'

describe('runBacktest', () => {
  test('runs a deterministic multi-day session', () => {
    const symbol = '000001'
    const dates = [
      new Date('2026-06-28'),
      new Date('2026-06-29'),
      new Date('2026-06-30'),
    ]
    const closes = [10, 9.5, 11]
    const broker = new PaperBroker({
      initialCash: 100_000,
      marketData: new Map([
        [
          symbol,
          makeAshareMarketData(symbol, closes[0]!, { timestamp: dates[0] }),
        ],
      ]),
      enforceT1: false,
    })
    const strategy = new MomentumStrategy({
      dipThreshold: 0.03,
      profitThreshold: 0.05,
      lotSize: 100,
    })

    const result = runBacktest({
      broker,
      strategy,
      symbols: [symbol],
      dates,
      updateMarketData: (date, sym) => {
        const index = dates.findIndex(
          d => d.toISOString().slice(0, 10) === date.toISOString().slice(0, 10),
        )
        const data = makeAshareMarketData(sym, closes[index]!, {
          timestamp: date,
        })
        broker.setMarketData(sym, data)
        return data
      },
    })

    expect(result.equityCurve).toHaveLength(3)
    expect(result.signals.length).toBeGreaterThan(0)
    expect(result.totalReturnPct).not.toBeNaN()
    expect(result.maxDrawdownPct).toBeGreaterThanOrEqual(0)
  })
})
