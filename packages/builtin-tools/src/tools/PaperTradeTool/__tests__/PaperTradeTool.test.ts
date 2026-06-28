import { describe, expect, test } from 'bun:test'
import { PaperTradeTool } from '../PaperTradeTool.js'

describe('PaperTradeTool', () => {
  const csvPath = `${import.meta.dirname}/../../../../../../scripts/data/sample-ohlcv.csv`

  test('runs backtest and returns structured output', async () => {
    const result = await PaperTradeTool.call({ csv: csvPath, cash: 100_000 })

    expect(result.data.symbols).toEqual(['000001', '000002'])
    expect(result.data.initialCash).toBe(100_000)
    expect(result.data.totalTrades).toBeGreaterThanOrEqual(0)
    expect(result.data.signals.length).toBeGreaterThanOrEqual(0)
    expect(result.data.trades.length).toBeGreaterThanOrEqual(0)
  })

  test('validates missing csv parameter', async () => {
    const validation = await PaperTradeTool.validateInput({ csv: '' })
    expect(validation.result).toBe(false)
  })
})
