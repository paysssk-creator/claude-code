import { describe, expect, test } from 'bun:test'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadCsvDataFeed } from '../data/csvDataFeed.js'

describe('loadCsvDataFeed', () => {
  test('parses CSV and serves market data by date', () => {
    const dir = mkdtempSync(join(tmpdir(), 'paper-trading-'))
    const path = join(dir, 'data.csv')
    writeFileSync(
      path,
      '000001,2026-06-28,10,11,9,10,1000\n000001,2026-06-29,10,11,9,11,1200\n',
    )

    const feed = loadCsvDataFeed(path)
    expect(feed.symbols).toEqual(['000001'])
    expect(feed.dates).toHaveLength(2)

    const first = feed.get(new Date('2026-06-28'), '000001')
    expect(first?.close).toBe(10)
    expect(first?.volume).toBe(1000)

    const second = feed.get(new Date('2026-06-29'), '000001')
    expect(second?.close).toBe(11)
    expect(second?.volume).toBe(1200)

    rmSync(dir, { recursive: true, force: true })
  })

  test('ignores empty lines and comments', () => {
    const dir = mkdtempSync(join(tmpdir(), 'paper-trading-'))
    const path = join(dir, 'data.csv')
    writeFileSync(path, '# header\n\n000001,2026-06-28,10,11,9,10,1000\n')

    const feed = loadCsvDataFeed(path)
    expect(feed.dates).toHaveLength(1)

    rmSync(dir, { recursive: true, force: true })
  })

  test('throws on invalid numeric value', () => {
    const dir = mkdtempSync(join(tmpdir(), 'paper-trading-'))
    const path = join(dir, 'data.csv')
    writeFileSync(path, '000001,2026-06-28,abc,11,9,10,1000\n')

    expect(() => loadCsvDataFeed(path)).toThrow('Invalid numeric value')

    rmSync(dir, { recursive: true, force: true })
  })
})
