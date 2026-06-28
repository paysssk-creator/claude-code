import { resolve } from 'node:path'
import type { Broker, MarketData, StrategySignal } from './types.js'
import {
  AShareFeeModel,
  BasicRiskManager,
  PaperBroker,
  loadCsvDataFeed,
  runBacktestAsync,
} from './index.js'
import { AgentStrategy } from './strategy/agentStrategy.js'
import type { BacktestResult, BacktestOptions } from './backtest/backtest.js'

export type AgentDecideSignal = (
  data: MarketData,
  portfolio: ReturnType<Broker['getPortfolio']>,
  context: {
    availableCash: number
    currentPosition?: { symbol: string; quantity: number; averageCost: number }
    previousSignal?: StrategySignal
  },
) => StrategySignal | null | Promise<StrategySignal | null>

export interface AgentTradingSessionOptions {
  csv: string
  cash?: number
  decide: AgentDecideSignal
  maxCashDeployPct?: number
  maxPositionValuePct?: number
  maxOrdersPerDay?: number
  maxDrawdownPct?: number
}

export interface AgentTradingSessionResult extends BacktestResult {
  aiDecisions: StrategySignal[]
}

export async function runAgentTradingSession(
  options: AgentTradingSessionOptions,
): Promise<AgentTradingSessionResult> {
  const csvPath = resolve(options.csv)
  const initialCash = options.cash ?? 100_000
  const feed = loadCsvDataFeed(csvPath)

  const initialDate = feed.dates[0]!
  const marketData = new Map<string, MarketData>()
  for (const symbol of feed.symbols) {
    const data = feed.get(initialDate, symbol)
    if (data) {
      marketData.set(symbol, data)
    }
  }

  const broker = new PaperBroker({
    initialCash,
    marketData,
    enforceT1: true,
    feeModel: new AShareFeeModel(),
  })

  const aiDecisions: StrategySignal[] = []

  const strategy = new AgentStrategy(async (data, portfolio) => {
    const position = portfolio.positions.find(p => p.symbol === data.symbol)
    const signal = await options.decide(data, portfolio, {
      availableCash: portfolio.cash,
      currentPosition: position,
      previousSignal: aiDecisions.at(-1),
    })
    if (signal) {
      aiDecisions.push(signal)
    }
    return signal
  })

  const riskManager = new BasicRiskManager({
    maxCashDeployPct: options.maxCashDeployPct ?? 0.3,
    maxPositionValuePct: options.maxPositionValuePct ?? 0.6,
    maxOrdersPerDay: options.maxOrdersPerDay ?? 2,
    maxDrawdownPct: options.maxDrawdownPct,
  })

  const backtestOptions: BacktestOptions = {
    broker,
    strategy,
    symbols: feed.symbols,
    dates: feed.dates,
    riskManager,
    updateMarketData: (date, symbol) => {
      const data = feed.get(date, symbol)
      if (!data) {
        throw new Error(
          `No data for ${symbol} on ${date.toISOString().slice(0, 10)}`,
        )
      }
      broker.setMarketData(symbol, data)
      return data
    },
    onDayEnd: (_, date) => {
      broker.recordEquity(date)
    },
  }

  const result = await runBacktestAsync(backtestOptions)

  return {
    ...result,
    aiDecisions,
  }
}
