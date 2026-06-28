import { AGENT_TOOL_NAME } from '@claude-code-best/builtin-tools/tools/AgentTool/constants.js'
import {
  CRON_CREATE_TOOL_NAME,
  DEFAULT_MAX_AGE_DAYS,
  isKairosCronEnabled,
} from '@claude-code-best/builtin-tools/tools/ScheduleCronTool/prompt.js'
import { registerBundledSkill } from '../bundledSkills.js'

const A_SHARE_TRADER_AGENT_TYPE = 'a-share-trader'
const A_SHARE_DESKTOP_TRADER_AGENT_TYPE = 'a-share-desktop-trader'

const CU_TOOLS = [
  'mcp__computer-use__request_access',
  'mcp__computer-use__screenshot',
  'mcp__computer-use__bind_window',
  'mcp__computer-use__open_application',
  'mcp__computer-use__virtual_mouse',
  'mcp__computer-use__virtual_keyboard',
  'mcp__computer-use__computer_batch',
  'mcp__computer-use__window_management',
  'mcp__computer-use__read_clipboard',
  'mcp__computer-use__write_clipboard',
]

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

function buildDesktopTradePrompt(args: string): string {
  const tokens = args.trim().split(/\s+/)
  if (tokens.length === 0 || !tokens[0]) {
    return `Usage: /a-share-desktop-trade <app> [symbols...]

Operate a Chinese retail trading desktop application in paper/simulation mode.

Supported apps: ths (同花顺), eastmoney (东方财富)
Examples:
  /a-share-desktop-trade ths 000001 600519
  /a-share-desktop-trade eastmoney 000001

For non-interactive/headless runs, invoke the CLI with --load-computer-use-mcp (and --enable-auto-mode or --permission-mode bypassPermissions only if the user has pre-approved unattended execution).`
  }

  const [app, ...symbols] = tokens
  return `Run a desktop A-share paper-trading session via ${app}.

Steps:
1. Read docs/knowledge-base/computer-use/00-overview.md and 01-screenshot-observe.md.
2. Read docs/knowledge-base/trading-operations/05-autonomous-trading.md.
3. Use computer-use tools directly. Do NOT use Bash to search for the executable path.
   - Call mcp__computer-use__request_access for ${app}.
   - Call mcp__computer-use__bind_window action=list. If ${app} is already running, bind to the existing main terminal window (e.g. "同花顺(9.60.20) - 首页"). Avoid auxiliary windows such as "问财AI助手", login dialogs, or update popups.
   - Only call mcp__computer-use__open_application if no matching window exists.
   - If open_application fails with LAUNCH_FAILED, the app is already running; list windows again and bind.
   - Then navigate to paper trading (模拟炒股 / 模拟交易).
4. Read the paper portfolio and market data for: ${symbols.join(' ') || '(none specified)'}. If no symbols are given, use the app's current watchlist.
5. Generate buy/sell/hold signals, execute paper orders, and screenshot confirmations.
6. Write a decision log to docs/knowledge-base/trading-operations/decisions/YYYY-MM-DD-<symbols>.md.
7. Unbind the window and report results.

Safety: stop immediately if a real-money account flow (实盘交易, 真实账户, 资金账号) is detected.

Headless note: when this session was launched with --print or by cron, include --load-computer-use-mcp on the CLI. With --permission-mode bypassPermissions or --enable-auto-mode, permission is auto-granted headlessly; do NOT ask the user, just call request_access and proceed.`
}

function extractIntervalAndApp(args: string): {
  interval: string
  app: string
  symbols: string[]
} {
  const tokens = args.trim().split(/\s+/)
  let interval = '1d'
  let appIndex = 0

  if (tokens[0] && parseInterval(tokens[0]!) !== null) {
    interval = tokens[0]!
    appIndex = 1
  }

  const app = tokens[appIndex] ?? ''
  const symbols = tokens.slice(appIndex + 1)
  return { interval, app, symbols }
}

function buildDesktopLoopPrompt(args: string): string {
  const { interval, app, symbols } = extractIntervalAndApp(args)
  if (!app) {
    return `Usage: /a-share-desktop-loop [interval] <app> [symbols...]

Schedule recurring A-share desktop paper-trading sessions.

Examples:
  /a-share-desktop-loop 1d ths 000001 600519
  /a-share-desktop-loop 4h eastmoney 000001
  /a-share-desktop-loop ths 000001        (defaults to 1d)`
  }

  const cron = parseInterval(interval)
  if (!cron) {
    return `Invalid interval "${interval}". Use Ns, Nm, Nh, or Nd (e.g. 1d, 4h, 30m).`
  }

  const symbolPart = symbols.length > 0 ? ` ${symbols.join(' ')}` : ''
  const invocation = `/a-share-desktop-trade ${app}${symbolPart}`

  return `Schedule recurring A-share desktop paper-trading sessions.

1. Call ${CRON_CREATE_TOOL_NAME} with:
   - cron: "${cron}"
   - prompt: "${invocation}"
   - recurring: true
2. Confirm the schedule, cron expression, and auto-expiry after ${DEFAULT_MAX_AGE_DAYS} days.
3. Then immediately run "${invocation}" once so the user sees the first result now.`
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
    name: 'a-share-desktop-trade',
    description:
      'Operate a Chinese retail trading desktop app in paper/simulation mode and execute A-share paper trades',
    argumentHint: '<app> [symbols...]',
    userInvocable: true,
    agent: A_SHARE_DESKTOP_TRADER_AGENT_TYPE,
    allowedTools: [
      AGENT_TOOL_NAME,
      'Read',
      'Write',
      'Glob',
      'Grep',
      'TaskCreate',
      ...CU_TOOLS,
    ],
    async getPromptForCommand(args) {
      return [{ type: 'text', text: buildDesktopTradePrompt(args) }]
    },
  })

  registerBundledSkill({
    name: 'a-share-desktop-loop',
    description:
      'Schedule recurring A-share desktop paper-trading sessions via a Chinese retail trading app',
    argumentHint: '[interval] <app> [symbols...]',
    userInvocable: true,
    isEnabled: isKairosCronEnabled,
    agent: A_SHARE_DESKTOP_TRADER_AGENT_TYPE,
    allowedTools: [
      CRON_CREATE_TOOL_NAME,
      'Skill',
      AGENT_TOOL_NAME,
      'Read',
      'Write',
      'Glob',
      'Grep',
      'TaskCreate',
    ],
    async getPromptForCommand(args) {
      return [{ type: 'text', text: buildDesktopLoopPrompt(args) }]
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
