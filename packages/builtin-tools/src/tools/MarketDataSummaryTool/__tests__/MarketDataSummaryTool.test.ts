import { describe, expect, test } from 'bun:test'
import { MarketDataSummaryTool } from '../MarketDataSummaryTool.js'

describe('MarketDataSummaryTool', () => {
  const csvPath = `${import.meta.dirname}/../../../../../../scripts/data/sample-ohlcv.csv`

  test('summarizes csv feed', async () => {
    const result = await MarketDataSummaryTool.call({ csv: csvPath })

    expect(result.data.symbols).toEqual(['000001', '000002'])
    expect(result.data.totalRows).toBe(12)
    expect(result.data.rowsPerSymbol['000001']).toBe(6)
    expect(result.data.latestClose['000001']).toBe(10.5)
    expect(result.data.highLowRange['000001']).toEqual({
      high: 10.6,
      low: 9.4,
    })
  })

  test('validates missing csv parameter', async () => {
    const validation = await MarketDataSummaryTool.validateInput({ csv: '' })
    expect(validation.result).toBe(false)
  })
})
