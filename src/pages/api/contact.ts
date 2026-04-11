import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../lib/supabase'
import { readAppEnv } from '../../lib/env'
import { CONFIG } from '../../config'
import { getTrustedClientIp } from '../../lib/client-ip'
import {
  createApiLogContext,
  emitApiLog,
  getDurationMs,
  startTimer
} from '../../lib/api-log'

const CONTACT_TYPES = ['support', 'suggestion', 'other'] as const
const SWEEGO_SEND_ENDPOINT = 'https://api.sweego.io/send'
const SWEEGO_PROVIDER = 'sweego'
const contactRateLimitStore = new Map<
  string,
  { count: number; windowStartedAt: number }
>()

function getRateLimitKey(args: {
  userId: string
  clientIp: string | null
}): string {
  if (args.clientIp != null && args.clientIp !== '') {
    return `user:${args.userId}:ip:${args.clientIp}`
  }
  return `user:${args.userId}`
}

function getAnonymousContactRateLimitKey(clientIp: string | null): string {
  if (clientIp != null && clientIp !== '') {
    return `anon:ip:${clientIp}`
  }
  return 'anon:ip:unknown'
}

function isRateLimited(args: {
  key: string
  now: number
  windowMs: number
  maxRequests: number
}): boolean {
  const current = contactRateLimitStore.get(args.key)
  if (current == null) {
    contactRateLimitStore.set(args.key, {
      count: 1,
      windowStartedAt: args.now
    })
    return false
  }
  if (args.now - current.windowStartedAt >= args.windowMs) {
    contactRateLimitStore.set(args.key, {
      count: 1,
      windowStartedAt: args.now
    })
    return false
  }
  if (current.count >= args.maxRequests) {
    return true
  }
  current.count += 1
  contactRateLimitStore.set(args.key, current)
  return false
}

/**
 * POST /api/contact
 * Body: { type: "support" | "suggestion" | "other", message: string, lessonId?: string }
 * Authenticated and unauthenticated: allowed (rate limit by user+IP or anonymous IP).
 */
