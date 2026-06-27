import { logForDebugging } from './debug.js'
import { getSecureStorage } from './secureStorage/index.js'
import type {
  ApiKeyMap,
  SecureStorageData,
  SupportedApiKeyEnvVar,
} from './secureStorage/types.js'

export const SUPPORTED_PROVIDERS = [
  'anthropic',
  'openai',
  'gemini',
  'grok',
] as const

export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number]

const PROVIDER_TO_ENV_VAR: Record<
  SupportedProvider | 'xai',
  SupportedApiKeyEnvVar
> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  grok: 'GROK_API_KEY',
  xai: 'GROK_API_KEY',
}

export function isSupportedProvider(value: string): value is SupportedProvider {
  return SUPPORTED_PROVIDERS.includes(value as SupportedProvider)
}

export function providerToEnvVar(
  provider: string,
): SupportedApiKeyEnvVar | null {
  return PROVIDER_TO_ENV_VAR[provider as SupportedProvider | 'xai'] ?? null
}

function readStorage(): SecureStorageData | null {
  try {
    return getSecureStorage().read()
  } catch (e) {
    logForDebugging('Failed to read secure storage for API keys', {
      level: 'warn',
    })
    return null
  }
}

function writeStorage(data: SecureStorageData): {
  success: boolean
  warning?: string
} {
  try {
    return getSecureStorage().update(data)
  } catch (e) {
    return { success: false }
  }
}

export function loadStoredApiKeysIntoEnv(): void {
  const data = readStorage()
  if (!data?.apiKeys) return

  for (const [envVar, key] of Object.entries(data.apiKeys)) {
    if (!key) continue
    if (process.env[envVar] === undefined) {
      process.env[envVar] = key
    }
  }
}

export function setApiKey(
  provider: string,
  key: string,
): { success: boolean; warning?: string; error?: string } {
  const envVar = providerToEnvVar(provider)
  if (!envVar) {
    return {
      success: false,
      error: `Unsupported provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
    }
  }

  const trimmed = key.trim()
  if (!trimmed) {
    return { success: false, error: 'API key cannot be empty' }
  }

  const data = readStorage() ?? {}
  const next: SecureStorageData = {
    ...data,
    apiKeys: {
      ...data.apiKeys,
      [envVar]: trimmed,
    },
  }

  const result = writeStorage(next)
  if (!result.success) {
    return { success: false, error: 'Failed to write to secure storage' }
  }

  return { success: true, warning: result.warning }
}

export function getApiKey(provider: string): string | null {
  const envVar = providerToEnvVar(provider)
  if (!envVar) return null

  const data = readStorage()
  return data?.apiKeys?.[envVar] ?? null
}

export function removeApiKey(provider: string): boolean {
  const envVar = providerToEnvVar(provider)
  if (!envVar) return false

  const data = readStorage()
  if (!data?.apiKeys?.[envVar]) return true

  const nextApiKeys: ApiKeyMap = { ...data.apiKeys }
  delete nextApiKeys[envVar]

  const next: SecureStorageData = {
    ...data,
    apiKeys: nextApiKeys,
  }

  const result = writeStorage(next)
  if (!result.success) return false

  const after = readStorage()
  return !after?.apiKeys?.[envVar]
}

export interface StoredKeyInfo {
  provider: SupportedProvider
  envVar: SupportedApiKeyEnvVar
  configured: boolean
}

export function listStoredApiKeys(): StoredKeyInfo[] {
  const data = readStorage()
  return SUPPORTED_PROVIDERS.map(provider => {
    const envVar = PROVIDER_TO_ENV_VAR[provider]
    return {
      provider,
      envVar,
      configured: Boolean(data?.apiKeys?.[envVar]),
    }
  })
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '*'.repeat(key.length)
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}
