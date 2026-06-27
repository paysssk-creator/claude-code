import type { MarketData } from '../types.js'

export function makeAshareMarketData(
  symbol: string,
  close: number,
  overrides?: Partial<MarketData>,
): MarketData {
  const open = overrides?.open ?? close * 0.99
  const high = overrides?.high ?? close * 1.02
  const low = overrides?.low ?? close * 0.98
  return {
    symbol,
    timestamp: new Date(),
    open,
    high,
    low,
    close,
    volume: 1_000_000,
    ...overrides,
  }
}

export function makeAshareDataMap(
  entries: Record<string, number>,
): Map<string, MarketData> {
  const map = new Map<string, MarketData>()
  for (const [symbol, close] of Object.entries(entries)) {
    map.set(symbol, makeAshareMarketData(symbol, close))
  }
  return map
}
