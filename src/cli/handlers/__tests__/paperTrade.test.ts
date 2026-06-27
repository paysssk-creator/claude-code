import { describe, expect, test } from 'bun:test'
import { paperTradeHandler } from '../paperTrade.js'

describe('paperTradeHandler', () => {
  test('runs sample CSV backtest and prints statistics', async () => {
    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.map(a => String(a)).join(' '))
    }

    try {
      await paperTradeHandler({
        csv: 'scripts/data/sample-ohlcv.csv',
        cash: '100000',
        dip: '0.03',
        profit: '0.05',
      })
    } finally {
      console.log = originalLog
    }

    const output = logs.join('\n')
    expect(output).toContain('Signals')
    expect(output).toContain('Trading statistics')
    expect(output).toContain('Equity curve')
    expect(output).toContain('Closed trades')
    expect(output).toContain('Final orders')
    expect(output).toContain('Total return:')
    expect(output).toContain('Benchmark return:')
    expect(output).toContain('Sharpe ratio:')
  })

  test('rejects invalid initial cash', async () => {
    await expect(
      paperTradeHandler({
        csv: 'scripts/data/sample-ohlcv.csv',
        cash: 'abc',
      }),
    ).rejects.toThrow('Invalid initial cash')
  })
})
