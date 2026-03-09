import type { APIRoute } from 'astro'
import { Environment } from '@paddle/paddle-node-sdk'
import { getSupabaseAdmin, getSupabasePublic } from '../../../lib/supabase'
import { readAppEnv } from '../../../lib/env'
import {
  getPendingSubscriptionForMagicLink,
  insertBillingEvent,
  linkSubscriptionToKnownUserFromPaddleEvent,
  markPendingMagicLinkSent,
  parsePaddleWebhookEvent,
  sendCheckoutMagicLink,
  syncLinkedSubscriptionFromPaddleEvent,
  shouldSendMagicLink,
  unmarshalPaddleWebhookEvent,
  upsertPendingSubscription
} from '../../../lib/billing/provisioning'
import {
  createApiLogContext,
  emitApiLog,
  initOpenTelemetry,
  getDurationMs,
  startTimer
} from '../../../lib/observability/otel'

const json = (body: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'unknown'
}

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

export const POST: APIRoute = async ({ request, locals }) => {
  initOpenTelemetry(locals)
  const startedAt = startTimer()
  const baseContext = createApiLogContext({
    request,
    route: '/api/paddle/webhook',
    locals
  })
  const paddleEnvironment = Environment.sandbox
  const configResult = resolveWebhookConfig({
    request,
    locals,
    baseContext,
    startedAt
  })
  if (!configResult.ok) {
    return configResult.response
  }

  try {
    const processResult = await processWebhookEvent({
      request,
      locals,
      paddleApiKey: configResult.paddleApiKey,
      webhookSecret: configResult.webhookSecret,
      signatureHeader: configResult.signatureHeader,
      paddleEnvironment
    })
    if (processResult.duplicate) {
      emitDuplicateWebhookLog({
        baseContext,
        startedAt,
        eventType: processResult.eventType,
        notificationId: processResult.notificationId
      })
      return new Response('', { status: 200 })
    }
    if (processResult.skipped) {
      emitSkippedWebhookLog({
        baseContext,
        startedAt,
        eventType: processResult.eventType,
        notificationId: processResult.notificationId,
        skipReason: processResult.skipReason
      })
      return new Response('', { status: 200 })
    }
    emitSuccessWebhookLog({
      baseContext,
      startedAt,
      eventType: processResult.eventType,
      notificationId: processResult.notificationId
    })
    return new Response('', { status: 200 })
  } catch (error) {
    const message = getErrorMessage(error)
    emitFailedWebhookLog({
      baseContext,
      startedAt,
      paddleEnvironment,
      message
    })
    return json(
      {
        error: 'billing/webhook-processing',
        message
      },
      500
    )
  }
}

type WebhookConfigResult =
  | { ok: true; paddleApiKey: string; webhookSecret: string; signatureHeader: string }
  | { ok: false; response: Response }

function resolveWebhookConfig(args: {
  request: Request
  locals: unknown
  baseContext: ReturnType<typeof createApiLogContext>
  startedAt: number
}): WebhookConfigResult {
  const paddleApiKey = readAppEnv('PADDLE_API_KEY', args.locals)
  if (paddleApiKey == null) {
    emitApiLog({
      level: 'error',
      event: 'billing_webhook_failed',
      message: 'Missing Paddle API key',
      context: args.baseContext,
      statusCode: 500,
      durationMs: getDurationMs(args.startedAt),
      errorCode: 'missing_PADDLE_API_KEY'
    })
    return {
      ok: false,
      response: json(
        {
          error: 'billing/webhook-processing',
          message: 'Missing PADDLE_API_KEY'
        },
        500
      )
    }
  }

  const webhookSecret = readAppEnv('PADDLE_WEBHOOK_SECRET', args.locals)
  if (webhookSecret == null) {
    emitApiLog({
      level: 'error',
      event: 'billing_webhook_failed',
      message: 'Missing webhook secret',
      context: args.baseContext,
      statusCode: 500,
      durationMs: getDurationMs(args.startedAt),
      errorCode: 'missing_paddle_webhook_secret'
    })
    return {
      ok: false,
      response: json(
        {
          error: 'billing/webhook-processing',
          message: 'Missing PADDLE_WEBHOOK_SECRET'
        },
        500
      )
    }
  }

  const signatureHeader = args.request.headers.get('paddle-signature')
  if (signatureHeader == null || signatureHeader.trim() === '') {
    emitApiLog({
      level: 'warn',
      event: 'billing_webhook_failed',
      message: 'Missing webhook signature header',
      context: args.baseContext,
      statusCode: 400,
      durationMs: getDurationMs(args.startedAt),
      errorCode: 'missing_signature'
    })
    return {
      ok: false,
      response: json(
        {
          error: 'billing/webhook-processing',
          message: 'Missing paddle-signature header'
        },
        400
      )
    }
  }

  return { ok: true, paddleApiKey, webhookSecret, signatureHeader }
}

