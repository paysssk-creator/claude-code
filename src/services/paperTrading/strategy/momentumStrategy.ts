import type {
  Broker,
  MarketData,
  Portfolio,
  Strategy,
  StrategySignal,
} from '../types.js'

export interface MomentumStrategyOptions {
  /** Buy when price drops by at least this fraction from previous close. */
  dipThreshold: number
  /** Sell when price rises by at least this fraction from average cost. */
  profitThreshold: number
  /** Fixed number of shares per signal. */
  lotSize: number
}

export class MomentumStrategy implements Strategy {
  private previousClose = new Map<string, number>()

  constructor(private options: MomentumStrategyOptions) {}

  evaluate(data: MarketData, portfolio: Portfolio): StrategySignal | null {
    const prev = this.previousClose.get(data.symbol)
    this.previousClose.set(data.symbol, data.close)

    const position = portfolio.positions.find(p => p.symbol === data.symbol)

    if (position && position.quantity > 0) {
      const gain = (data.close - position.averageCost) / position.averageCost
      if (gain >= this.options.profitThreshold) {
        return {
          symbol: data.symbol,
          side: 'sell',
          quantity: position.quantity,
          reason: `Take profit: +${(gain * 100).toFixed(1)}%`,
        }
      }
    }

    if (prev && data.close <= prev * (1 - this.options.dipThreshold)) {
      return {
        symbol: data.symbol,
        side: 'buy',
        quantity: this.options.lotSize,
        reason: `Buy dip: -${(this.options.dipThreshold * 100).toFixed(1)}%`,
      }
    }

    return null
  }
}

export function runStrategyTick(
  broker: Broker,
  strategy: Strategy,
  symbol: string,
): StrategySignal | null {
  const data = broker.getMarketData(symbol)
  if (!data) return null
  const portfolio = broker.getPortfolio()
  const signal = strategy.evaluate(data, portfolio)
  if (!signal) return null

  broker.placeOrder({
    symbol: signal.symbol,
    side: signal.side,
    type: 'market',
    quantity: signal.quantity,
  })

  return signal
}
