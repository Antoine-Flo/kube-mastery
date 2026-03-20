import {
  Environment,
  EventName,
  Paddle,
  type EventEntity
} from '@paddle/paddle-node-sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CONFIG } from '../../config'
import { readAppEnv } from '../env'
import {
  SUBSCRIPTION_STATUS,
  isAllowedSubscriptionStatus,
  isPaidSubscriptionStatus,
  resolvePendingSubscriptionStatus
} from './domain'

export const PLAN_TIER = {
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
  UNKNOWN: 'unknown'
} as const

export type PlanTier = (typeof PLAN_TIER)[keyof typeof PLAN_TIER]

const billingEnvironment = (readAppEnv('ENVIRONMENT') ?? '')
  .toLowerCase()
  .trim()

const SWEEGO_SEND_ENDPOINT = 'https://api.sweego.io/send'
const SWEEGO_PROVIDER = 'sweego'
const SWEEGO_ERROR_EXCERPT_MAX_LENGTH = 240

export type RefundRequestFailureReason =
  | 'missing_sweego_api_key'
  | 'sweego_send_failed'
  | 'sweego_email_channel_disabled'

export type RefundRequestMessageResult =
  | { ok: true; error: null }
  | {
      ok: false
      error: string
      reason: RefundRequestFailureReason
      providerStatus: number | null
      providerErrorExcerpt: string | null
    }

function toErrorExcerpt(value: string): string | null {
  const trimmedValue = value.trim()
  if (trimmedValue === '') {
    return null
  }
  if (trimmedValue.length <= SWEEGO_ERROR_EXCERPT_MAX_LENGTH) {
    return trimmedValue
  }
  return `${trimmedValue.slice(0, SWEEGO_ERROR_EXCERPT_MAX_LENGTH)}...`
}

function hasSmsOnlyConstraint(errorText: string): boolean {
  let parsedError: unknown = null
  try {
    parsedError = JSON.parse(errorText) as unknown
  } catch {
    return false
  }
  if (
    parsedError == null ||
    typeof parsedError !== 'object' ||
    !('detail' in parsedError)
  ) {
    return false
  }
  const detail = (parsedError as { detail?: unknown }).detail
  if (!Array.isArray(detail)) {
    return false
  }
  return detail.some((entry) => {
    if (entry == null || typeof entry !== 'object' || !('ctx' in entry)) {
      return false
    }
    const ctx = (entry as { ctx?: unknown }).ctx
    if (
      ctx == null ||
      typeof ctx !== 'object' ||
      !('permitted' in ctx) ||
      !Array.isArray((ctx as { permitted?: unknown }).permitted)
    ) {
      return false
    }
    const permitted = (ctx as { permitted?: unknown[] }).permitted ?? []
    return permitted.includes('sms')
  })
}

export const PADDLE_PRICE_ID =
  billingEnvironment === 'production'
    ? CONFIG.billing.paddlePriceIds.production
    : CONFIG.billing.paddlePriceIds.staging

const PRICE_ID_TO_PLAN_TIER: Record<string, PlanTier> = {
  [PADDLE_PRICE_ID.PRO_ONETIME]: PLAN_TIER.PRO,
  [PADDLE_PRICE_ID.DISCOUNT_ONETIME]: PLAN_TIER.PRO
}

export type ParsedPaddleEvent = {
  notificationId: string
  eventType: string
  occurredAt: string
  email: string | null
  customDataUserId: string | null
  status: string
  planTier: PlanTier
  paddleSubscriptionId: string | null
  paddleCustomerId: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  canceledAt: string | null
  lang: string
  rawData: Record<string, unknown>
}

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const normalizeLang = (value: string) => (value === 'fr' ? 'fr' : 'en')

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null && !Array.isArray(value)

function getCustomDataString(customData: unknown, key: string): string | null {
  if (!isRecord(customData)) {
    return null
  }
  return asString(customData[key])
}

function isSubscriptionEvent(event: EventEntity): boolean {
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

function isTransactionEvent(event: EventEntity): boolean {
  if (event.eventType.startsWith('transaction.')) {
    return true
  }
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
  environment: Environment
}): Promise<EventEntity> {
  const paddle = new Paddle(args.apiKey, {
    environment: args.environment
  })
  return paddle.webhooks.unmarshal(
    args.rawBody,
    args.webhookSecret,
    args.signatureHeader
  )
}

function collectPriceIdsFromUnknownItems(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const ids: string[] = []
  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }
    const priceValue = item.price
    if (!isRecord(priceValue)) {
      continue
    }
    const priceId = asString(priceValue.id)
    if (priceId != null) {
      ids.push(priceId)
    }
  }
  return ids
}

