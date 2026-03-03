export type AppEnv = Record<string, string | undefined>

type RuntimeEnvLocals = {
  runtime?: {
    env?: AppEnv
  }
}

export function readAppEnv(
  key: string,
  locals?: unknown
): string | undefined {
  const runtimeEnv = (locals as RuntimeEnvLocals | undefined)?.runtime?.env as
    | Record<string, unknown>
    | undefined
  const runtimeValue = runtimeEnv?.[key]
  if (typeof runtimeValue === 'string') {
    const trimmedRuntime = runtimeValue.trim()
    if (trimmedRuntime !== '') {
      return trimmedRuntime
    }
  }

  const processEnv =
    typeof process !== 'undefined'
      ? (process.env as Record<string, unknown>)
      : undefined
  const processValue = processEnv?.[key]
  if (typeof processValue !== 'string') {
    return undefined
  }
  const trimmed = processValue.trim()
  if (trimmed === '') {
    return undefined
  }
  return trimmed
}
