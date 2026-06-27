import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type {
  SecureStorage,
  SecureStorageData,
} from '../secureStorage/types.js'

function createInMemoryStorage(): SecureStorage {
  let data: SecureStorageData | null = null
  return {
    name: 'memory',
    read() {
      return data
    },
    async readAsync() {
      return data
    },
    update(next) {
      data = next
      return { success: true }
    },
    delete() {
      data = null
      return true
    },
  }
}

describe('apiKeyManager', () => {
  let storage: SecureStorage

  beforeEach(() => {
    storage = createInMemoryStorage()
    mock.module('src/utils/secureStorage/index.js', () => ({
      getSecureStorage: () => storage,
    }))

    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.GROK_API_KEY
  })

  test('providerToEnvVar maps supported providers', async () => {
    const { providerToEnvVar } = await import('../apiKeyManager.js')
    expect(providerToEnvVar('anthropic')).toBe('ANTHROPIC_API_KEY')
    expect(providerToEnvVar('openai')).toBe('OPENAI_API_KEY')
    expect(providerToEnvVar('gemini')).toBe('GEMINI_API_KEY')
    expect(providerToEnvVar('grok')).toBe('GROK_API_KEY')
    expect(providerToEnvVar('xai')).toBe('GROK_API_KEY')
    expect(providerToEnvVar('unknown')).toBeNull()
  })

  test('setApiKey stores and getApiKey retrieves', async () => {
    const { setApiKey, getApiKey } = await import('../apiKeyManager.js')
    const result = setApiKey('anthropic', 'sk-ant-test01')
    expect(result.success).toBe(true)
    expect(getApiKey('anthropic')).toBe('sk-ant-test01')
  })

  test('setApiKey trims whitespace', async () => {
    const { setApiKey, getApiKey } = await import('../apiKeyManager.js')
    setApiKey('openai', '  sk-openai-test  ')
    expect(getApiKey('openai')).toBe('sk-openai-test')
  })

  test('setApiKey rejects unsupported provider', async () => {
    const { setApiKey } = await import('../apiKeyManager.js')
    const result = setApiKey('unknown', 'key')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsupported provider')
  })

  test('setApiKey rejects empty key', async () => {
    const { setApiKey } = await import('../apiKeyManager.js')
    const result = setApiKey('anthropic', '   ')
    expect(result.success).toBe(false)
    expect(result.error).toContain('empty')
  })

  test('removeApiKey deletes only the targeted key', async () => {
    const { setApiKey, getApiKey, removeApiKey } = await import(
      '../apiKeyManager.js'
    )
    setApiKey('anthropic', 'sk-ant-test01')
    setApiKey('openai', 'sk-openai-test')

    expect(removeApiKey('anthropic')).toBe(true)
    expect(getApiKey('anthropic')).toBeNull()
    expect(getApiKey('openai')).toBe('sk-openai-test')
  })

  test('listStoredApiKeys reports configured status', async () => {
    const { setApiKey, listStoredApiKeys } = await import('../apiKeyManager.js')
    setApiKey('gemini', 'gemini-key')

    const list = listStoredApiKeys()
    expect(list).toHaveLength(4)
    expect(list.find(k => k.provider === 'gemini')?.configured).toBe(true)
    expect(list.find(k => k.provider === 'anthropic')?.configured).toBe(false)
  })

  test('loadStoredApiKeysIntoEnv injects missing keys', async () => {
    const { setApiKey, loadStoredApiKeysIntoEnv } = await import(
      '../apiKeyManager.js'
    )
    setApiKey('anthropic', 'sk-ant-injected')
    setApiKey('openai', 'sk-openai-injected')

    loadStoredApiKeysIntoEnv()
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-injected')
    expect(process.env.OPENAI_API_KEY).toBe('sk-openai-injected')
  })

  test('loadStoredApiKeysIntoEnv does not overwrite existing env vars', async () => {
    const { setApiKey, loadStoredApiKeysIntoEnv } = await import(
      '../apiKeyManager.js'
    )
    process.env.ANTHROPIC_API_KEY = 'existing-key'
    setApiKey('anthropic', 'stored-key')

    loadStoredApiKeysIntoEnv()
    expect(process.env.ANTHROPIC_API_KEY).toBe('existing-key')
  })

  test('maskKey masks middle of long keys', () => {
    // maskKey is pure; safe to import statically at top
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { maskKey } = require('../apiKeyManager.js')
    expect(maskKey('sk-ant-abcdef1234')).toBe('sk-a...1234')
  })

  test('maskKey masks short keys entirely', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { maskKey } = require('../apiKeyManager.js')
    expect(maskKey('short')).toBe('*****')
  })
})
