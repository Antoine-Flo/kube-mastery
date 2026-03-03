import {
  EventName,
  Paddle,
  type EventEntity,
  type SubscriptionNotification,
  type TransactionNotification,
  type SubscriptionActivatedEvent,
  type SubscriptionCanceledEvent,
  type SubscriptionCreatedEvent,
  type SubscriptionPastDueEvent,
  type SubscriptionPausedEvent,
  type SubscriptionResumedEvent,
  type SubscriptionTrialingEvent,
  type SubscriptionUpdatedEvent,
  type TransactionCompletedEvent,
  type TransactionCreatedEvent,
  type TransactionPaidEvent,
  type TransactionUpdatedEvent
} from '@paddle/paddle-node-sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

const INDIVIDUAL_MONTHLY_PRICE_ID = 'pri_01kjfgeb1amgf8ht2fxaqsshhg'
const INDIVIDUAL_YEARLY_PRICE_ID = 'pri_01kjfgg9mz5586yyaxkepp4aa3'
const STANDARD_MONTHLY_PRICE_ID = 'pri_01kjfr83ph95rmgypgrdsc20bs'
const STANDARD_YEARLY_PRICE_ID = 'pri_01kjfr962x53wh4wnkywjmc94s'

const PAID_STATUSES = ['active', 'trialing']

export type ParsedPaddleEvent = {
  notificationId: string
  eventType: string
  occurredAt: string
  email: string | null
  status: string
  planTier: string
  paddleSubscriptionId: string | null
  paddleCustomerId: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  canceledAt: string | null
  lang: string
  rawData: SubscriptionNotification | TransactionNotification
}

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const normalizeLang = (value: string) => (value === 'fr' ? 'fr' : 'en')

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null && !Array.isArray(value)

type PaddleSubscriptionEvent =
  | SubscriptionActivatedEvent
  | SubscriptionCanceledEvent
  | SubscriptionCreatedEvent
  | SubscriptionPastDueEvent
  | SubscriptionPausedEvent
  | SubscriptionResumedEvent
  | SubscriptionTrialingEvent
  | SubscriptionUpdatedEvent

type PaddleTransactionEvent =
  | TransactionCompletedEvent
  | TransactionCreatedEvent
  | TransactionPaidEvent
  | TransactionUpdatedEvent

function getCustomDataString(
  customData: Record<string, any> | null | undefined,
  key: string
): string | null {
  if (customData == null) {
    return null
  }
  return asString(customData[key])
}

function isSubscriptionEvent(
  event: EventEntity
): event is PaddleSubscriptionEvent {
  return (
    event.eventType === EventName.SubscriptionActivated ||
    event.eventType === EventName.SubscriptionCanceled ||
    event.eventType === EventName.SubscriptionCreated ||
    event.eventType === EventName.SubscriptionPastDue ||
    event.eventType === EventName.SubscriptionPaused ||
    event.eventType === EventName.SubscriptionResumed ||
    event.eventType === EventName.SubscriptionTrialing ||
    event.eventType === EventName.SubscriptionUpdated
  )
}

function isTransactionEvent(
  event: EventEntity
): event is PaddleTransactionEvent {
  return (
    event.eventType === EventName.TransactionCompleted ||
    event.eventType === EventName.TransactionCreated ||
    event.eventType === EventName.TransactionPaid ||
    event.eventType === EventName.TransactionUpdated
  )
}

export async function unmarshalPaddleWebhookEvent(args: {
  apiKey: string
  rawBody: string
  signatureHeader: string
  webhookSecret: string
}): Promise<EventEntity> {
  const paddle = new Paddle(args.apiKey)
  return paddle.webhooks.unmarshal(
    args.rawBody,
    args.webhookSecret,
    args.signatureHeader
  )
}

type ItemWithOptionalPriceId = { price: { id: string } | null }

function collectPriceIdsFromItems(items: ItemWithOptionalPriceId[]): string[] {
  const ids: string[] = []
  for (const item of items) {
    const id = item.price?.id ?? null
    if (id != null && id !== '') {
      ids.push(id)
    }
  }
  return ids
}

