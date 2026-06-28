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

  test('registers a-share-backtest, a-share-trade, a-share-loop, and a-share-desktop-trade skills', () => {
    const skills = getBundledSkills()
    const names = skills.map(s => s.name)
    expect(names).toContain('a-share-backtest')
    expect(names).toContain('a-share-trade')
    expect(names).toContain('a-share-loop')
    expect(names).toContain('a-share-desktop-trade')
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
})
