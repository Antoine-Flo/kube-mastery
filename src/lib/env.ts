export type AppEnv = Record<string, string | undefined>

type RuntimeEnvLocals = {
  runtime?: {
    env?: AppEnv
  }
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }
  return trimmed
}

function readLegacyRuntimeEnv(
  locals?: unknown
): Record<string, unknown> | undefined {
  if (locals == null || typeof locals !== 'object') {
    return undefined
  }
  try {
    const runtime = (locals as RuntimeEnvLocals).runtime
    if (runtime == null || typeof runtime !== 'object') {
      return undefined
    }
    const runtimeEnv = runtime.env
    if (runtimeEnv == null || typeof runtimeEnv !== 'object') {
      return undefined
    }
    return runtimeEnv as Record<string, unknown>
  } catch {
    // Astro v6 Cloudflare throws if legacy runtime getters are accessed.
    return undefined
  }
}

export function readAppEnv(key: string, locals?: unknown): string | undefined {
  const runtimeEnv = readLegacyRuntimeEnv(locals)
  const runtimeValue = readNonEmptyString(runtimeEnv?.[key])
  if (runtimeValue != null) {
    return runtimeValue
  }

  const processEnv =
    typeof process !== 'undefined'
      ? (process.env as Record<string, unknown>)
      : undefined
  return readNonEmptyString(processEnv?.[key])
}
