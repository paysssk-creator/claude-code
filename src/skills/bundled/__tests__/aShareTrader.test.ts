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

  test('registers a-share-backtest, a-share-trade, and a-share-loop skills', () => {
    const skills = getBundledSkills()
    const names = skills.map(s => s.name)
    expect(names).toContain('a-share-backtest')
    expect(names).toContain('a-share-trade')
    expect(names).toContain('a-share-loop')
  })

  test('a-share-backtest uses the a-share-trader agent', () => {
    const backtest = getPromptSkill('a-share-backtest')
    expect(backtest?.agent).toBe('a-share-trader')
  })

  test('a-share-loop prompts include usage when no args given', async () => {
    const loop = getPromptSkill('a-share-loop')
    const prompt = await loop?.getPromptForCommand('', {} as never)
    expect(prompt?.[0]?.type).toBe('text')
    expect((prompt?.[0] as { text: string }).text).toContain('Usage:')
  })
})
