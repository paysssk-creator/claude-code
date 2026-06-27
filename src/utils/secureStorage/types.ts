export type SupportedApiKeyEnvVar =
  | 'ANTHROPIC_API_KEY'
  | 'OPENAI_API_KEY'
  | 'GEMINI_API_KEY'
  | 'GROK_API_KEY'

export type ApiKeyMap = Partial<Record<SupportedApiKeyEnvVar, string>>

/**
 * Shape of the data stored by {@link SecureStorage}.
 *
 * The blob is shared between OAuth credentials, managed API keys, and arbitrary
 * plugin secrets, so the shape is intentionally permissive. Known namespaces
 * are typed for documentation; the index signature preserves compatibility with
 * existing callers that store provider-specific OAuth state.
 */
export interface SecureStorageData {
  oauth?: unknown
  apiKeys?: ApiKeyMap
  [key: string]: any
}

export interface SecureStorage {
  name: string
  read(): SecureStorageData | null
  readAsync(): Promise<SecureStorageData | null>
  update(data: SecureStorageData): { success: boolean; warning?: string }
  delete(): boolean
}