export const POST: APIRoute = async ({
  request,
  cookies,
  locals,
  clientAddress
}) => {
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/contact',
    locals
  })
  let body: { type?: string; message?: string; lessonId?: string }
  try {
    body = await request.json()
  } catch {
    emitApiLog({
      level: 'warn',
      event: 'contact_submit_failed',
      message: 'Contact submit failed: invalid JSON body',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'invalid_json'
    })
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const type = body.type
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (
    !type ||
    !CONTACT_TYPES.includes(type as (typeof CONTACT_TYPES)[number])
  ) {
    emitApiLog({
      level: 'warn',
      event: 'contact_submit_failed',
      message: 'Contact submit failed: invalid type',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'invalid_type'
    })
    return new Response(
      JSON.stringify({
        error: 'Invalid or missing type (support, suggestion, other)'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  if (!message) {
    emitApiLog({
      level: 'warn',
      event: 'contact_submit_failed',
      message: 'Contact submit failed: message missing',
      context: baseContext,
      statusCode: 400,
      durationMs: getDurationMs(startedAt),
      errorCode: 'message_required'
    })
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const supabase = getSupabaseServer(locals, request, cookies)
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const sweegoApiKey = readAppEnv('SWEEGO_API_KEY', locals)
  const rateLimitNow = Date.now()
  const clientIp = getTrustedClientIp({ request, clientAddress })
  const rateLimitKey =
    user != null
      ? getRateLimitKey({ userId: user.id, clientIp })
      : getAnonymousContactRateLimitKey(clientIp)
  const userContext = createApiLogContext({
    request,
    route: '/api/contact',
    locals,
    userId: user?.id
  })
  const isLimited = isRateLimited({
    key: rateLimitKey,
    now: rateLimitNow,
    windowMs: CONFIG.contact.rateLimit.windowMs,
    maxRequests: CONFIG.contact.rateLimit.maxRequests
  })
  if (isLimited) {
    emitApiLog({
      level: 'warn',
      event: 'contact_submit_failed',
      message: 'Contact submit failed: rate limit exceeded',
      context: userContext,
      statusCode: 429,
      durationMs: getDurationMs(startedAt),
      errorCode: 'rate_limited'
    })
    return new Response(
      JSON.stringify({
        error: 'Too many requests, please try again in a few minutes.'
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  if (sweegoApiKey == null) {
    emitApiLog({
      level: 'error',
      event: 'contact_submit_failed',
      message: 'Contact submit failed: missing Sweego API key',
      context: userContext,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'missing_sweego_api_key'
    })
    return new Response(JSON.stringify({ error: 'Missing SWEEGO_API_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const normalizedLessonId =
    typeof body.lessonId === 'string' && body.lessonId.trim()
      ? body.lessonId.trim()
      : null
  const userIdForEmail = user != null ? user.id : 'anonymous'
  const userEmailForBody =
    user != null && typeof user.email === 'string' && user.email.trim() !== ''
      ? user.email.trim()
      : 'n/a'
  const sweegoSubject = `${type} : ${normalizedLessonId ?? 'no-lesson'}`
  const sweegoMessage = [
    message,
    '',
    `userId: ${userIdForEmail}`,
    `userEmail: ${userEmailForBody}`,
    `lessonId: ${normalizedLessonId ?? 'n/a'}`
  ].join('\n')

  const sweegoResponse = await fetch(SWEEGO_SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Api-Key': sweegoApiKey
    },
    body: JSON.stringify({
      provider: SWEEGO_PROVIDER,
      channel: 'email',
      recipients: [{ email: CONFIG.contact.email.to }],
      from: {
        name: CONFIG.contact.email.from.name,
        email: CONFIG.contact.email.from.email
      },
      subject: sweegoSubject,
      'message-txt': sweegoMessage
    })
  })

  if (!sweegoResponse.ok) {
    const sweegoErrorText = await sweegoResponse.text()
    const sweegoErrorFallback =
      sweegoErrorText.trim() === ''
        ? sweegoResponse.statusText
        : sweegoErrorText.trim()
    let sweegoError = sweegoErrorFallback
    let parsedSweegoError: unknown = null
    try {
      parsedSweegoError = JSON.parse(sweegoErrorText) as unknown
    } catch {
      parsedSweegoError = null
    }
    if (
      parsedSweegoError != null &&
      typeof parsedSweegoError === 'object' &&
      'detail' in parsedSweegoError
    ) {
      const detail = (parsedSweegoError as { detail?: unknown }).detail
      if (Array.isArray(detail)) {
        const hasSmsOnlyConstraint = detail.some((entry) => {
          if (entry == null || typeof entry !== 'object') {
            return false
          }
          if (!('ctx' in entry)) {
            return false
          }
          const ctx = (entry as { ctx?: unknown }).ctx
          if (ctx == null || typeof ctx !== 'object') {
            return false
          }
          if (!('permitted' in ctx)) {
            return false
          }
          const permitted = (ctx as { permitted?: unknown }).permitted
          if (!Array.isArray(permitted)) {
            return false
          }
          return permitted.includes('sms')
        })
        if (hasSmsOnlyConstraint) {
          sweegoError =
            'Sweego API key is SMS-only or email channel not enabled for this account'
        }
      }
    }
    emitApiLog({
      level: 'error',
      event: 'contact_submit_failed',
      message: 'Contact submit failed: Sweego send failed',
      context: userContext,
      statusCode: 500,
      durationMs: getDurationMs(startedAt),
      errorCode: 'sweego_send_failed'
    })
    return new Response(JSON.stringify({ error: sweegoError }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  emitApiLog({
    level: 'info',
    event: 'contact_submit_succeeded',
    message: 'Contact submit succeeded',
    context: userContext,
    statusCode: 200,
    durationMs: getDurationMs(startedAt)
  })
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
