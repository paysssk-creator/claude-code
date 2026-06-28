import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import type { StrategySignal } from '../types.js'

export interface DecisionRecord {
  date: string
  symbols: string[]
  signals: StrategySignal[]
  finalValue: number
  totalReturnPct: number
  rationale: string
  lessons: string
}

function getDecisionDir(): string {
  return join(
    process.cwd(),
    'docs',
    'knowledge-base',
    'trading-operations',
    'decisions',
  )
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

export function decisionFilePath(record: DecisionRecord): string {
  const symbolSuffix =
    record.symbols.length > 0
      ? `-${sanitizeFilename(record.symbols.join('-'))}`
      : ''
  const dir = getDecisionDir()
  return join(dir, `${record.date}${symbolSuffix}.md`)
}

export function recordDecision(record: DecisionRecord): string {
  const path = decisionFilePath(record)
  ensureDir(dirname(path))

  const frontmatter = `---
date: ${record.date}
symbols: [${record.symbols.map(s => `"${s}"`).join(', ')}]
finalValue: ${record.finalValue.toFixed(2)}
totalReturnPct: ${(record.totalReturnPct * 100).toFixed(2)}
---

# Trading Decision Log — ${record.date}

## Signals

${
  record.signals.length === 0
    ? '_No signals generated._'
    : record.signals
        .map(
          s =>
            `- **${s.symbol}**: ${s.side.toUpperCase()} ${s.quantity} shares — ${s.reason}`,
        )
        .join('\n')
}

## Rationale

${record.rationale}

## Lessons Learned

${record.lessons}
`

  writeFileSync(path, frontmatter, 'utf-8')
  return path
}

export function loadRecentDecisions(limit = 5): DecisionRecord[] {
  const dir = getDecisionDir()
  if (!existsSync(dir)) return []

  const files = readdirSync(dir)
    .filter(name => name.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, limit)

  return files.map(file => {
    const content = readFileSync(join(dir, file), 'utf-8')
    return parseDecisionContent(content)
  })
}

function parseDecisionContent(content: string): DecisionRecord {
  const frontmatterMatch = content.match(/---\n([\s\S]*?)\n---\n([\s\S]*)/)
  const meta: Record<string, string> = {}
  let body = content

  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1]!
    body = frontmatterMatch[2]!
    for (const line of frontmatter.split('\n')) {
      const [key, ...rest] = line.split(':')
      if (key && rest.length > 0) {
        meta[key.trim()] = rest.join(':').trim()
      }
    }
  }

  const symbolsMatch = meta.symbols?.match(/\[([^\]]*)\]/)
  const symbols = symbolsMatch
    ? symbolsMatch[1]!
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    : []

  const signals: StrategySignal[] = []
  const signalMatch = body.match(/## Signals\n\n([\s\S]*?)\n## Rationale/)
  if (signalMatch) {
    for (const line of signalMatch[1]!.split('\n')) {
      const match = line.match(
        /^-\s+\*\*(\w+)\*\*:\s+(BUY|SELL)\s+(\d+)\s+shares\s+—\s+(.*)$/,
      )
      if (match) {
        signals.push({
          symbol: match[1]!,
          side: match[2]!.toLowerCase() as 'buy' | 'sell',
          quantity: Number.parseInt(match[3]!, 10),
          reason: match[4]!,
        })
      }
    }
  }

  const rationaleMatch = body.match(
    /## Rationale\n\n([\s\S]*?)\n## Lessons Learned/,
  )
  const lessonsMatch = body.match(/## Lessons Learned\n\n([\s\S]*)$/)

  return {
    date: meta.date ?? '',
    symbols,
    signals,
    finalValue: Number.parseFloat(meta.finalValue ?? '0'),
    totalReturnPct: Number.parseFloat(meta.totalReturnPct ?? '0') / 100,
    rationale: rationaleMatch?.[1]?.trim() ?? '',
    lessons: lessonsMatch?.[1]?.trim() ?? '',
  }
}
