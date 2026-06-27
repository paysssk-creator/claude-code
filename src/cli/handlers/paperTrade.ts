#!/usr/bin/env bun
/**
 * CLI handler for the `paper-trade` command.
 *
 * Runs an A-share paper-trading backtest from a CSV file containing
 * symbol,date,open,high,low,close,volume data.
 */

import { resolve } from 'node:path'
import {
  AShareFeeModel,
  BasicRiskManager,
  MomentumStrategy,
  PaperBroker,
  exportBacktestResult,
  loadCsvDataFeed,
  runBacktest,
} from '../../services/paperTrading/index.js'
import type { MarketData } from '../../services/paperTrading/types.js'

export interface PaperTradeOptions {
  csv?: string
  cash?: string
  dip?: string
  profit?: string
  stopLoss?: string
  maxDrawdown?: string
  output?: string
}

export async function paperTradeHandler(
  options: PaperTradeOptions,
): Promise<void> {
  const csvPath = resolve(options.csv ?? 'scripts/data/sample-ohlcv.csv')
  const initialCash = Number(options.cash ?? 100_000)
  const dipThreshold = Number(options.dip ?? 0.03)
  const profitThreshold = Number(options.profit ?? 0.05)
  const stopLossThreshold =
    options.stopLoss === undefined ? undefined : Number(options.stopLoss)
  const maxDrawdownPct =
    options.maxDrawdown === undefined ? undefined : Number(options.maxDrawdown)
  const outputPath = options.output ? resolve(options.output) : undefined

  if (Number.isNaN(initialCash) || initialCash <= 0) {
    throw new Error(`Invalid initial cash: ${options.cash}`)
  }
  if (Number.isNaN(dipThreshold) || dipThreshold < 0) {
    throw new Error(`Invalid dip threshold: ${options.dip}`)
  }
  if (Number.isNaN(profitThreshold) || profitThreshold < 0) {
    throw new Error(`Invalid profit threshold: ${options.profit}`)
  }
  if (
    stopLossThreshold !== undefined &&
    (Number.isNaN(stopLossThreshold) || stopLossThreshold < 0)
  ) {
    throw new Error(`Invalid stop-loss threshold: ${options.stopLoss}`)
  }
  if (
    maxDrawdownPct !== undefined &&
    (Number.isNaN(maxDrawdownPct) || maxDrawdownPct < 0)
  ) {
    throw new Error(`Invalid max drawdown: ${options.maxDrawdown}`)
  }

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

  const strategy = new MomentumStrategy({
    dipThreshold,
    profitThreshold,
    stopLossThreshold,
    lotSize: 100,
  })

  const riskManager = new BasicRiskManager({
    maxCashDeployPct: 0.3,
    maxPositionValuePct: 0.6,
    maxOrdersPerDay: 2,
    maxDrawdownPct,
  })

  const result = runBacktest({
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
      const portfolio = broker.getPortfolio()
      console.log(`\n--- ${date.toISOString().slice(0, 10)} ---`)
      console.log(`Cash: ¥${portfolio.cash.toFixed(2)}`)
      console.log(
        `Positions: ${portfolio.positions.map(p => `${p.symbol}=${p.quantity}`).join(', ') || 'none'}`,
      )
      console.log(`Total value: ¥${portfolio.totalValue.toFixed(2)}`)
    },
  })

  console.log('\n--- Signals ---')
  for (const signal of result.signals) {
    console.log(
      `${signal.symbol}: ${signal.side.toUpperCase()} ${signal.quantity} shares — ${signal.reason}`,
    )
  }

  const stats = broker.getStats()
  console.log('\n--- Trading statistics ---')
  console.log(`Symbols: ${feed.symbols.join(', ')}`)
  console.log(`Total turnover: ¥${stats.totalTurnover.toFixed(2)}`)
  console.log(`Total fees: ¥${stats.totalFees.toFixed(2)}`)
  console.log(`Total return: ${(result.totalReturnPct * 100).toFixed(2)}%`)
  console.log(
    `Benchmark return: ${(result.benchmarkReturnPct * 100).toFixed(2)}%`,
  )
  console.log(`Max drawdown: ${(result.maxDrawdownPct * 100).toFixed(2)}%`)
  console.log(`Sharpe ratio: ${result.sharpeRatio.toFixed(3)}`)
  console.log(`Win rate: ${(result.winRatePct * 100).toFixed(2)}%`)
  console.log(`Total trades: ${result.totalTrades}`)

  console.log('\n--- Equity curve ---')
  for (const point of result.equityCurve) {
    console.log(
      `${point.timestamp.toISOString().slice(0, 10)}: ¥${point.totalValue.toFixed(2)}`,
    )
  }

  console.log('\n--- Closed trades ---')
  for (const trade of result.trades) {
    console.log(
      `${trade.timestamp.toISOString().slice(0, 10)} ${trade.symbol}: ${trade.side.toUpperCase()} ${trade.quantity} @ ¥${trade.price.toFixed(2)} P&L ¥${trade.pnl.toFixed(2)}`,
    )
  }

  console.log('\n--- Final orders ---')
  for (const order of broker.getOrders()) {
    console.log(
      `${order.id}: ${order.side} ${order.quantity} ${order.symbol} @ ${order.status}${order.fee ? ` (fee ¥${order.fee.toFixed(2)})` : ''}${order.rejectReason ? ` (${order.rejectReason})` : ''}`,
    )
  }

  if (outputPath) {
    exportBacktestResult(result, outputPath)
    console.log(`\nBacktest result exported to ${outputPath}`)
  }
}
