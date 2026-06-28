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

  test('includes a-share-desktop-trader agent with computer-use tools', () => {
    const agents = getBuiltInAgents()
    const desktop = agents.find(a => a.agentType === 'a-share-desktop-trader')
    expect(desktop).toBeDefined()
    expect(desktop?.tools).toContain('mcp__computer-use__screenshot')
    expect(desktop?.tools).toContain('mcp__computer-use__request_access')
    expect(desktop?.tools).toContain('mcp__computer-use__bind_window')
  })
})
