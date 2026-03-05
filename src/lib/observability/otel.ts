import { logs } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { readAppEnv } from '../env'

let sdkStarted = false
const OTEL_SERVICE_NAME = 'kubemastery-backend'
const OTEL_SERVICE_VERSION = '1'
const POSTHOG_OTEL_LOGS_ENDPOINT = 'https://eu.i.posthog.com/i/v1/logs'
const LOG_SCHEMA_VERSION = 1
const MAX_STRING_LENGTH = 300
const SECRET_KEY_PATTERN =
  /(authorization|cookie|set-cookie|api[-_]?key|token|secret|password)/i
const PII_KEY_PATTERN =
  /(^|_|-)(email|ip|ip_address|phone|address|first_name|last_name|full_name)(_|-|$)/i

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
      'service.name': OTEL_SERVICE_NAME,
      'service.version': OTEL_SERVICE_VERSION
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
    requestId: resolveRequestId(args.request),
    route: args.route,
    method: args.request.method,
    env: (readAppEnv('ENVIRONMENT', args.locals) ?? 'unknown').toLowerCase(),
    traceId: resolveTraceId(args.request),
    posthogDistinctId: resolvePosthogDistinctId(args.request),
    posthogSessionId: resolvePosthogSessionId(args.request),
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
    log_schema_version: LOG_SCHEMA_VERSION,
    request_id: args.context.requestId,
    route: args.context.route,
    method: args.context.method,
    env: args.context.env
  }
  if (args.context.traceId != null && args.context.traceId !== '') {
    baseAttributes.trace_id = args.context.traceId
  }
  if (
    args.context.posthogDistinctId != null &&
    args.context.posthogDistinctId !== ''
  ) {
    baseAttributes.posthog_distinct_id = args.context.posthogDistinctId
  }
  if (
    args.context.posthogSessionId != null &&
    args.context.posthogSessionId !== ''
  ) {
    baseAttributes.posthog_session_id = args.context.posthogSessionId
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

function resolveTraceId(request: Request): string | undefined {
  const traceParent = request.headers.get('traceparent')
  if (traceParent == null || traceParent.trim() === '') {
    return undefined
  }
  const parts = traceParent.trim().split('-')
  if (parts.length < 4) {
    return undefined
  }
  const traceId = parts[1]
  if (/^[a-f0-9]{32}$/i.test(traceId)) {
    return traceId.toLowerCase()
  }
  return undefined
}

function resolvePosthogDistinctId(request: Request): string | undefined {
  const value = request.headers.get('x-posthog-distinct-id')
  if (value == null || value.trim() === '') {
    return undefined
  }
  return value.trim()
}

function resolvePosthogSessionId(request: Request): string | undefined {
  const value = request.headers.get('x-posthog-session-id')
  if (value == null || value.trim() === '') {
    return undefined
  }
  return value.trim()
}

function sanitizeLogAttributes(
  input: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY_PATTERN.test(key) || PII_KEY_PATTERN.test(key)) {
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
