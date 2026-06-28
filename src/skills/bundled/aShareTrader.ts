import { AGENT_TOOL_NAME } from '@claude-code-best/builtin-tools/tools/AgentTool/constants.js'
import {
  CRON_CREATE_TOOL_NAME,
  DEFAULT_MAX_AGE_DAYS,
  isKairosCronEnabled,
} from '@claude-code-best/builtin-tools/tools/ScheduleCronTool/prompt.js'
import { registerBundledSkill } from '../bundledSkills.js'

const A_SHARE_TRADER_AGENT_TYPE = 'a-share-trader'

function parseInterval(token: string): string | null {
  const match = token.match(/^(\d+)([smhd])$/)
  if (!match) return null
  const value = Number.parseInt(match[1]!, 10)
  const unit = match[2]!

  if (unit === 's') {
    const minutes = Math.max(1, Math.ceil(value / 60))
    return `*/${minutes} * * * *`
  }
  if (unit === 'm') {
    if (value <= 59) return `*/${value} * * * *`
    const hours = value / 60
    if (Number.isInteger(hours) && hours <= 23) return `0 */${hours} * * *`
    return `0 */${Math.min(23, Math.round(hours))} * * *`
  }
  if (unit === 'h') {
    if (value <= 23) return `0 */${value} * * *`
    return `0 0 * * *`
  }
  // unit === 'd'
  return `0 0 */${value} * *`
}

function extractCsvAndInterval(args: string): {
  csv: string
  interval: string
  remaining: string
} {
  const tokens = args.trim().split(/\s+/)
  let interval = '1d'
  let csvIndex = 0

  if (tokens[0] && parseInterval(tokens[0]!) !== null) {
    interval = tokens[0]!
    csvIndex = 1
  } else if (
    tokens.length >= 2 &&
    parseInterval(tokens[tokens.length - 1]!) !== null
  ) {
    interval = tokens[tokens.length - 1]!
    tokens.pop()
  }

  const csv = tokens.slice(csvIndex).join(' ').trim()
  const remaining = tokens
    .slice(csvIndex + 1)
    .join(' ')
    .trim()
  return { csv, interval, remaining }
}

function buildBacktestPrompt(csv: string, extra: string): string {
  return `Run a professional A-share paper-trading backtest on ${csv}.

Steps:
1. Use MarketDataSummary to inspect the CSV feed.
2. Use PaperTrade to run the backtest with ${extra || 'sensible defaults (¥100,000 cash, 3% dip entry, 5% profit exit, optional stop-loss)'}.
3. Read any relevant trading-operations knowledge-base playbooks.
4. Analyze the metrics (total return, benchmark, max drawdown, Sharpe, win rate, trade count) and explain them concisely.
5. Write a decision log to docs/knowledge-base/trading-operations/decisions/YYYY-MM-DD-a-share-backtest.md with frontmatter and lessons learned.
6. Return a concise summary to the user.`
}

function buildTradePrompt(csv: string, extra: string): string {
  return `Run an AI-driven A-share paper-trading session on the latest available day in ${csv}.

Steps:
1. Use MarketDataSummary to inspect the CSV feed.
2. Use PaperTrade to run the backtest through the full date range so you can see the strategy behavior, or reason directly about the latest day if you prefer.
3. Produce a buy/sell/hold signal for the latest day for each symbol, with a clear rationale.
4. Write a decision log to docs/knowledge-base/trading-operations/decisions/YYYY-MM-DD-<symbol>.md with frontmatter (date, symbols, signals, final value, total return) and a lessons-learned section.
5. Return the signals and the final portfolio value to the user.

${extra || ''}`
}

function buildLoopPrompt(args: string): string {
  const { csv, interval, remaining } = extractCsvAndInterval(args)
  if (!csv) {
    return `Usage: /a-share-loop [interval] <csv-path>

Schedule recurring A-share paper-trading analysis.

Examples:
  /a-share-loop 1d scripts/data/sample-ohlcv.csv
  /a-share-loop 4h scripts/data/sample-ohlcv.csv
  /a-share-loop scripts/data/sample-ohlcv.csv        (defaults to 1d)`
  }

  const cron = parseInterval(interval)
  if (!cron) {
    return `Invalid interval "${interval}". Use Ns, Nm, Nh, or Nd (e.g. 1d, 4h, 30m).`
  }

  return `Schedule a recurring A-share paper-trading session.

1. Call ${CRON_CREATE_TOOL_NAME} with:
   - cron: "${cron}"
   - prompt: "/a-share-trade ${csv}${remaining ? ` ${remaining}` : ''}"
   - recurring: true
2. Confirm the schedule, cron expression, and auto-expiry after ${DEFAULT_MAX_AGE_DAYS} days.
3. Then immediately run "/a-share-trade ${csv}" once so the user sees the first result now.`
}

export function registerAShareTraderSkills(): void {
  registerBundledSkill({
    name: 'a-share-backtest',
    description:
      'Run and analyze an A-share paper-trading backtest on a CSV OHLCV file',
    argumentHint: '<csv-path> [extra parameters]',
    userInvocable: true,
    agent: A_SHARE_TRADER_AGENT_TYPE,
    allowedTools: [
      AGENT_TOOL_NAME,
      'paper_trade',
      'market_data_summary',
      'Read',
      'Write',
      'Glob',
      'Grep',
      'TaskCreate',
    ],
    async getPromptForCommand(args) {
      const trimmed = args.trim()
      if (!trimmed) {
        return [
          {
            type: 'text',
            text: 'Usage: /a-share-backtest <csv-path> [extra parameters]',
          },
        ]
      }
      const [csv, ...extraTokens] = trimmed.split(/\s+/)
      const extra = extraTokens.join(' ')
      return [{ type: 'text', text: buildBacktestPrompt(csv!, extra) }]
    },
  })

  registerBundledSkill({
    name: 'a-share-trade',
    description:
      'Run an AI-driven A-share paper-trading session on the latest day of a CSV OHLCV file',
    argumentHint: '<csv-path> [extra parameters]',
    userInvocable: true,
    agent: A_SHARE_TRADER_AGENT_TYPE,
    allowedTools: [
      AGENT_TOOL_NAME,
      'paper_trade',
      'market_data_summary',
      'Read',
      'Write',
      'Glob',
      'Grep',
      'TaskCreate',
    ],
    async getPromptForCommand(args) {
      const trimmed = args.trim()
      if (!trimmed) {
        return [
          {
            type: 'text',
            text: 'Usage: /a-share-trade <csv-path> [extra parameters]',
          },
        ]
      }
      const [csv, ...extraTokens] = trimmed.split(/\s+/)
      const extra = extraTokens.join(' ')
      return [{ type: 'text', text: buildTradePrompt(csv!, extra) }]
    },
  })

  registerBundledSkill({
    name: 'a-share-loop',
    description:
      'Schedule recurring A-share paper-trading analysis on a CSV OHLCV file',
    argumentHint: '[interval] <csv-path>',
    userInvocable: true,
    isEnabled: isKairosCronEnabled,
    allowedTools: [
      CRON_CREATE_TOOL_NAME,
      'Skill',
      AGENT_TOOL_NAME,
      'paper_trade',
      'market_data_summary',
      'Read',
      'Write',
      'Glob',
      'Grep',
    ],
    async getPromptForCommand(args) {
      return [{ type: 'text', text: buildLoopPrompt(args) }]
    },
  })
}
