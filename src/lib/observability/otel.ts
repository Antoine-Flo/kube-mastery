import { logs } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { readAppEnv } from '../env'

let sdkStarted = false
const OTEL_SERVICE_NAME = 'kubemastery-backend'
const POSTHOG_OTEL_LOGS_ENDPOINT = 'https://eu.i.posthog.com/i/v1/logs'
const MAX_STRING_LENGTH = 300
const SECRET_KEY_PATTERN =
  /(authorization|cookie|set-cookie|api[-_]?key|token|secret|password)/i

function getPosthogProjectToken(locals?: unknown): string | null {
  const token = readAppEnv('POSTHOG_PROJECT_TOKEN', locals)
  if (token == null || token.trim() === '') {
    return null
  }
  return token.trim()
}

export function initOpenTelemetry(locals?: unknown): void {
  if (sdkStarted) {
    return
  }
  const projectToken = getPosthogProjectToken(locals)
  if (projectToken == null) {
    return
  }
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': OTEL_SERVICE_NAME
    }),
    logRecordProcessor: new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: POSTHOG_OTEL_LOGS_ENDPOINT,
        headers: {
          Authorization: `Bearer ${projectToken}`
        }
      })
    )
  })
  void sdk.start()
  sdkStarted = true
}

export function emitOtelLog(args: {
  severityText: 'debug' | 'info' | 'warn' | 'error'
  body: string
  attributes?: Record<string, string | number | boolean>
}): void {
  const logger = logs.getLogger('kubemastery-api')
  logger.emit({
    severityText: args.severityText,
    body: args.body,
    attributes: sanitizeLogAttributes(args.attributes ?? {})
  })
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type Primitive = string | number | boolean

export type ApiLogContext = {
  requestId: string
  route: string
  method: string
  env: string
  userId?: string
}

export function createApiLogContext(args: {
  request: Request
  route: string
  locals?: unknown
  userId?: string
}): ApiLogContext {
  return {
    requestId: resolveRequestId(args.request),
    route: args.route,
    method: args.request.method,
    env: (readAppEnv('ENVIRONMENT', args.locals) ?? 'unknown').toLowerCase(),
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
  const baseAttributes: Record<string, Primitive> = {
    event: args.event,
    request_id: args.context.requestId,
    route: args.context.route,
    method: args.context.method,
    env: args.context.env
  }
  if (args.context.userId != null && args.context.userId !== '') {
    baseAttributes.user_id = args.context.userId
  }
  if (args.statusCode != null) {
    baseAttributes.status_code = args.statusCode
  }
  if (args.durationMs != null) {
    baseAttributes.duration_ms = args.durationMs
  }
  if (args.errorCode != null && args.errorCode !== '') {
    baseAttributes.error_code = args.errorCode
  }
  emitOtelLog({
    severityText: args.level,
    body: args.message,
    attributes: {
      ...baseAttributes,
      ...(args.attributes ?? {})
    }
  })
}

function resolveRequestId(request: Request): string {
  const fromRequestId = request.headers.get('x-request-id')
  if (fromRequestId != null && fromRequestId.trim() !== '') {
    return fromRequestId.trim()
  }
  const fromCfRay = request.headers.get('cf-ray')
  if (fromCfRay != null && fromCfRay.trim() !== '') {
    return fromCfRay.trim()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req_${Date.now().toString(36)}`
}

function sanitizeLogAttributes(
  input: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = '[REDACTED]'
      continue
    }
    if (typeof value === 'string') {
      output[key] = value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value
      continue
    }
    output[key] = value
  }
  return output
}
