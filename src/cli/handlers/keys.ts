/* eslint-disable custom-rules/no-process-exit -- CLI subcommand handler intentionally exits */

import { createInterface } from 'node:readline'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import {
  getApiKey,
  isSupportedProvider,
  listStoredApiKeys,
  maskKey,
  providerToEnvVar,
  removeApiKey,
  setApiKey,
  SUPPORTED_PROVIDERS,
} from '../../utils/apiKeyManager.js'

function exitWithError(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

export function keysSetHandler(provider: string, key: string): void {
  if (!isSupportedProvider(provider)) {
    return exitWithError(
      `Unsupported provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
    )
  }

  const result = setApiKey(provider, key)
  if (!result.success) {
    return exitWithError(result.error ?? 'Failed to store API key')
  }

  logEvent('tengu_keys_set', {
    provider:
      provider as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })

  process.stdout.write(`API key for ${provider} stored securely.\n`)
  if (result.warning) {
    process.stdout.write(`${result.warning}\n`)
  }
  return process.exit(0)
}

export function keysGetHandler(provider: string): void {
  if (!isSupportedProvider(provider)) {
    return exitWithError(
      `Unsupported provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
    )
  }

  const stored = getApiKey(provider)
  if (!stored) {
    process.stdout.write(`No API key configured for ${provider}.\n`)
    return process.exit(0)
  }

  process.stdout.write(`${provider}: ${maskKey(stored)}\n`)
  return process.exit(0)
}

export function keysListHandler(): void {
  const keys = listStoredApiKeys()
  if (keys.length === 0) {
    process.stdout.write('No API keys configured.\n')
    return process.exit(0)
  }

  const maxWidth = Math.max(...keys.map(k => k.provider.length))
  for (const { provider, configured } of keys) {
    const padded = provider.padEnd(maxWidth)
    process.stdout.write(
      `${padded}  ${configured ? 'configured' : 'not configured'}\n`,
    )
  }
  return process.exit(0)
}

export async function keysRemoveHandler(
  provider: string,
  options: { yes?: boolean },
): Promise<void> {
  if (!isSupportedProvider(provider)) {
    return exitWithError(
      `Unsupported provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
    )
  }

  const stored = getApiKey(provider)
  if (!stored) {
    process.stdout.write(`No API key configured for ${provider}.\n`)
    return process.exit(0)
  }

  if (!options.yes) {
    const confirmed = await confirm(
      `Remove stored API key for ${provider} (${maskKey(stored)})? [y/N] `,
    )
    if (!confirmed) {
      process.stdout.write('Cancelled.\n')
      return process.exit(0)
    }
  }

  const removed = removeApiKey(provider)
  if (!removed) {
    return exitWithError('Failed to remove API key')
  }

  logEvent('tengu_keys_remove', {
    provider:
      provider as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })

  process.stdout.write(`API key for ${provider} removed.\n`)
  return process.exit(0)
}

export async function keysConfigureHandler(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => {
      rl.question(prompt, answer => {
        resolve(answer)
      })
    })

  process.stdout.write(
    'Configure API keys. Leave blank and press Enter to skip a provider.\n',
  )

  for (const provider of SUPPORTED_PROVIDERS) {
    const envVar = providerToEnvVar(provider)
    const existing = getApiKey(provider)
    const hint = existing ? ` (${maskKey(existing)} configured)` : ''
    const answer = await question(`${provider}${hint} ${envVar}: `)
    const trimmed = answer.trim()
    if (!trimmed) continue

    const result = setApiKey(provider, trimmed)
    if (!result.success) {
      process.stderr.write(
        `Failed to store ${provider}: ${result.error ?? 'unknown error'}\n`,
      )
    } else {
      process.stdout.write(`Stored API key for ${provider}.\n`)
      if (result.warning) {
        process.stdout.write(`${result.warning}\n`)
      }
    }
  }

  logEvent('tengu_keys_configure', {})

  rl.close()
  return process.exit(0)
}

function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close()
      resolve(/^y(es)?$/i.test(answer.trim()))
    })
  })
}
