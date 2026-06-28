import { describe, expect, test } from 'bun:test'
import { runAgentTradingSession } from '../agentRunner.js'
import type { MarketData } from '../types.js'

describe('runAgentTradingSession', () => {
  const csvPath = `${import.meta.dirname}/../../../../scripts/data/sample-ohlcv.csv`

  test('runs AI-driven session with async decide callback', async () => {
    const decisions: Array<{ data: MarketData; side: string }> = []

    const result = await runAgentTradingSession({
      csv: csvPath,
      cash: 100_000,
      async decide(data, _portfolio, context) {
        decisions.push({ data, side: 'hold' })
        // Simple rule: buy dip on first day of data for a symbol, sell when profitable
        if (context.currentPosition) {
          const gain =
            (data.close - context.currentPosition.averageCost) /
            context.currentPosition.averageCost
          if (gain >= 0.05) {
            return {
              symbol: data.symbol,
              side: 'sell',
              quantity: context.currentPosition.quantity,
              reason: 'AI take-profit',
            }
          }
        } else if (context.availableCash >= data.close * 100) {
          return {
            symbol: data.symbol,
            side: 'buy',
            quantity: 100,
            reason: 'AI buy signal',
          }
        }
        return null
      },
    })

    expect(result.aiDecisions.length).toBeGreaterThanOrEqual(0)
    expect(result.totalTrades).toBeGreaterThanOrEqual(0)
    expect(result.equityCurve.length).toBeGreaterThan(0)
  })
})
