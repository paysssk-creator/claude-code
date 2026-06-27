import type { Broker, MarketData, Strategy, StrategySignal } from '../types.js'
import type { RiskManager } from '../risk/riskManager.js'

export interface BacktestResult {
  equityCurve: { timestamp: Date; totalValue: number }[]
  signals: StrategySignal[]
  totalReturnPct: number
  maxDrawdownPct: number
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

  let peak = broker.getPortfolio().totalValue

  for (const date of dates) {
    for (const symbol of symbols) {
      const data = updateMarketData(date, symbol)
      const signal = strategy.evaluate(data, broker.getPortfolio())
      if (!signal) continue

      const approved =
        riskManager?.approve(signal, data, broker.getPortfolio()) ?? signal
      if (!approved) continue

      broker.placeOrder({
        symbol: approved.symbol,
        side: approved.side,
        type: 'market',
        quantity: approved.quantity,
      })
      signals.push(approved)
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

  return {
    equityCurve,
    signals,
    totalReturnPct,
    maxDrawdownPct,
  }
}
