#!/usr/bin/env bun
/**
 * A-share paper trading backtest from CSV historical data.
 *
 * CSV columns: symbol,date,open,high,low,close,volume
 */

import {
  AShareFeeModel,
  BasicRiskManager,
  MomentumStrategy,
  PaperBroker,
  loadCsvDataFeed,
  runBacktest,
} from '../src/services/paperTrading/index.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const csvPath = join(__dirname, 'data', 'sample-ohlcv.csv')
const feed = loadCsvDataFeed(csvPath)

const marketData = new Map<string, ReturnType<typeof feed.get>>(
  feed.symbols.map(symbol => [symbol, feed.get(feed.dates[0]!, symbol)!]),
)

const broker = new PaperBroker({
  initialCash: 100_000,
  marketData,
  enforceT1: true,
  feeModel: new AShareFeeModel(),
})

const strategy = new MomentumStrategy({
  dipThreshold: 0.03,
  profitThreshold: 0.05,
  stopLossThreshold: 0.05,
  lotSize: 100,
})

const riskManager = new BasicRiskManager({
  maxCashDeployPct: 0.3,
  maxPositionValuePct: 0.6,
  maxOrdersPerDay: 2,
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
  onDayEnd: (b, date) => {
    b.recordEquity(date)
    const portfolio = b.getPortfolio()
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