function derivePlanTier(priceIds: string[]): PlanTier {
  for (const priceId of priceIds) {
    const planTier = PRICE_ID_TO_PLAN_TIER[priceId]
    if (planTier != null) {
      return planTier
    }
  }
  return PLAN_TIER.UNKNOWN
}

function normalizeTransactionStatus(status: string): string {
  const value = status.toLowerCase()
  if (value === 'paid' || value === 'completed') {
    return SUBSCRIPTION_STATUS.ACTIVE
  }
  return value
}

function buildOneTimeReferenceId(transactionId: string | null): string | null {
  if (transactionId == null || transactionId === '') {
    return null
  }
  return transactionId
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
    const data = toMetadataRecord(eventData.data)
    const email = getCustomDataString(data.customData, 'email')
    const customDataUserId = getCustomDataString(data.customData, 'user_id')
    const lang = normalizeLang(
      getCustomDataString(data.customData, 'lang') ?? 'en'
    )
    const currentBillingPeriod = toMetadataRecord(data.currentBillingPeriod)
    const normalizedStatus = asString(data.status) ?? ''
    return {
      notificationId,
      eventType,
      occurredAt,
      email: email == null ? null : normalizeEmail(email),
      customDataUserId,
      status: normalizedStatus,
      planTier: derivePlanTier(collectPriceIdsFromUnknownItems(data.items)),
      paddleSubscriptionId: asString(data.id),
      paddleCustomerId: asString(data.customerId),
      currentPeriodStart: asString(currentBillingPeriod.startsAt),
      currentPeriodEnd: asString(currentBillingPeriod.endsAt),
      canceledAt: asString(data.canceledAt),
      lang,
      rawData: data
    }
  }

  if (isTransactionEvent(eventData)) {
    const data = toMetadataRecord(eventData.data)
    const email = getCustomDataString(data.customData, 'email')
    const customDataUserId = getCustomDataString(data.customData, 'user_id')
    const lang = normalizeLang(
      getCustomDataString(data.customData, 'lang') ?? 'en'
    )
    const transactionId = asString(data.id)
    const paddleSubscriptionId =
      asString(data.subscriptionId) ?? buildOneTimeReferenceId(transactionId)
    const billingPeriod = toMetadataRecord(data.billingPeriod)
    const normalizedStatus = normalizeTransactionStatus(
      asString(data.status) ?? ''
    )
    return {
      notificationId,
      eventType,
      occurredAt,
      email: email == null ? null : normalizeEmail(email),
      customDataUserId,
      status: normalizedStatus,
      planTier: derivePlanTier(collectPriceIdsFromUnknownItems(data.items)),
      paddleSubscriptionId,
      paddleCustomerId: asString(data.customerId),
      currentPeriodStart: asString(billingPeriod.startsAt),
      currentPeriodEnd: asString(billingPeriod.endsAt),
      canceledAt: null,
      lang,
      rawData: data
    }
  }

  return null
}

function getAppBaseUrl(request: Request, locals?: unknown): string {
  const configured = readAppEnv('APP_BASE_URL', locals)
  if (configured != null) {
    return configured.replace(/\/+$/, '')
  }
  return new URL(request.url).origin
}

export async function sendCheckoutMagicLink(args: {
  supabasePublic: SupabaseClient
  email: string
  lang: string
  request: Request
  locals?: unknown
}): Promise<{ ok: boolean; error: string | null }> {
  const lang = normalizeLang(args.lang)
  const baseUrl = getAppBaseUrl(args.request, args.locals)
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
  return isPaidSubscriptionStatus(status)
}

function getPaddleBaseUrl(locals?: unknown): string {
  const environment = (readAppEnv('ENVIRONMENT', locals) ?? '').toLowerCase()
  if (environment === 'production') {
    return 'https://api.paddle.com'
  }
  return 'https://sandbox-api.paddle.com'
}

function getPaddleApiKey(locals?: unknown): string {
  const stagingApiKey = readAppEnv('PADDLE_API_KEY', locals)
  if (stagingApiKey == null) {
    throw new Error('Missing PADDLE_API_KEY')
  }
  return stagingApiKey
}

type PaddlePortalSessionResponse = {
  data?: {
    urls?: {
      general?: {
        overview?: string
      }
    }
  }
}