function derivePlanTier(priceIds: string[]): string {
  const individualIds = [
    INDIVIDUAL_MONTHLY_PRICE_ID,
    INDIVIDUAL_YEARLY_PRICE_ID
  ]
  const standardIds = [STANDARD_MONTHLY_PRICE_ID, STANDARD_YEARLY_PRICE_ID]
  if (priceIds.some((id) => individualIds.includes(id))) {
    return 'individual'
  }
  if (priceIds.some((id) => standardIds.includes(id))) {
    return 'standard'
  }
  return 'unknown'
}

function toMetadataRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {}
  }
  return value
}

export function parsePaddleWebhookEvent(
  eventData: EventEntity
): ParsedPaddleEvent | null {
  const notificationId = asString(eventData.notificationId)
  const eventType = asString(eventData.eventType)
  const occurredAt = asString(eventData.occurredAt)

  if (notificationId == null || eventType == null || occurredAt == null) {
    return null
  }

  if (isSubscriptionEvent(eventData)) {
    const data = eventData.data
    const email = getCustomDataString(data.customData, 'email')
    const lang = normalizeLang(
      getCustomDataString(data.customData, 'lang') ?? 'en'
    )
    return {
      notificationId,
      eventType,
      occurredAt,
      email: email == null ? null : normalizeEmail(email),
      status: data.status,
      planTier: derivePlanTier(collectPriceIdsFromItems(data.items)),
      paddleSubscriptionId: data.id,
      paddleCustomerId: data.customerId,
      currentPeriodStart: data.currentBillingPeriod?.startsAt ?? null,
      currentPeriodEnd: data.currentBillingPeriod?.endsAt ?? null,
      canceledAt: data.canceledAt,
      lang,
      rawData: data
    }
  }

  if (isTransactionEvent(eventData)) {
    const data = eventData.data
    const email = getCustomDataString(data.customData, 'email')
    const lang = normalizeLang(
      getCustomDataString(data.customData, 'lang') ?? 'en'
    )
    return {
      notificationId,
      eventType,
      occurredAt,
      email: email == null ? null : normalizeEmail(email),
      status:
        eventData.eventType === EventName.TransactionCompleted
          ? 'active'
          : data.status,
      planTier: derivePlanTier(collectPriceIdsFromItems(data.items)),
      paddleSubscriptionId: data.subscriptionId,
      paddleCustomerId: data.customerId,
      currentPeriodStart: data.billingPeriod?.startsAt ?? null,
      currentPeriodEnd: data.billingPeriod?.endsAt ?? null,
      canceledAt: null,
      lang,
      rawData: data
    }
  }

  return null
}

function getAppBaseUrl(request: Request): string {
  const configured = process.env.APP_BASE_URL ?? ''
  if (configured !== '') {
    return configured.replace(/\/+$/, '')
  }
  return new URL(request.url).origin
}

