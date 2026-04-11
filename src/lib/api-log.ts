export function initOpenTelemetry(_locals?: unknown): void {
  return
}

export function emitOtelLog(_args: {
  severityText: 'debug' | 'info' | 'warn' | 'error'
  body: string
  attributes?: Record<string, string | number | boolean>
}): void {
  return
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type Primitive = string | number | boolean

export type ApiLogContext = {
  requestId: string
  route: string
  method: string
  env: string
  traceId?: string
  posthogDistinctId?: string
  posthogSessionId?: string
  userId?: string
}

export function createApiLogContext(args: {
  request: Request
  route: string
  locals?: unknown
  userId?: string
}): ApiLogContext {
  return {
    requestId: '',
    route: args.route,
    method: args.request.method,
    env: 'unknown',
    userId: args.userId
  }
}

export function startTimer(): number {
  return Date.now()
}

export function getDurationMs(startedAt: number): number {
  const duration = Date.now() - startedAt
  if (duration < 0) {
    return 0
  }
  return duration
}

export function emitApiLog(args: {
  level: LogLevel
  event: string
  message: string
  context: ApiLogContext
  statusCode?: number
  durationMs?: number
  errorCode?: string
  attributes?: Record<string, Primitive>
}): void {
  void args
  return
}
