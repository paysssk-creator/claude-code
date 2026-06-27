import { readFileSync } from 'node:fs'
import type { MarketData } from '../types.js'

export interface CsvRow {
  symbol: string
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CsvDataFeed {
  dates: Date[]
  symbols: string[]
  /** Get market data for a symbol on a specific date. */
  get(date: Date, symbol: string): MarketData | undefined
}

function parseNumber(value: string): number {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`)
  }
  return parsed
}

function parseDate(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`)
  }
  return date
}

function parseLine(line: string): CsvRow | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) {
    return null
  }

  const columns = trimmed.split(',')
  if (columns.length < 7) {
    throw new Error(`CSV line does not have enough columns: ${line}`)
  }

  const [symbol, date, open, high, low, close, volume] = columns
  if (!symbol || !date) {
    throw new Error(`Missing symbol or date in CSV line: ${line}`)
  }

  return {
    symbol: symbol.trim(),
    timestamp: parseDate(date.trim()),
    open: parseNumber(open.trim()),
    high: parseNumber(high.trim()),
    low: parseNumber(low.trim()),
    close: parseNumber(close.trim()),
    volume: parseNumber(volume.trim()),
  }
}

/**
 * Load a CSV file containing OHLCV market data.
 *
 * Expected columns:
 *   symbol,date,open,high,low,close,volume
 *
 * The CSV must be sorted by date ascending (or at least grouped by date so
 * that the first occurrence of a date establishes its position in the feed).
 */
export function loadCsvDataFeed(path: string): CsvDataFeed {
  const content = readFileSync(path, 'utf-8')
  const lines = content.split(/\r?\n/)

  const bySymbol = new Map<string, Map<string, MarketData>>()
  const dateKeys = new Set<string>()
  const dateOrder: Date[] = []

  for (const line of lines) {
    const row = parseLine(line)
    if (!row) continue

    let symbolMap = bySymbol.get(row.symbol)
    if (!symbolMap) {
      symbolMap = new Map<string, MarketData>()
      bySymbol.set(row.symbol, symbolMap)
    }

    const dateKey = row.timestamp.toISOString().slice(0, 10)
    symbolMap.set(dateKey, {
      symbol: row.symbol,
      timestamp: row.timestamp,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    })

    if (!dateKeys.has(dateKey)) {
      dateKeys.add(dateKey)
      dateOrder.push(row.timestamp)
    }
  }

  const symbols = Array.from(bySymbol.keys())
  if (symbols.length === 0) {
    throw new Error(`No valid data rows found in ${path}`)
  }

  return {
    dates: dateOrder,
    symbols,
    get(date, symbol) {
      return bySymbol.get(symbol)?.get(date.toISOString().slice(0, 10))
    },
  }
}