export async function sendCheckoutMagicLink(args: {
  supabasePublic: SupabaseClient
  email: string
  lang: string
  request: Request
}): Promise<{ ok: boolean; error: string | null }> {
  const lang = normalizeLang(args.lang)
  const baseUrl = getAppBaseUrl(args.request)
  const confirmUrl = new URL('/api/auth/confirm', baseUrl)
  confirmUrl.searchParams.set('lang', lang)
  confirmUrl.searchParams.set('redirect', `/${lang}/courses`)

  const { error } = await args.supabasePublic.auth.signInWithOtp({
    email: args.email,
    options: {
      emailRedirectTo: confirmUrl.toString(),
      shouldCreateUser: true
    }
  })

  if (error != null) {
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}

export function shouldSendMagicLink(status: string): boolean {
  return PAID_STATUSES.includes(status)
}

export async function insertBillingEvent(
  supabaseAdmin: SupabaseClient,
  args: {
    notificationId: string
    eventType: string
    occurredAt: string
    payload: Record<string, unknown>
  }
): Promise<{ ok: boolean; duplicate: boolean; error: string | null }> {
  const result = await supabaseAdmin.from('billing_events').insert({
    provider: 'paddle',
    notification_id: args.notificationId,
    event_type: args.eventType,
    occurred_at: args.occurredAt,
    payload: args.payload,
    processed_at: new Date().toISOString()
  })
  if (result.error == null) {
    return { ok: true, duplicate: false, error: null }
  }
  if (result.error.code === '23505') {
    return { ok: true, duplicate: true, error: null }
  }
  return { ok: false, duplicate: false, error: result.error.message }
}

export async function upsertPendingSubscription(
  supabaseAdmin: SupabaseClient,
  paddleEvent: ParsedPaddleEvent
): Promise<{ ok: boolean; error: string | null }> {
  if (paddleEvent.email == null || paddleEvent.paddleSubscriptionId == null) {
    return { ok: true, error: null }
  }

  const {
    email,
    status,
    paddleSubscriptionId,
    paddleCustomerId,
    currentPeriodStart,
    currentPeriodEnd,
    canceledAt,
    rawData,
    planTier
  } = paddleEvent

  const result = await supabaseAdmin.from('pending_subscriptions').upsert(
    {
      email,
      status,
      plan_tier: planTier,
      paddle_subscription_id: paddleSubscriptionId,
      paddle_customer_id: paddleCustomerId,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      canceled_at: canceledAt,
      raw_data: rawData,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'paddle_subscription_id' }
  )
  if (result.error != null) {
    return { ok: false, error: result.error.message }
  }
  return { ok: true, error: null }
}

export async function getPendingSubscriptionForMagicLink(
  supabaseAdmin: SupabaseClient,
  args: { email: string; paddleSubscriptionId: string }
): Promise<{ id: string; magicLinkSentAt: string | null } | null> {
  const row = await supabaseAdmin
    .from('pending_subscriptions')
    .select('id, magic_link_sent_at')
    .eq('email', args.email)
    .eq('paddle_subscription_id', args.paddleSubscriptionId)
    .maybeSingle()
  if (row.error != null || row.data == null) {
    return null
  }
  return {
    id: row.data.id as string,
    magicLinkSentAt: (row.data.magic_link_sent_at as string | null) ?? null
  }
}

export async function markPendingMagicLinkSent(
  supabaseAdmin: SupabaseClient,
  pendingId: string
): Promise<void> {
  await supabaseAdmin
    .from('pending_subscriptions')
    .update({
      magic_link_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', pendingId)
}

export async function reconcilePendingSubscriptionsForUser(args: {
  supabaseAdmin: SupabaseClient
  userId: string
  email: string
}): Promise<void> {
  const normalizedEmail = normalizeEmail(args.email)
  const { data: pendingRows, error: pendingError } = await args.supabaseAdmin
    .from('pending_subscriptions')
    .select(
      'id, plan_tier, status, paddle_subscription_id, paddle_customer_id, current_period_start, current_period_end, canceled_at, raw_data'
    )
    .eq('email', normalizedEmail)

  if (pendingError != null || pendingRows == null || pendingRows.length === 0) {
    return
  }

  for (const pending of pendingRows) {
    const paddleSubscriptionId = pending.paddle_subscription_id as string | null
    if (paddleSubscriptionId == null || paddleSubscriptionId === '') {
      continue
    }

    await args.supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: args.userId,
        plan_tier: (pending.plan_tier as string) || 'unknown',
        status: (pending.status as string) || 'unknown',
        paddle_subscription_id: paddleSubscriptionId,
        paddle_customer_id:
          (pending.paddle_customer_id as string | null) ?? null,
        current_period_start:
          (pending.current_period_start as string | null) ?? null,
        current_period_end:
          (pending.current_period_end as string | null) ?? null,
        canceled_at: (pending.canceled_at as string | null) ?? null,
        metadata: toMetadataRecord(pending.raw_data),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'paddle_subscription_id' }
    )

    await args.supabaseAdmin
      .from('pending_subscriptions')
      .update({
        linked_user_id: args.userId,
        linked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', pending.id as string)
  }
}
