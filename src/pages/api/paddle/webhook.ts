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

export const POST: APIRoute = async ({ request, locals }) => {
  const paddleEnvironment = Environment.sandbox
  const paddleApiKey = readAppEnv('PADDLE_API_KEY_STAGING', locals)
  if (paddleApiKey == null) {
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
    return json(
      {
        error: 'billing/webhook-processing',
        message: 'Missing paddle-signature header'
      },
      400
    )
  }

  try {
    const rawBody = await request.text()
    const payload = JSON.parse(rawBody) as Record<string, unknown>
    const eventData = await unmarshalPaddleWebhookEvent({
      apiKey: paddleApiKey,
      rawBody,
      signatureHeader,
      webhookSecret,
      environment: paddleEnvironment
    })
    const paddleEvent = parsePaddleWebhookEvent(eventData)
    if (paddleEvent == null) {
      throw new Error('Invalid webhook payload')
    }

    const supabaseAdmin = getSupabaseAdmin(locals)
    if (supabaseAdmin == null) {
      throw new Error('Missing Supabase admin client')
    }

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

    const pendingUpsert = await upsertPendingSubscription(
      supabaseAdmin,
      paddleEvent
    )
    if (!pendingUpsert.ok) {
      throw new Error(pendingUpsert.error ?? 'billing/pending-upsert')
    }

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
      const pending = await getPendingSubscriptionForMagicLink(supabaseAdmin, {
        email: paddleEvent.email,
        paddleSubscriptionId: paddleEvent.paddleSubscriptionId
      })

      if (pending != null && pending.magicLinkSentAt == null) {
        const supabasePublic = getSupabasePublic(locals) as NonNullable<
          ReturnType<typeof getSupabasePublic>
        >
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

        await markPendingMagicLinkSent(supabaseAdmin, pending.id)
      }
    }

    return new Response('', { status: 200 })
  } catch (error) {
    const message = getErrorMessage(error)
    console.error('[paddle-webhook] processing failed', {
      message,
      hasSignatureHeader: signatureHeader.trim() !== '',
      hasWebhookSecret: webhookSecret.trim() !== '',
      hasApiKey: paddleApiKey.trim() !== ''
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
