import type { Broker, MarketData, Strategy, StrategySignal } from '../types.js'
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

/**
 * Run a simple day-by-day backtest.
 *
 * For each date, market data is updated, the strategy is evaluated per symbol,
 * and orders are placed through the broker. The broker must implement
 * record-keeping such as `recordEquity` if an equity curve is desired.
 */
export function runBacktest(options: BacktestOptions): BacktestResult {
  const {
    broker,
    strategy,
    symbols,
    dates,
    updateMarketData,
    riskManager,
    onDayEnd,
  } = options
  const equityCurve: { timestamp: Date; totalValue: number }[] = []
  const signals: StrategySignal[] = []
  const trades: TradeRecord[] = []
  const buyPrices = new Map<string, number>()

  let peak = broker.getPortfolio().totalValue
  const initialPrices = new Map<string, number>()
  const finalPrices = new Map<string, number>()

  for (const date of dates) {
    for (const symbol of symbols) {
      const data = updateMarketData(date, symbol)
      if (!initialPrices.has(symbol)) {
        initialPrices.set(symbol, data.close)
      }
      finalPrices.set(symbol, data.close)
      const signal = strategy.evaluate(data, broker.getPortfolio())
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
      signals.push(approved)

      if (order.status === 'filled') {
        const price = order.price ?? data.close
        if (order.side === 'buy') {
          buyPrices.set(order.symbol, price)
        } else {
          const entryPrice = buyPrices.get(order.symbol) ?? price
          const pnl = (price - entryPrice) * order.quantity
          trades.push({
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
    if (totalValue > peak) peak = totalValue
    equityCurve.push({ timestamp: date, totalValue })
  }

  const initialValue =
    equityCurve[0]?.totalValue ?? broker.getPortfolio().totalValue
  const finalValue = equityCurve.at(-1)?.totalValue ?? initialValue
  const totalReturnPct =
    initialValue === 0 ? 0 : (finalValue - initialValue) / initialValue

  const maxDrawdownPct = equityCurve.reduce((max, point) => {
    if (point.totalValue > peak) peak = point.totalValue
    const drawdown = peak === 0 ? 0 : (peak - point.totalValue) / peak
    return Math.max(max, drawdown)
  }, 0)

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
    equityCurve,
    signals,
    trades,
    totalReturnPct,
    maxDrawdownPct,
    sharpeRatio,
    winRatePct,
    totalTrades: closedTrades.length,
    benchmarkReturnPct,
  }
}
