import { describe, expect, test } from 'bun:test'
import { getBuiltInAgents } from '../builtInAgents.js'

describe('getBuiltInAgents', () => {
  test('includes a-share-trader agent', () => {
    const agents = getBuiltInAgents()
    const trader = agents.find(a => a.agentType === 'a-share-trader')
    expect(trader).toBeDefined()
    expect(trader?.tools).toContain('paper_trade')
    expect(trader?.tools).toContain('market_data_summary')
  })
})
