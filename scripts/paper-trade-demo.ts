#!/usr/bin/env bun
/**
 * A-share paper trading demo
 *
 * Runs a simulated trading session with mock market data.
 * No real account, no real money, no live orders.
 */

import {
  AShareFeeModel,
  BasicRiskManager,
  MomentumStrategy,
  PaperBroker,
  makeAshareMarketData,
  runBacktest,
} from '../src/services/paperTrading/index.js'

const symbols = ['000001', '000002']
const days = 6
const dates = Array.from(
  { length: days },
  (_, i) => new Date(Date.now() + (i + 1) * 86_400_000),
)

const closingPrices = new Map<string, number[]>([
  ['000001', [10, 9.5, 9.6, 9.7, 10.5, 10.5]],
  ['000002', [20, 19, 19.2, 19.4, 21, 21]],
])

const broker = new PaperBroker({
  initialCash: 100_000,
  marketData: new Map(
    symbols.map(symbol => [
      symbol,
      makeAshareMarketData(symbol, closingPrices.get(symbol)![0]!, {
        timestamp: dates[0],
      }),
    ]),
  ),
  enforceT1: true,
  feeModel: new AShareFeeModel(),
})

const strategy = new MomentumStrategy({
  dipThreshold: 0.03,
  profitThreshold: 0.05,
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
  symbols,
  dates,
  riskManager,
  updateMarketData: (date, symbol) => {
    const dayIndex = dates.findIndex(
      d => d.toISOString().slice(0, 10) === date.toISOString().slice(0, 10),
    )
    const close = closingPrices.get(symbol)![dayIndex]!
    const data = makeAshareMarketData(symbol, close, { timestamp: date })
    broker.setMarketData(symbol, data)
    return data
  },
  onDayEnd: (b, date) => {
    b.recordEquity(date)
    const portfolio = b.getPortfolio()
    console.log(`\n--- Day ${date.toISOString().slice(0, 10)} ---`)
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
