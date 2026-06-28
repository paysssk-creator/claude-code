import type {
  MarketData,
  Portfolio,
  Strategy,
  StrategySignal,
} from '../types.js'

export type DecideSignal = (
  data: MarketData,
  portfolio: Portfolio,
) => StrategySignal | null | Promise<StrategySignal | null>

export class AgentStrategy implements Strategy {
  constructor(private decide: DecideSignal) {}

  evaluate(data: MarketData, portfolio: Portfolio): StrategySignal | null {
    const signal = this.decide(data, portfolio)
    if (signal instanceof Promise) {
      throw new Error(
        'AgentStrategy.evaluate received a Promise; use evaluateAsync instead',
      )
    }
    return signal
  }

  async evaluateAsync(
    data: MarketData,
    portfolio: Portfolio,
  ): Promise<StrategySignal | null> {
    return await this.decide(data, portfolio)
  }
}