async function processWebhookEvent(args: {
  request: Request
  locals: unknown
  paddleApiKey: string
  webhookSecret: string
  signatureHeader: string
  paddleEnvironment: Environment
}): Promise<{
  duplicate: boolean
  skipped: boolean
  eventType: string
  notificationId: string
  skipReason: string | null
}> {
  const incoming = await parseIncomingWebhook(args)
  const supabaseAdmin = getSupabaseAdmin(args.locals)
  if (supabaseAdmin == null) {
    throw new Error('Missing Supabase admin client')
  }

  if (incoming.kind === 'skip') {
    const notificationId = incoming.notificationId ?? 'unknown'
    const eventType = incoming.eventType ?? 'unknown'

    if (
      incoming.notificationId != null &&
      incoming.eventType != null &&
      incoming.occurredAt != null
    ) {
      const eventInsert = await insertBillingEvent(supabaseAdmin, {
        notificationId: incoming.notificationId,
        eventType: incoming.eventType,
        occurredAt: incoming.occurredAt,
        payload: incoming.payload
      })
      if (!eventInsert.ok) {
        throw new Error(eventInsert.error ?? 'billing/webhook-event-insert')
      }
      return {
        duplicate: eventInsert.duplicate,
        skipped: true,
        eventType,
        notificationId,
        skipReason: incoming.reason
      }
    }
    return {
      duplicate: false,
      skipped: true,
      eventType,
      notificationId,
      skipReason: incoming.reason
    }
  }

  const eventInsert = await insertBillingEvent(supabaseAdmin, {
    notificationId: incoming.paddleEvent.notificationId,
    eventType: incoming.paddleEvent.eventType,
    occurredAt: incoming.paddleEvent.occurredAt,
    payload: incoming.payload
  })
  if (!eventInsert.ok) {
    throw new Error(eventInsert.error ?? 'billing/webhook-event-insert')
  }
  if (eventInsert.duplicate) {
    return {
      duplicate: true,
      skipped: false,
      eventType: incoming.paddleEvent.eventType,
      notificationId: incoming.paddleEvent.notificationId,
      skipReason: null
    }
  }

  await syncWebhookSideEffects({
    request: args.request,
    locals: args.locals,
    supabaseAdmin,
    paddleEvent: incoming.paddleEvent
  })

  return {
    duplicate: false,
    skipped: false,
    eventType: incoming.paddleEvent.eventType,
    notificationId: incoming.paddleEvent.notificationId,
    skipReason: null
  }
}

async function parseIncomingWebhook(args: {
  request: Request
  paddleApiKey: string
  webhookSecret: string
  signatureHeader: string
  paddleEnvironment: Environment
}): Promise<{
  kind: 'handled'
  payload: Record<string, unknown>
  paddleEvent: NonNullable<ReturnType<typeof parsePaddleWebhookEvent>>
} | {
  kind: 'skip'
  payload: Record<string, unknown>
  reason: string
  eventType: string | null
  notificationId: string | null
  occurredAt: string | null
}> {
  const rawBody = await args.request.text()
  const payload = JSON.parse(rawBody) as Record<string, unknown>
  const eventData = await unmarshalPaddleWebhookEvent({
    apiKey: args.paddleApiKey,
    rawBody,
    signatureHeader: args.signatureHeader,
    webhookSecret: args.webhookSecret,
    environment: args.paddleEnvironment
  })
  const paddleEvent = parsePaddleWebhookEvent(eventData)
  if (paddleEvent == null) {
    return {
      kind: 'skip',
      payload,
      reason: 'unsupported_event_payload',
      eventType: asString(eventData.eventType),
      notificationId: asString(eventData.notificationId),
      occurredAt: asString(eventData.occurredAt)
    }
  }
  return { kind: 'handled', payload, paddleEvent }
}

