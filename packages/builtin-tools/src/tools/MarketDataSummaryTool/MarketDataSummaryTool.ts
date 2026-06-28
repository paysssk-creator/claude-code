import { resolve } from 'node:path'
import { z } from 'zod/v4'
import type { ValidationResult } from 'src/Tool.js'
import { buildTool, type ToolDef } from 'src/Tool.js'
import { loadCsvDataFeed } from 'src/services/paperTrading/index.js'
import { expandPath } from 'src/utils/path.js'
import { lazySchema } from 'src/utils/lazySchema.js'
import { MARKET_DATA_SUMMARY_TOOL_NAME } from './constants.js'
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
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    symbols: z.array(z.string()).describe('Symbols included in the feed'),
    startDate: z.string().describe('First date in the feed (ISO 8601)'),
    endDate: z.string().describe('Last date in the feed (ISO 8601)'),
    totalRows: z.number().describe('Total number of OHLCV rows'),
    rowsPerSymbol: z
      .record(z.string(), z.number())
      .describe('Number of rows for each symbol'),
    latestClose: z
      .record(z.string(), z.number())
      .describe('Latest close price for each symbol'),
    highLowRange: z
      .record(
        z.string(),
        z.object({
          high: z.number(),
          low: z.number(),
        }),
      )
      .describe('High/low range across the entire feed for each symbol'),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

export const MarketDataSummaryTool = buildTool({
  name: MARKET_DATA_SUMMARY_TOOL_NAME,
  searchHint: 'summarize A-share CSV OHLCV market data feed',
  maxResultSizeChars: 50_000,
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
  isReadOnly() {
    return true
  },
  toAutoClassifierInput(input) {
    return `market data summary ${input.csv}`
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
  async call({ csv }) {
    const csvPath = resolve(expandPath(csv))
    const feed = loadCsvDataFeed(csvPath)

    const rowsPerSymbol: Record<string, number> = {}
    const latestClose: Record<string, number> = {}
    const highLowRange: Record<string, { high: number; low: number }> = {}

    for (const symbol of feed.symbols) {
      let rows = 0
      let high = Number.NEGATIVE_INFINITY
      let low = Number.POSITIVE_INFINITY
      let lastClose = 0

      for (const date of feed.dates) {
        const data = feed.get(date, symbol)
        if (!data) continue
        rows++
        high = Math.max(high, data.high)
        low = Math.min(low, data.low)
        lastClose = data.close
      }

      rowsPerSymbol[symbol] = rows
      latestClose[symbol] = lastClose
      highLowRange[symbol] = { high, low }
    }

    return {
      data: {
        symbols: feed.symbols,
        startDate: feed.dates[0]?.toISOString() ?? '',
        endDate: feed.dates.at(-1)?.toISOString() ?? '',
        totalRows: feed.dates.length * feed.symbols.length,
        rowsPerSymbol,
        latestClose,
        highLowRange,
      },
    }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    const lines = [
      `Market data summary: ${output.symbols.join(', ')}`,
      `Period: ${output.startDate.slice(0, 10)} → ${output.endDate.slice(0, 10)}`,
      `Symbols: ${output.symbols.join(', ')}`,
      `Total rows: ${output.totalRows}`,
    ]
    for (const symbol of output.symbols) {
      const rows = output.rowsPerSymbol[symbol] ?? 0
      const close = output.latestClose[symbol] ?? 0
      const range = output.highLowRange[symbol] ?? { high: 0, low: 0 }
      lines.push(
        `${symbol}: ${rows} rows, latest close ¥${close.toFixed(2)}, range ¥${range.low.toFixed(2)} - ¥${range.high.toFixed(2)}`,
      )
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: lines.join('\n'),
    }
  },
} satisfies ToolDef<InputSchema, Output>)
