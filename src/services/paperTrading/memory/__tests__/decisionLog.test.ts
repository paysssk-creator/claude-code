import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  decisionFilePath,
  loadRecentDecisions,
  recordDecision,
} from '../decisionLog.js'

describe('decisionLog', () => {
  let originalCwd: string

  test('recordDecision writes markdown file and loadRecentDecisions reads it back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'paper-trading-decisions-'))
    originalCwd = process.cwd()
    process.chdir(dir)

    const record = {
      date: '2026-07-03',
      symbols: ['000001'],
      signals: [
        {
          symbol: '000001',
          side: 'buy' as const,
          quantity: 100,
          reason: 'AI buy signal',
        },
      ],
      finalValue: 105_000,
      totalReturnPct: 0.05,
      rationale: 'Bullish momentum.',
      lessons: 'Stick to stops.',
    }

    const path = recordDecision(record)
    expect(existsSync(path)).toBe(true)

    const recent = loadRecentDecisions(5)
    expect(recent.length).toBe(1)
    expect(recent[0]?.date).toBe('2026-07-03')
    expect(recent[0]?.symbols).toEqual(['000001'])
    expect(recent[0]?.signals[0]?.side).toBe('buy')

    process.chdir(originalCwd)
    rmSync(dir, { recursive: true, force: true })
  })

  test('decisionFilePath returns expected path', () => {
    originalCwd = process.cwd()
    const dir = mkdtempSync(join(tmpdir(), 'paper-trading-decisions-'))
    process.chdir(dir)

    const path = decisionFilePath({
      date: '2026-07-03',
      symbols: ['000001', '000002'],
      signals: [],
      finalValue: 100_000,
      totalReturnPct: 0,
      rationale: '',
      lessons: '',
    })
    expect(path).toContain(
      join('docs', 'knowledge-base', 'trading-operations', 'decisions'),
    )
    expect(path).toContain('2026-07-03-000001-000002.md')

    process.chdir(originalCwd)
    rmSync(dir, { recursive: true, force: true })
  })
})
