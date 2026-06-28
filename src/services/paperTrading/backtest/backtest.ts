import { writeFileSync } from 'node:fs'
import type {
  Broker,
  MarketData,
  Portfolio,
  Strategy,
  StrategySignal,
} from '../types.js'
import type { RiskManager } from '../risk/riskManager.js'

export interface TradeRecord {
  timestamp: Date
  symbol: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  pnl: number
}

export interface BacktestResult {
  equityCurve: { timestamp: Date; totalValue: number }[]
  signals: StrategySignal[]
  trades: TradeRecord[]
  totalReturnPct: number
  maxDrawdownPct: number
  sharpeRatio: number
  winRatePct: number
  totalTrades: number
  /** Return of an equal-weight buy-and-hold portfolio over the same period. */
  benchmarkReturnPct: number
}

export interface BacktestOptions {
  broker: Broker
  strategy: Strategy
  symbols: string[]
  dates: Date[]
  /** Update the broker's market data for a given date and symbol. */
  updateMarketData: (date: Date, symbol: string) => MarketData
  riskManager?: RiskManager
  onDayEnd?: (broker: Broker, date: Date) => void
}

interface BacktestState {
  equityCurve: { timestamp: Date; totalValue: number }[]
  signals: StrategySignal[]
  trades: TradeRecord[]
  peak: number
  initialPrices: Map<string, number>
  finalPrices: Map<string, number>
  buyPrices: Map<string, number>
}

function createBacktestState(initialValue: number): BacktestState {
  return {
    equityCurve: [],
    signals: [],
    trades: [],
    peak: initialValue,
    initialPrices: new Map<string, number>(),
    finalPrices: new Map<string, number>(),
    buyPrices: new Map<string, number>(),
  }
}

function computeMetrics(
  equityCurve: BacktestState['equityCurve'],
  trades: BacktestState['trades'],
  symbols: string[],
  initialPrices: Map<string, number>,
  finalPrices: Map<string, number>,
): Omit<BacktestResult, 'equityCurve' | 'signals' | 'trades'> {
  const initialValue = equityCurve[0]?.totalValue ?? 0
  const finalValue = equityCurve.at(-1)?.totalValue ?? initialValue
  const totalReturnPct =
    initialValue === 0 ? 0 : (finalValue - initialValue) / initialValue

  const returns = equityCurve.slice(1).map((point, i) => {
    const prev = equityCurve[i]?.totalValue ?? initialValue
    return prev === 0 ? 0 : (point.totalValue - prev) / prev
  })
  const meanReturn =
    returns.length === 0
      ? 0
      : returns.reduce((a, b) => a + b, 0) / returns.length
  const variance =
    returns.length === 0
      ? 0
      : returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) /
        returns.length
  const stdDev = Math.sqrt(variance)
  const sharpeRatio = stdDev === 0 ? 0 : meanReturn / stdDev

  const closedTrades = trades.filter(t => t.side === 'sell')
  const winningTrades = closedTrades.filter(t => t.pnl > 0)
  const winRatePct =
    closedTrades.length === 0 ? 0 : winningTrades.length / closedTrades.length

  const validSymbols = symbols.filter(symbol => initialPrices.has(symbol))
  const benchmarkReturnPct =
    validSymbols.length === 0
      ? 0
      : validSymbols.reduce((sum, symbol) => {
          const initial = initialPrices.get(symbol) ?? 0
          const final = finalPrices.get(symbol) ?? 0
          return initial === 0 ? sum : sum + (final - initial) / initial
        }, 0) / validSymbols.length

  return {
    totalReturnPct,
    maxDrawdownPct: 0,
    sharpeRatio,
    winRatePct,
    totalTrades: closedTrades.length,
    benchmarkReturnPct,
  }
}

function finalizeBacktestResult(
  state: BacktestState,
  symbols: string[],
): BacktestResult {
  const metrics = computeMetrics(
    state.equityCurve,
    state.trades,
    symbols,
    state.initialPrices,
    state.finalPrices,
  )

  let peak = state.peak
  const maxDrawdownPct = state.equityCurve.reduce((max, point) => {
    if (point.totalValue > peak) peak = point.totalValue
    const drawdown = peak === 0 ? 0 : (peak - point.totalValue) / peak
    return Math.max(max, drawdown)
  }, 0)

  return {
    ...metrics,
    maxDrawdownPct,
    equityCurve: state.equityCurve,
    signals: state.signals,
    trades: state.trades,
  }
}

