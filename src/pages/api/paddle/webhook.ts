import type { APIRoute } from 'astro'
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

export const POST: APIRoute = async ({ request, locals }) => {
  const paddleApiKey = readAppEnv('PADDLE_API_KEY_STAGING', locals) as string
  const webhookSecret = readAppEnv(
    'PADDLE_WEBHOOK_SECRET',
    locals
  ) as string
  const signatureHeader = request.headers.get('paddle-signature') as string

  try {
    const rawBody = await request.text()
    const payload = JSON.parse(rawBody) as Record<string, unknown>
    const eventData = await unmarshalPaddleWebhookEvent({
      apiKey: paddleApiKey,
      rawBody,
      signatureHeader,
      webhookSecret
    })
    const paddleEvent = parsePaddleWebhookEvent(eventData)
    if (paddleEvent == null) {
      throw new Error('Invalid webhook payload')
    }

    const supabaseAdmin = getSupabaseAdmin(locals) as NonNullable<
      ReturnType<typeof getSupabaseAdmin>
    >

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
    return json(
      {
        error: 'billing/webhook-processing',
        message: error instanceof Error ? error.message : 'unknown'
      },
      500
    )
  }
}
