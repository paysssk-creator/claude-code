import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import type {
  SecureStorage,
  SecureStorageData,
} from '../../../utils/secureStorage/types.js'

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

describe('keys CLI handler', () => {
  let storage: SecureStorage
  let stdoutSpy: ReturnType<typeof spyOn>
  let stderrSpy: ReturnType<typeof spyOn>
  let exitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    storage = createInMemoryStorage()
    mock.module('src/utils/secureStorage/index.js', () => ({
      getSecureStorage: () => storage,
    }))

    stdoutSpy = spyOn(process.stdout, 'write').mockImplementation(() => true)
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true)
    exitSpy = spyOn(process, 'exit').mockImplementation(
      () => undefined as never,
    )

    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.GROK_API_KEY
  })

  test('keysSetHandler stores key and exits 0', async () => {
    const { keysSetHandler } = await import('../keys.js')
    keysSetHandler('anthropic', 'sk-ant-test01')

    expect(stdoutSpy).toHaveBeenCalledWith(
      'API key for anthropic stored securely.\n',
    )
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('keysSetHandler rejects unsupported provider and exits 1', async () => {
    const { keysSetHandler } = await import('../keys.js')
    keysSetHandler('unknown', 'key')

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unsupported provider'),
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('keysGetHandler shows masked key', async () => {
    const { keysSetHandler, keysGetHandler } = await import('../keys.js')
    keysSetHandler('anthropic', 'sk-ant-test01')
    stdoutSpy.mockClear()

    keysGetHandler('anthropic')
    expect(stdoutSpy).toHaveBeenCalledWith('anthropic: sk-a...st01\n')
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('keysGetHandler shows not configured', async () => {
    const { keysGetHandler } = await import('../keys.js')
    keysGetHandler('openai')

    expect(stdoutSpy).toHaveBeenCalledWith(
      'No API key configured for openai.\n',
    )
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('keysListHandler shows configured status', async () => {
    const { keysSetHandler, keysListHandler } = await import('../keys.js')
    keysSetHandler('anthropic', 'sk-ant-test01')
    stdoutSpy.mockClear()

    keysListHandler()
    const calls = stdoutSpy.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(
      calls.some(
        (c: string) => c.includes('anthropic') && c.includes('configured'),
      ),
    ).toBe(true)
    expect(
      calls.some(
        (c: string) => c.includes('openai') && c.includes('not configured'),
      ),
    ).toBe(true)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('keysRemoveHandler removes key with --yes', async () => {
    const { keysSetHandler, keysRemoveHandler } = await import('../keys.js')
    keysSetHandler('anthropic', 'sk-ant-test01')
    stdoutSpy.mockClear()

    await keysRemoveHandler('anthropic', { yes: true })
    expect(stdoutSpy).toHaveBeenCalledWith('API key for anthropic removed.\n')
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})
