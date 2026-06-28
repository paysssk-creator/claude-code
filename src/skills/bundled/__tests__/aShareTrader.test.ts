import { beforeEach, describe, expect, test } from 'bun:test'
import type { PromptCommand } from '../../../types/command.js'
import { getBundledSkills, clearBundledSkills } from '../../bundledSkills.js'
import { registerAShareTraderSkills } from '../aShareTrader.js'

function getPromptSkill(name: string): PromptCommand | undefined {
  const skill = getBundledSkills().find(s => s.name === name)
  if (!skill || skill.type !== 'prompt') return undefined
  return skill as PromptCommand
}

describe('registerAShareTraderSkills', () => {
  beforeEach(() => {
    clearBundledSkills()
    registerAShareTraderSkills()
  })

  test('registers a-share-backtest, a-share-trade, a-share-loop, a-share-desktop-trade, and a-share-desktop-loop skills', () => {
    const skills = getBundledSkills()
    const names = skills.map(s => s.name)
    expect(names).toContain('a-share-backtest')
    expect(names).toContain('a-share-trade')
    expect(names).toContain('a-share-loop')
    expect(names).toContain('a-share-desktop-trade')
    expect(names).toContain('a-share-desktop-loop')
  })

  test('a-share-backtest uses the a-share-trader agent', () => {
    const backtest = getPromptSkill('a-share-backtest')
    expect(backtest?.agent).toBe('a-share-trader')
  })

  test('a-share-desktop-trade uses the a-share-desktop-trader agent', () => {
    const desktop = getPromptSkill('a-share-desktop-trade')
    expect(desktop?.agent).toBe('a-share-desktop-trader')
  })

  test('a-share-desktop-trade allows computer-use MCP tools', () => {
    const desktop = getPromptSkill('a-share-desktop-trade')
    const tools = desktop?.allowedTools ?? []
    expect(tools).toContain('mcp__computer-use__screenshot')
    expect(tools).toContain('mcp__computer-use__request_access')
    expect(tools).toContain('mcp__computer-use__bind_window')
  })

  test('a-share-loop prompts include usage when no args given', async () => {
    const loop = getPromptSkill('a-share-loop')
    const prompt = await loop?.getPromptForCommand('', {} as never)
    expect(prompt?.[0]?.type).toBe('text')
    expect((prompt?.[0] as { text: string }).text).toContain('Usage:')
  })

  test('a-share-desktop-loop schedules a desktop trade via CronCreate', async () => {
    const loop = getPromptSkill('a-share-desktop-loop')
    expect(loop?.agent).toBe('a-share-desktop-trader')
    expect(loop?.allowedTools).toContain('CronCreate')
    expect(loop?.allowedTools).toContain('Skill')
    const prompt = await loop?.getPromptForCommand(
      '1d ths 000001 600519',
      {} as never,
    )
    const text = (prompt?.[0] as { text: string }).text
    expect(text).toContain('cron: "0 0 */1 * *"')
    expect(text).toContain('/a-share-desktop-trade ths 000001 600519')
  })

  test('a-share-desktop-trade prompt mentions headless flags', async () => {
    const desktop = getPromptSkill('a-share-desktop-trade')
    const prompt = await desktop?.getPromptForCommand('ths 000001', {} as never)
    const text = (prompt?.[0] as { text: string }).text
    expect(text).toContain('--load-computer-use-mcp')
  })
})
