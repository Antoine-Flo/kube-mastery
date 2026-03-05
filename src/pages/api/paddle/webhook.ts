import type { APIRoute } from 'astro'
import { Environment } from '@paddle/paddle-node-sdk'
import { getSupabaseAdmin, getSupabasePublic } from '../../../lib/supabase'
import { readAppEnv } from '../../../lib/env'
import {
  getPendingSubscriptionForMagicLink,
  insertBillingEvent,
  markPendingMagicLinkSent,
  parsePaddleWebhookEvent,
  sendCheckoutMagicLink,
  syncLinkedSubscriptionFromPaddleEvent,
  shouldSendMagicLink,
  unmarshalPaddleWebhookEvent,
  upsertPendingSubscription
} from '../../../lib/billing/provisioning'

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

function getMaskedPrefix(value: string, visibleChars = 12): string {
  const trimmed = value.trim()
  if (trimmed === '') {
    return ''
  }
  const prefix = trimmed.slice(0, visibleChars)
  return `${prefix}...`
}

export const POST: APIRoute = async ({ request, locals }) => {
  let phase = 'init'
  const paddleEnvironment = Environment.sandbox
  const paddleApiKey = readAppEnv('PADDLE_API_KEY_STAGING', locals)
  if (paddleApiKey == null) {
    phase = 'config:paddle_api_key_missing'
    return json(
      {
        error: 'billing/webhook-processing',
        message: 'Missing PADDLE_API_KEY_STAGING'
      },
      500
    )
  }
  const webhookSecret = readAppEnv(
    'PADDLE_WEBHOOK_SECRET',
    locals
  )
  if (webhookSecret == null) {
    phase = 'config:webhook_secret_missing'
    return json(
      {
        error: 'billing/webhook-processing',
        message: 'Missing PADDLE_WEBHOOK_SECRET'
      },
      500
    )
  }
  const signatureHeader = request.headers.get('paddle-signature')
  if (signatureHeader == null || signatureHeader.trim() === '') {
    phase = 'request:signature_missing'
    return json(
      {
        error: 'billing/webhook-processing',
        message: 'Missing paddle-signature header'
      },
      400
    )
  }

  try {
    phase = 'request:read_body'
    const rawBody = await request.text()
    phase = 'request:parse_json'
    const payload = JSON.parse(rawBody) as Record<string, unknown>
    phase = 'paddle:unmarshal_event'
    const eventData = await unmarshalPaddleWebhookEvent({
      apiKey: paddleApiKey,
      rawBody,
      signatureHeader,
      webhookSecret,
      environment: paddleEnvironment
    })
    phase = 'paddle:parse_event'
    const paddleEvent = parsePaddleWebhookEvent(eventData)
    if (paddleEvent == null) {
      throw new Error('Invalid webhook payload')
    }

    phase = 'supabase:get_admin_client'
    const supabaseAdmin = getSupabaseAdmin(locals)
    if (supabaseAdmin == null) {
      throw new Error('Missing Supabase admin client')
    }

    phase = 'supabase:insert_billing_event'
    const eventInsert = await insertBillingEvent(supabaseAdmin, {
      notificationId: paddleEvent.notificationId,
      eventType: paddleEvent.eventType,
      occurredAt: paddleEvent.occurredAt,
      payload
    })

    if (!eventInsert.ok) {
      throw new Error(eventInsert.error ?? 'billing/webhook-event-insert')
    }

    if (eventInsert.duplicate) {
      return new Response('', { status: 200 })
    }

    phase = 'supabase:upsert_pending_subscription'
    const pendingUpsert = await upsertPendingSubscription(
      supabaseAdmin,
      paddleEvent
    )
    if (!pendingUpsert.ok) {
      throw new Error(pendingUpsert.error ?? 'billing/pending-upsert')
    }

    phase = 'supabase:sync_linked_subscription'
    const linkedSync = await syncLinkedSubscriptionFromPaddleEvent({
      supabaseAdmin,
      paddleEvent
    })
    if (!linkedSync.ok) {
      throw new Error(linkedSync.error ?? 'billing/subscription-sync')
    }

    if (
      shouldSendMagicLink(paddleEvent.status) &&
      paddleEvent.email != null &&
      paddleEvent.paddleSubscriptionId != null
    ) {
      phase = 'supabase:get_pending_for_magic_link'
      const pending = await getPendingSubscriptionForMagicLink(supabaseAdmin, {
        email: paddleEvent.email,
        paddleSubscriptionId: paddleEvent.paddleSubscriptionId
      })

      if (pending != null && pending.magicLinkSentAt == null) {
        phase = 'supabase:get_public_client'
        const supabasePublic = getSupabasePublic(locals) as NonNullable<
          ReturnType<typeof getSupabasePublic>
        >
        phase = 'supabase:send_magic_link'
        const sent = await sendCheckoutMagicLink({
          supabasePublic,
          email: paddleEvent.email,
          lang: paddleEvent.lang,
          request,
          locals
        })

        if (!sent.ok) {
          throw new Error(sent.error ?? 'billing/magic-link-send')
        }

        phase = 'supabase:mark_magic_link_sent'
        await markPendingMagicLinkSent(supabaseAdmin, pending.id)
      }
    }

    phase = 'done'
    return new Response('', { status: 200 })
  } catch (error) {
    const message = getErrorMessage(error)
    const debug = {
      phase,
      paddleEnvironment,
      request: {
        method: request.method,
        url: request.url,
        userAgent: request.headers.get('user-agent') ?? '',
        hasSignatureHeader: signatureHeader.trim() !== '',
        signaturePrefix: getMaskedPrefix(signatureHeader, 22),
        signatureLength: signatureHeader.length,
        paddleVersion: request.headers.get('paddle-version') ?? ''
      },
      env: {
        hasApiKey: paddleApiKey.trim() !== '',
        apiKeyPrefix: getMaskedPrefix(paddleApiKey, 16),
        apiKeyLength: paddleApiKey.length,
        hasWebhookSecret: webhookSecret.trim() !== '',
        webhookSecretPrefix: getMaskedPrefix(webhookSecret, 16),
        webhookSecretLength: webhookSecret.length
      }
    }
    console.error('[paddle-webhook] processing failed', {
      message,
      ...debug
    })
    return json(
      {
        error: 'billing/webhook-processing',
        message,
        debug
      },
      500
    )
  }
}
