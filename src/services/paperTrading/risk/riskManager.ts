import type { MarketData, Portfolio, StrategySignal } from '../types.js'

export interface RiskManager {
  /** Return the allowed signal, or null if the signal should be blocked. */
  approve(
    signal: StrategySignal,
    data: MarketData,
    portfolio: Portfolio,
  ): StrategySignal | null
}

export interface BasicRiskManagerOptions {
  /** Max fraction of total portfolio value a single position may represent. */
  maxPositionValuePct?: number
  /** Max fraction of cash that can be deployed in a single buy order. */
  maxCashDeployPct?: number
  /** Max orders allowed per symbol per trading day. */
  maxOrdersPerDay?: number
}

/**
 * Simple risk guard for the paper-trading simulator.
 *
 * Blocks oversized buy orders and enforces a daily order-frequency limit.
 */
export class BasicRiskManager implements RiskManager {
  private readonly maxPositionValuePct: number
  private readonly maxCashDeployPct: number
  private readonly maxOrdersPerDay: number
  private readonly orderCounts = new Map<string, number>()

  constructor(options: BasicRiskManagerOptions = {}) {
    this.maxPositionValuePct = options.maxPositionValuePct ?? 0.5
    this.maxCashDeployPct = options.maxCashDeployPct ?? 0.25
    this.maxOrdersPerDay = options.maxOrdersPerDay ?? 2
  }

  approve(
    signal: StrategySignal,
    data: MarketData,
    portfolio: Portfolio,
  ): StrategySignal | null {
    const key = `${data.symbol}@${data.timestamp.toISOString().slice(0, 10)}`
    const count = this.orderCounts.get(key) ?? 0
    if (count >= this.maxOrdersPerDay) {
      return null
    }

    if (signal.side === 'buy') {
      const orderValue = data.close * signal.quantity
      const maxCash = portfolio.totalValue * this.maxCashDeployPct
      const positionValue =
        (portfolio.positions.find(p => p.symbol === data.symbol)?.quantity ??
          0) * data.close
      const maxPosition = portfolio.totalValue * this.maxPositionValuePct

      if (orderValue > maxCash || positionValue + orderValue > maxPosition) {
        return null
      }
    }

    this.orderCounts.set(key, count + 1)
    return signal
  }
}
