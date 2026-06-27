import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

let isFirstPartyBaseUrl = true

// Only mock the external dependency that controls adapter selection
mock.module('src/utils/model/providers.js', () => ({
  isFirstPartyAnthropicBaseUrl: () => isFirstPartyBaseUrl,
  getAPIProvider: () => 'firstParty',
  getAPIProviderForStatsig: () => 'firstParty',
}))

const { createAdapter } = await import('../adapters/index')

const originalWebSearchAdapter = process.env.WEB_SEARCH_ADAPTER
const THIRD_PARTY_ENVS = [
  'CLAUDE_CODE_USE_OPENAI',
  'CLAUDE_CODE_USE_GEMINI',
  'CLAUDE_CODE_USE_GROK',
] as const
const originalThirdParty = Object.fromEntries(
  THIRD_PARTY_ENVS.map(k => [k, process.env[k]] as const),
)

beforeEach(() => {
  // Ensure third-party provider flags do not force the Bing fallback
  // while these unit tests are exercising adapter selection logic.
  for (const k of THIRD_PARTY_ENVS) {
    delete process.env[k]
  }
})

afterEach(() => {
  isFirstPartyBaseUrl = true

  if (originalWebSearchAdapter === undefined) {
    delete process.env.WEB_SEARCH_ADAPTER
  } else {
    process.env.WEB_SEARCH_ADAPTER = originalWebSearchAdapter
  }

  for (const k of THIRD_PARTY_ENVS) {
    if (originalThirdParty[k] === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = originalThirdParty[k]
    }
  }
})

describe('createAdapter', () => {
  test('reuses the same instance when the selected backend does not change', () => {
    process.env.WEB_SEARCH_ADAPTER = 'brave'

    const firstAdapter = createAdapter()
    const secondAdapter = createAdapter()

    expect(firstAdapter).toBe(secondAdapter)
    expect(firstAdapter.constructor.name).toBe('BraveSearchAdapter')
  })

  test('rebuilds the adapter when WEB_SEARCH_ADAPTER changes', () => {
    process.env.WEB_SEARCH_ADAPTER = 'brave'
    const braveAdapter = createAdapter()

    process.env.WEB_SEARCH_ADAPTER = 'bing'
    const bingAdapter = createAdapter()

    expect(bingAdapter).not.toBe(braveAdapter)
    expect(bingAdapter.constructor.name).toBe('BingSearchAdapter')
  })

  test('selects the API adapter for first-party Anthropic URLs', () => {
    delete process.env.WEB_SEARCH_ADAPTER
    isFirstPartyBaseUrl = true

    expect(createAdapter().constructor.name).toBe('ApiSearchAdapter')
  })

  test('selects the Exa adapter for third-party Anthropic base URLs', () => {
    delete process.env.WEB_SEARCH_ADAPTER
    isFirstPartyBaseUrl = false

    expect(createAdapter().constructor.name).toBe('ExaSearchAdapter')
  })
})
