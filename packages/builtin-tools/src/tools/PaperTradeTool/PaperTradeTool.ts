import { resolve } from 'node:path'
import { z } from 'zod/v4'
import type { ValidationResult } from 'src/Tool.js'
import { buildTool, type ToolDef } from 'src/Tool.js'
import {
  AShareFeeModel,
  BasicRiskManager,
  MomentumStrategy,
  PaperBroker,
  loadCsvDataFeed,
  runBacktest,
} from 'src/services/paperTrading/index.js'
import type { MarketData } from 'src/services/paperTrading/types.js'
import { expandPath } from 'src/utils/path.js'
import { lazySchema } from 'src/utils/lazySchema.js'
import { PAPER_TRADE_TOOL_NAME } from './constants.js'
import { DESCRIPTION, PROMPT } from './prompt.js'
import {
  renderToolResultMessage,
  renderToolUseErrorMessage,
  renderToolUseMessage,
  userFacingName,
} from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    csv: z
      .string()
      .describe(
        'Absolute path to the CSV file containing symbol,date,open,high,low,close,volume columns',
      ),
    cash: z
      .number()
      .optional()
      .describe('Initial cash in CNY. Default: 100000'),
    dip: z
      .number()
      .optional()
      .describe(
        'Momentum buy threshold as a fraction dip from previous close. Default: 0.03',
      ),
    profit: z
      .number()
      .optional()
      .describe(
        'Momentum take-profit threshold as a fraction gain over average cost. Default: 0.05',
      ),
    stopLoss: z
      .number()
      .optional()
      .describe(
        'Optional momentum stop-loss threshold as a fraction loss below average cost',
      ),
    maxDrawdown: z
      .number()
      .optional()
      .describe(
        'Optional risk-manager drawdown circuit breaker as a fraction of peak equity',
      ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    symbols: z.array(z.string()).describe('Symbols included in the backtest'),
    startDate: z.string().describe('First backtest date (ISO 8601)'),
    endDate: z.string().describe('Last backtest date (ISO 8601)'),
    initialCash: z.number().describe('Initial cash in CNY'),
    finalValue: z.number().describe('Final portfolio total value in CNY'),
    totalReturnPct: z.number().describe('Total return as a fraction'),
    benchmarkReturnPct: z
      .number()
      .describe('Equal-weight buy-and-hold return as a fraction'),
    maxDrawdownPct: z.number().describe('Maximum drawdown as a fraction'),
    sharpeRatio: z.number().describe('Sharpe ratio'),
    winRatePct: z.number().describe('Win rate as a fraction'),
    totalTrades: z.number().describe('Number of closed sell trades'),
    signals: z
      .array(
        z.object({
          symbol: z.string(),
          side: z.enum(['buy', 'sell']),
          quantity: z.number(),
          reason: z.string(),
        }),
      )
      .describe('Strategy signals generated during the backtest'),
    trades: z
      .array(
        z.object({
          timestamp: z.string(),
          symbol: z.string(),
          side: z.enum(['buy', 'sell']),
          quantity: z.number(),
          price: z.number(),
          pnl: z.number(),
        }),
      )
      .describe('Filled trades'),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

export const PaperTradeTool = buildTool({
  name: PAPER_TRADE_TOOL_NAME,
  searchHint: 'run A-share paper trading backtest on CSV data',
  maxResultSizeChars: 200_000,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  userFacingName,
  renderToolUseMessage,
  renderToolResultMessage,
  renderToolUseErrorMessage,
  isConcurrencySafe() {
    return true
  },
  toAutoClassifierInput(input) {
    return `paper trade ${input.csv}`
  },
  async validateInput({ csv }): Promise<ValidationResult> {
    if (!csv || typeof csv !== 'string') {
      return {
        result: false,
        message: 'Missing required parameter: csv (path to CSV file)',
        errorCode: 1,
      }
    }
    return { result: true }
  },
  async call(input) {
    const csvPath = resolve(expandPath(input.csv))
    const initialCash = input.cash ?? 100_000
    const dipThreshold = input.dip ?? 0.03
    const profitThreshold = input.profit ?? 0.05
    const stopLossThreshold = input.stopLoss
    const maxDrawdownPct = input.maxDrawdown

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

    const result = await runBacktest({
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
    })

    const portfolio = broker.getPortfolio()

    return {
      data: {
        symbols: feed.symbols,
        startDate: feed.dates[0]?.toISOString() ?? '',
        endDate: feed.dates.at(-1)?.toISOString() ?? '',
        initialCash,
        finalValue: portfolio.totalValue,
        totalReturnPct: result.totalReturnPct,
        benchmarkReturnPct: result.benchmarkReturnPct,
        maxDrawdownPct: result.maxDrawdownPct,
        sharpeRatio: result.sharpeRatio,
        winRatePct: result.winRatePct,
        totalTrades: result.totalTrades,
        signals: result.signals.map(signal => ({
          symbol: signal.symbol,
          side: signal.side,
          quantity: signal.quantity,
          reason: signal.reason,
        })),
        trades: result.trades.map(trade => ({
          timestamp: trade.timestamp.toISOString(),
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          price: trade.price,
          pnl: trade.pnl,
        })),
      },
    }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    const lines = [
      `Paper-trade backtest complete: ${output.symbols.join(', ')}`,
      `Period: ${output.startDate.slice(0, 10)} → ${output.endDate.slice(0, 10)}`,
      `Initial cash: ¥${output.initialCash.toFixed(2)}`,
      `Final value: ¥${output.finalValue.toFixed(2)}`,
      `Total return: ${(output.totalReturnPct * 100).toFixed(2)}%`,
      `Benchmark return: ${(output.benchmarkReturnPct * 100).toFixed(2)}%`,
      `Max drawdown: ${(output.maxDrawdownPct * 100).toFixed(2)}%`,
      `Sharpe ratio: ${output.sharpeRatio.toFixed(3)}`,
      `Win rate: ${(output.winRatePct * 100).toFixed(2)}%`,
      `Total trades: ${output.totalTrades}`,
      `Signals: ${output.signals.length}`,
    ]
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: lines.join('\n'),
    }
  },
} satisfies ToolDef<InputSchema, Output>)
