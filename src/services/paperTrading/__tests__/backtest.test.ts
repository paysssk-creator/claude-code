import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PaperBroker } from '../brokers/paperBroker.js'
import {
  MomentumStrategy,
  runBacktest,
  exportBacktestResult,
} from '../index.js'
import { makeAshareMarketData } from '../brokers/ashareMockData.js'

describe('runBacktest', () => {
  test('runs a deterministic multi-day session', () => {
    const symbol = '000001'
    const dates = [
      new Date('2026-06-28'),
      new Date('2026-06-29'),
      new Date('2026-06-30'),
    ]
    const closes = [10, 9.5, 10.4]
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
    expect(result.sharpeRatio).not.toBeNaN()
    expect(result.winRatePct).toBeGreaterThanOrEqual(0)
    expect(result.totalTrades).toBeGreaterThan(0)
    expect(result.benchmarkReturnPct).not.toBeNaN()
  })

  test('reports closed trade P&L', () => {
    const symbol = '000001'
    const dates = [
      new Date('2026-06-28'),
      new Date('2026-06-29'),
      new Date('2026-06-30'),
    ]
    const closes = [10, 9.5, 10.4]
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

    const sellTrades = result.trades.filter(t => t.side === 'sell')
    expect(sellTrades.length).toBeGreaterThan(0)
    expect(sellTrades[0]?.pnl).not.toBeNaN()
  })

  test('exports backtest result to JSON', () => {
    const symbol = '000001'
    const dates = [
      new Date('2026-06-28'),
      new Date('2026-06-29'),
      new Date('2026-06-30'),
    ]
    const closes = [10, 9.5, 10.4]
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

    const dir = mkdtempSync(join(tmpdir(), 'paper-trading-export-'))
    const outputPath = join(dir, 'result.json')
    exportBacktestResult(result, outputPath)

    const raw = readFileSync(outputPath, 'utf-8')
    const exported = JSON.parse(raw)
    expect(exported.summary.totalReturnPct).toBe(result.totalReturnPct)
    expect(exported.equityCurve).toHaveLength(result.equityCurve.length)
    expect(exported.trades.length).toBe(result.trades.length)
    expect(exported.signals.length).toBe(result.signals.length)

    rmSync(dir, { recursive: true, force: true })
  })
})