async function runBacktestLoop(
  options: BacktestOptions,
  getSignal: (
    strategy: Strategy,
    data: MarketData,
    portfolio: Portfolio,
  ) => StrategySignal | null | Promise<StrategySignal | null>,
): Promise<BacktestResult> {
  const {
    broker,
    strategy,
    symbols,
    dates,
    updateMarketData,
    riskManager,
    onDayEnd,
  } = options
  const state = createBacktestState(broker.getPortfolio().totalValue)

  for (const date of dates) {
    for (const symbol of symbols) {
      const data = updateMarketData(date, symbol)
      if (!state.initialPrices.has(symbol)) {
        state.initialPrices.set(symbol, data.close)
      }
      state.finalPrices.set(symbol, data.close)
      const signal = await getSignal(strategy, data, broker.getPortfolio())
      if (!signal) continue

      const approved =
        riskManager?.approve(signal, data, broker.getPortfolio()) ?? signal
      if (!approved) continue

      const order = broker.placeOrder({
        symbol: approved.symbol,
        side: approved.side,
        type: 'market',
        quantity: approved.quantity,
      })
      state.signals.push(approved)

      if (order.status === 'filled') {
        const price = order.price ?? data.close
        if (order.side === 'buy') {
          state.buyPrices.set(order.symbol, price)
        } else {
          const entryPrice = state.buyPrices.get(order.symbol) ?? price
          const pnl = (price - entryPrice) * order.quantity
          state.trades.push({
            timestamp: order.timestamp,
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantity,
            price,
            pnl,
          })
        }
      }
    }

    onDayEnd?.(broker, date)

    const totalValue = broker.getPortfolio().totalValue
    if (totalValue > state.peak) state.peak = totalValue
    state.equityCurve.push({ timestamp: date, totalValue })
  }

  return finalizeBacktestResult(state, symbols)
}

/**
 * Run a simple day-by-day backtest.
 *
 * For each date, market data is updated, the strategy is evaluated per symbol,
 * and orders are placed through the broker. The broker must implement
 * record-keeping such as `recordEquity` if an equity curve is desired.
 */
export async function runBacktest(
  options: BacktestOptions,
): Promise<BacktestResult> {
  return await runBacktestLoop(options, (strategy, data, portfolio) =>
    strategy.evaluate(data, portfolio),
  )
}

/**
 * Run a day-by-day backtest supporting asynchronous strategy evaluation.
 *
 * Identical to {@link runBacktest}, but awaits `strategy.evaluateAsync` if
 * present, otherwise falls back to synchronous `evaluate`.
 */
export async function runBacktestAsync(
  options: BacktestOptions,
): Promise<BacktestResult> {
  return await runBacktestLoop(options, (strategy, data, portfolio) => {
    if (strategy.evaluateAsync) {
      return strategy.evaluateAsync(data, portfolio)
    }
    return strategy.evaluate(data, portfolio)
  })
}

export interface BacktestExport {
  summary: {
    totalReturnPct: number
    benchmarkReturnPct: number
    maxDrawdownPct: number
    sharpeRatio: number
    winRatePct: number
    totalTrades: number
  }
  equityCurve: { timestamp: string; totalValue: number }[]
  signals: { symbol: string; side: string; quantity: number; reason: string }[]
  trades: {
    timestamp: string
    symbol: string
    side: string
    quantity: number
    price: number
    pnl: number
  }[]
}

export function exportBacktestResult(
  result: BacktestResult,
  outputPath: string,
): void {
  const exportData: BacktestExport = {
    summary: {
      totalReturnPct: result.totalReturnPct,
      benchmarkReturnPct: result.benchmarkReturnPct,
      maxDrawdownPct: result.maxDrawdownPct,
      sharpeRatio: result.sharpeRatio,
      winRatePct: result.winRatePct,
      totalTrades: result.totalTrades,
    },
    equityCurve: result.equityCurve.map(point => ({
      timestamp: point.timestamp.toISOString(),
      totalValue: point.totalValue,
    })),
    signals: result.signals.map(signal => ({
      symbol: signal.symbol,
      side: signal.side,
      quantity: signal.quantity,
      reason: signal.reason,
    })),
    trades: result.trades.map(trade => ({
      timestamp: trade.timestamp.toISOString(),
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price,
      pnl: trade.pnl,
    })),
  }
  writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8')
}