export async function createPaddleCustomerPortalOverviewLink(args: {
  locals?: unknown
  paddleCustomerId: string
  paddleSubscriptionId?: string
}): Promise<{ ok: boolean; url: string | null; error: string | null }> {
  const path = `/customers/${args.paddleCustomerId}/portal-sessions`
  const body =
    args.paddleSubscriptionId == null || args.paddleSubscriptionId === ''
      ? {}
      : { subscription_ids: [args.paddleSubscriptionId] }

  const response = await fetch(`${getPaddleBaseUrl(args.locals)}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getPaddleApiKey(args.locals)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    let errorMessage = `Paddle API request failed (${response.status})`
    try {
      const payload = (await response.json()) as {
        error?: { detail?: string; code?: string }
      }
      const detail = payload.error?.detail ?? payload.error?.code
      if (detail != null && detail !== '') {
        errorMessage = detail
      }
    } catch {
      // Keep fallback error message.
    }
    return { ok: false, url: null, error: errorMessage }
  }

  const payload = (await response.json()) as PaddlePortalSessionResponse
  const url = payload.data?.urls?.general?.overview ?? null
  if (url == null || url === '') {
    return {
      ok: false,
      url: null,
      error: 'Paddle portal session response missing overview URL'
    }
  }

  return { ok: true, url, error: null }
}

export async function createRefundRequestMessage(args: {
  locals?: unknown
  userId: string
  userEmail: string | null
  paddleSubscriptionId: string
  status: string
  planTier: string
  departureReason: string | null
}): Promise<RefundRequestMessageResult> {
  const sweegoApiKey = readAppEnv('SWEEGO_API_KEY', args.locals)
  if (sweegoApiKey == null) {
    return {
      ok: false,
      error: 'Missing SWEEGO_API_KEY',
      reason: 'missing_sweego_api_key',
      providerStatus: null,
      providerErrorExcerpt: null
    }
  }
  const normalizedEmail =
    args.userEmail != null && args.userEmail.trim() !== ''
      ? args.userEmail.trim()
      : 'n/a'
  const normalizedDepartureReason =
    args.departureReason != null && args.departureReason.trim() !== ''
      ? args.departureReason.trim()
      : 'n/a'
  const subject = `Refund`
  const messageTxt = [
    `${normalizedDepartureReason}`,
    '',
    `userId: ${args.userId}`,
    `userEmail: ${normalizedEmail}`,
    `paddleSubscriptionId: ${args.paddleSubscriptionId}`
  ].join('\n')

  const response = await fetch(SWEEGO_SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Api-Key': sweegoApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      channel: 'email',
      provider: SWEEGO_PROVIDER,
      recipients: [{ email: CONFIG.contact.email.to }],
      from: {
        name: CONFIG.contact.email.from.name,
        email: CONFIG.contact.email.from.email
      },
      subject,
      'message-txt': messageTxt
    })
  })
  if (!response.ok) {
    const errorText = await response.text()
    const errorMessage =
      errorText.trim() === '' ? response.statusText : errorText.trim()
    if (hasSmsOnlyConstraint(errorText)) {
      return {
        ok: false,
        error: 'Sweego API key is SMS-only or email channel is not enabled',
        reason: 'sweego_email_channel_disabled',
        providerStatus: response.status,
        providerErrorExcerpt: toErrorExcerpt(errorText)
      }
    }
    return {
      ok: false,
      error: errorMessage,
      reason: 'sweego_send_failed',
      providerStatus: response.status,
      providerErrorExcerpt: toErrorExcerpt(errorText)
    }
  }
  return { ok: true, error: null }
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

  let existingStatus: string | null = null
  if (!isAllowedSubscriptionStatus(status)) {
    const existing = await supabaseAdmin
      .from('pending_subscriptions')
      .select('status')
      .eq('paddle_subscription_id', paddleSubscriptionId)
      .maybeSingle()
    if (existing.error != null) {
      return { ok: false, error: existing.error.message }
    }
    existingStatus = (existing.data?.status as string | null) ?? null
  }
  const resolvedStatus = resolvePendingSubscriptionStatus({
    incomingStatus: status,
    existingStatus
  })

  const result = await supabaseAdmin.from('pending_subscriptions').upsert(
    {
      email,
      status: resolvedStatus,
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
): Promise<{ ok: boolean; error: string | null }> {
  const result = await supabaseAdmin
    .from('pending_subscriptions')
    .update({
      magic_link_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', pendingId)
  if (result.error != null) {
    return { ok: false, error: result.error.message }
  }
  return { ok: true, error: null }
}

export async function reconcilePendingSubscriptionsForUser(args: {
  supabaseAdmin: SupabaseClient
  userId: string
  email: string
}): Promise<{ ok: boolean; error: string | null }> {
  const normalizedEmail = normalizeEmail(args.email)
  const { data: pendingRows, error: pendingError } = await args.supabaseAdmin
    .from('pending_subscriptions')
    .select(
      'id, plan_tier, status, paddle_subscription_id, paddle_customer_id, current_period_start, current_period_end, canceled_at, raw_data'
    )
    .eq('email', normalizedEmail)

  if (pendingError != null || pendingRows == null || pendingRows.length === 0) {
    return { ok: pendingError == null, error: pendingError?.message ?? null }
  }

  for (const pending of pendingRows) {
    const paddleSubscriptionId = pending.paddle_subscription_id as string | null
    const pendingStatus = (pending.status as string | null) ?? ''
    if (paddleSubscriptionId == null || paddleSubscriptionId === '') {
      continue
    }
    if (!isAllowedSubscriptionStatus(pendingStatus)) {
      continue
    }

    const upsertResult = await args.supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: args.userId,
        plan_tier: (pending.plan_tier as string) || PLAN_TIER.UNKNOWN,
        status: pendingStatus,
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
    if (upsertResult.error != null) {
      return { ok: false, error: upsertResult.error.message }
    }

    const linkResult = await args.supabaseAdmin
      .from('pending_subscriptions')
      .update({
        linked_user_id: args.userId,
        linked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', pending.id as string)
    if (linkResult.error != null) {
      return { ok: false, error: linkResult.error.message }
    }
  }
  return { ok: true, error: null }
}

export async function linkSubscriptionToKnownUserFromPaddleEvent(args: {
  supabaseAdmin: SupabaseClient
  paddleEvent: ParsedPaddleEvent
}): Promise<{ ok: boolean; linked: boolean; error: string | null }> {
  const userId = args.paddleEvent.customDataUserId
  const paddleSubscriptionId = args.paddleEvent.paddleSubscriptionId
  if (userId == null || userId === '') {
    return { ok: true, linked: false, error: null }
  }
  if (paddleSubscriptionId == null || paddleSubscriptionId === '') {
    return { ok: true, linked: false, error: null }
  }
  if (!isAllowedSubscriptionStatus(args.paddleEvent.status)) {
    return { ok: true, linked: false, error: null }
  }

  const upsertResult = await args.supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan_tier: args.paddleEvent.planTier,
      status: args.paddleEvent.status,
      paddle_subscription_id: paddleSubscriptionId,
      paddle_customer_id: args.paddleEvent.paddleCustomerId,
      current_period_start: args.paddleEvent.currentPeriodStart,
      current_period_end: args.paddleEvent.currentPeriodEnd,
      canceled_at: args.paddleEvent.canceledAt,
      metadata: toMetadataRecord(args.paddleEvent.rawData),
      updated_at: new Date().toISOString()
    },
    { onConflict: 'paddle_subscription_id' }
  )
  if (upsertResult.error != null) {
    return { ok: false, linked: false, error: upsertResult.error.message }
  }

  const pendingLinkResult = await args.supabaseAdmin
    .from('pending_subscriptions')
    .update({
      linked_user_id: userId,
      linked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('paddle_subscription_id', paddleSubscriptionId)
  if (pendingLinkResult.error != null) {
    return { ok: false, linked: false, error: pendingLinkResult.error.message }
  }

  return { ok: true, linked: true, error: null }
}

export async function syncLinkedSubscriptionFromPaddleEvent(args: {
  supabaseAdmin: SupabaseClient
  paddleEvent: ParsedPaddleEvent
}): Promise<{ ok: boolean; error: string | null }> {
  const paddleSubscriptionId = args.paddleEvent.paddleSubscriptionId
  if (paddleSubscriptionId == null || paddleSubscriptionId === '') {
    return { ok: true, error: null }
  }
  if (!isAllowedSubscriptionStatus(args.paddleEvent.status)) {
    return { ok: true, error: null }
  }

  const existing = await args.supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('paddle_subscription_id', paddleSubscriptionId)
    .maybeSingle()

  if (existing.error != null) {
    return { ok: false, error: existing.error.message }
  }

  if (existing.data == null) {
    return { ok: true, error: null }
  }

  const updateResult = await args.supabaseAdmin
    .from('subscriptions')
    .update({
      plan_tier: args.paddleEvent.planTier,
      status: args.paddleEvent.status,
      paddle_customer_id: args.paddleEvent.paddleCustomerId,
      current_period_start: args.paddleEvent.currentPeriodStart,
      current_period_end: args.paddleEvent.currentPeriodEnd,
      canceled_at: args.paddleEvent.canceledAt,
      metadata: toMetadataRecord(args.paddleEvent.rawData),
      updated_at: new Date().toISOString()
    })
    .eq('id', existing.data.id as string)

  if (updateResult.error != null) {
    return { ok: false, error: updateResult.error.message }
  }

  return { ok: true, error: null }
}