async function syncWebhookSideEffects(args: {
  request: Request
  locals: unknown
  supabaseAdmin: NonNullable<ReturnType<typeof getSupabaseAdmin>>
  paddleEvent: NonNullable<ReturnType<typeof parsePaddleWebhookEvent>>
}): Promise<void> {
  const pendingUpsert = await upsertPendingSubscription(
    args.supabaseAdmin,
    args.paddleEvent
  )
  if (!pendingUpsert.ok) {
    throw new Error(pendingUpsert.error ?? 'billing/pending-upsert')
  }

  const directLink = await linkSubscriptionToKnownUserFromPaddleEvent({
    supabaseAdmin: args.supabaseAdmin,
    paddleEvent: args.paddleEvent
  })
  if (!directLink.ok) {
    throw new Error(directLink.error ?? 'billing/direct-subscription-link')
  }

  const linkedSync = await syncLinkedSubscriptionFromPaddleEvent({
    supabaseAdmin: args.supabaseAdmin,
    paddleEvent: args.paddleEvent
  })
  if (!linkedSync.ok) {
    throw new Error(linkedSync.error ?? 'billing/subscription-sync')
  }

  if (directLink.linked) {
    return
  }
  if (!shouldSendMagicLink(args.paddleEvent.status)) {
    return
  }
  if (args.paddleEvent.email == null) {
    return
  }
  if (args.paddleEvent.paddleSubscriptionId == null) {
    return
  }

  const pending = await getPendingSubscriptionForMagicLink(args.supabaseAdmin, {
    email: args.paddleEvent.email,
    paddleSubscriptionId: args.paddleEvent.paddleSubscriptionId
  })
  if (pending == null || pending.magicLinkSentAt != null) {
    return
  }

  const supabasePublic = getSupabasePublic(args.locals) as NonNullable<
    ReturnType<typeof getSupabasePublic>
  >
  const sent = await sendCheckoutMagicLink({
    supabasePublic,
    email: args.paddleEvent.email,
    lang: args.paddleEvent.lang,
    request: args.request,
    locals: args.locals
  })
  if (!sent.ok) {
    throw new Error(sent.error ?? 'billing/magic-link-send')
  }

  const pendingMarked = await markPendingMagicLinkSent(
    args.supabaseAdmin,
    pending.id
  )
  if (!pendingMarked.ok) {
    throw new Error(pendingMarked.error ?? 'billing/magic-link-mark-pending-sent')
  }
}

function emitDuplicateWebhookLog(args: {
  baseContext: ReturnType<typeof createApiLogContext>
  startedAt: number
  eventType: string
  notificationId: string
}): void {
  emitApiLog({
    level: 'info',
    event: 'billing_webhook_skipped',
    message: 'Duplicate billing webhook ignored',
    context: args.baseContext,
    statusCode: 200,
    durationMs: getDurationMs(args.startedAt),
    attributes: {
      skip_reason: 'duplicate_notification',
      event_type: args.eventType,
      notification_id: args.notificationId
    }
  })
}

function emitSuccessWebhookLog(args: {
  baseContext: ReturnType<typeof createApiLogContext>
  startedAt: number
  eventType: string
  notificationId: string
}): void {
  emitApiLog({
    level: 'info',
    event: 'billing_webhook_succeeded',
    message: 'Billing webhook succeeded',
    context: args.baseContext,
    statusCode: 200,
    durationMs: getDurationMs(args.startedAt),
    attributes: {
      event_type: args.eventType,
      notification_id: args.notificationId
    }
  })
}

function emitSkippedWebhookLog(args: {
  baseContext: ReturnType<typeof createApiLogContext>
  startedAt: number
  eventType: string
  notificationId: string
  skipReason: string | null
}): void {
  emitApiLog({
    level: 'info',
    event: 'billing_webhook_skipped',
    message: 'Billing webhook skipped',
    context: args.baseContext,
    statusCode: 200,
    durationMs: getDurationMs(args.startedAt),
    attributes: {
      event_type: args.eventType,
      notification_id: args.notificationId,
      skip_reason: args.skipReason ?? 'unsupported_event_payload'
    }
  })
}

function emitFailedWebhookLog(args: {
  baseContext: ReturnType<typeof createApiLogContext>
  startedAt: number
  paddleEnvironment: Environment
  message: string
}): void {
  emitApiLog({
    level: 'error',
    event: 'billing_webhook_failed',
    message: 'Billing webhook processing failed',
    context: args.baseContext,
    statusCode: 500,
    durationMs: getDurationMs(args.startedAt),
    errorCode: 'webhook_processing_failed',
    attributes: {
      paddle_environment: args.paddleEnvironment,
      failure_reason: args.message
    }
  })
}
