/**
 * Orchestrates a single desktop paper-trading session through a Chinese
 * retail trading application running in simulation mode.
 */

import type { MarketData, Order, Portfolio, StrategySignal } from '../types.js'
import type { FeeModel } from '../fees/feeModel.js'
import { AShareFeeModel } from '../fees/feeModel.js'
import { BasicRiskManager } from '../risk/riskManager.js'
import { DesktopBroker } from '../brokers/desktopPaperBroker.js'
import { recordDecision, type DecisionRecord } from '../memory/decisionLog.js'
import type { DesktopUINavigator } from './uiNavigator.js'

export type DesktopDecideSignal = (
  data: MarketData,
  portfolio: Portfolio,
) => StrategySignal | null | Promise<StrategySignal | null>

export interface DesktopTradingSessionOptions {
  navigator: DesktopUINavigator
  symbols: string[]
  initialCash: number
  initialPositions?: { symbol: string; quantity: number; averageCost: number }[]
  decide: DesktopDecideSignal
  riskManager?: BasicRiskManager
  feeModel?: FeeModel
  rationale?: string
  lessons?: string
}

export interface DesktopTradingSessionResult {
  signals: StrategySignal[]
  orders: Order[]
  finalPortfolio: Portfolio
  decisionPath: string
}

export async function runDesktopTradingSession(
  options: DesktopTradingSessionOptions,
): Promise<DesktopTradingSessionResult> {
  const navigator = options.navigator

  await navigator.requestAccess(
    'A-share desktop paper-trading automation via computer-use MCP',
  )
  await navigator.openAndBind()
  await navigator.navigateToPaperTrading()

  const broker = new DesktopBroker({
    navigator,
    initialCash: options.initialCash,
    initialPositions: options.initialPositions,
    enforceT1: true,
    feeModel: options.feeModel ?? new AShareFeeModel(),
  })

  await broker.reconcilePortfolio()

  const riskManager = options.riskManager ?? new BasicRiskManager()
  const signals: StrategySignal[] = []

  for (const symbol of options.symbols) {
    const data = await broker.refreshMarketData(symbol)
    const portfolio = broker.getPortfolio()
    const signal = await options.decide(data, portfolio)
    if (!signal) {
      continue
    }

    const approved = riskManager.approve(signal, data, portfolio)
    if (!approved) {
      continue
    }

    broker.placeOrder({
      symbol: signal.symbol,
      side: signal.side,
      quantity: signal.quantity,
      type: 'limit',
      price: data.close,
    })
    signals.push(signal)

    // Ensure the shadow ledger reflects the executed order before the next
    // decision so risk checks remain accurate.
    await broker.flush()
    await broker.reconcilePortfolio()
  }

  await broker.flush()
  await broker.reconcilePortfolio()
  const finalPortfolio = broker.getPortfolio()

  const today = new Date().toISOString().slice(0, 10)
  const record: DecisionRecord = {
    date: today,
    symbols: options.symbols,
    signals,
    finalValue: finalPortfolio.totalValue,
    totalReturnPct:
      options.initialCash === 0
        ? 0
        : (finalPortfolio.totalValue - options.initialCash) /
          options.initialCash,
    rationale: options.rationale ?? 'Desktop paper-trading session.',
    lessons:
      options.lessons ??
      'Review screenshots and app confirmations for execution quality.',
  }
  const decisionPath = recordDecision(record)

  await navigator.unbind()

  return {
    signals,
    orders: broker.getOrders(),
    finalPortfolio,
    decisionPath,
  }
}
