/**
 * Supabase adapters for auth: layout context + delete account.
 * All Supabase and DB access for auth lives here.
 */

import { getSupabaseAdmin, getSupabaseServer } from '../supabase'
import { isPaidSubscription } from './domain'
import type {
  DeleteAccountPort,
  DeleteAccountRequest,
  LayoutAuthContextPort,
  LayoutAuthRequest
} from './port'
import type {
  DeleteAccountResult,
  LayoutAuthContext,
  LayoutAuthUser
} from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

const EMPTY_CONTEXT: LayoutAuthContext = {
  isLoggedIn: false,
  user: null,
  hasPaidSubscription: false
}

type PreservableSubscriptionRow = {
  plan_tier: string
  status: string
  paddle_subscription_id: string | null
  paddle_customer_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  canceled_at: string | null
  metadata: Record<string, unknown> | null
}

async function preserveBillingTraceBeforeAccountDelete(args: {
  admin: SupabaseClient
  userId: string
  userEmail: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const normalizedEmail = args.userEmail.trim().toLowerCase()
  if (normalizedEmail === '') {
    return { ok: false, message: 'User email is required for billing trace' }
  }

  const { data: subscriptionRows, error: subscriptionsError } = await args.admin
    .from('subscriptions')
    .select(
      'plan_tier, status, paddle_subscription_id, paddle_customer_id, current_period_start, current_period_end, canceled_at, metadata'
    )
    .eq('user_id', args.userId)

  if (subscriptionsError != null) {
    return { ok: false, message: subscriptionsError.message }
  }

  const rows = (subscriptionRows as PreservableSubscriptionRow[] | null) ?? []
  const nowIso = new Date().toISOString()
  const rowsToPreserve = rows.map((row) => ({
      email: normalizedEmail,
      plan_tier: row.plan_tier,
      status: row.status,
      paddle_subscription_id: row.paddle_subscription_id,
      paddle_customer_id: row.paddle_customer_id,
      current_period_start: row.current_period_start,
      current_period_end: row.current_period_end,
      canceled_at: row.canceled_at,
      linked_user_id: null,
      linked_at: null,
      updated_at: nowIso,
      // Keep a minimal trace to allow safe relink if the same user returns later.
      raw_data: {
        ...(row.metadata ?? {}),
        source: 'account_delete_preservation',
        previous_user_id: args.userId,
        preserved_at: nowIso
      }
    }))

  if (rowsToPreserve.length === 0) {
    return { ok: true }
  }

  const { error: pendingUpsertError } = await args.admin
    .from('pending_subscriptions')
    .upsert(rowsToPreserve, { onConflict: 'paddle_subscription_id' })

  if (pendingUpsertError != null) {
    return { ok: false, message: pendingUpsertError.message }
  }

  return { ok: true }
}

function mapAuthUser(raw: {
  id: string
  email?: string | null
  user_metadata?: unknown
}): LayoutAuthUser {
  return {
    id: raw.id,
    email: raw.email ?? undefined,
    user_metadata: raw.user_metadata as { full_name?: string } | undefined
  }
}

export function createSupabaseLayoutAuthAdapter(): LayoutAuthContextPort {
  return {
    async getContext(args: LayoutAuthRequest): Promise<LayoutAuthContext> {
      const { locals, request, cookies } = args
      try {
        const supabase = getSupabaseServer(locals, request, cookies)
        const {
          data: { user: authUser },
          error
        } = await supabase.auth.getUser()

        if (error) {
          return EMPTY_CONTEXT
        }

        if (!authUser) {
          return EMPTY_CONTEXT
        }

        const { data: subs } = await supabase
          .from('subscriptions')
          .select('id, plan_tier, status')
          .eq('user_id', authUser.id)

        const hasPaidSubscription = (subs ?? []).some((s) =>
          isPaidSubscription(s.plan_tier, s.status)
        )

        return {
          isLoggedIn: true,
          user: mapAuthUser(authUser),
          hasPaidSubscription
        }
      } catch {
        return EMPTY_CONTEXT
      }
    }
  }
}

export function createSupabaseDeleteAccountAdapter(): DeleteAccountPort {
  return {
    async deleteCurrentUser(
      args: DeleteAccountRequest
    ): Promise<DeleteAccountResult> {
      const { locals, request, cookies } = args

      let supabase
      try {
        supabase = getSupabaseServer(locals, request, cookies)
      } catch {
        return { ok: false, reason: 'not_authenticated' }
      }

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()
      if (userError || !user) {
        return { ok: false, reason: 'not_authenticated' }
      }

      const admin = getSupabaseAdmin(locals)
      if (!admin) {
        return { ok: false, reason: 'admin_missing' }
      }

      const preserved = await preserveBillingTraceBeforeAccountDelete({
        admin,
        userId: user.id,
        userEmail: user.email ?? ''
      })
      if (!preserved.ok) {
        return {
          ok: false,
          reason: 'delete_failed',
          message: preserved.message
        }
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
      if (deleteError) {
        return {
          ok: false,
          reason: 'delete_failed',
          message: deleteError.message
        }
      }

      await supabase.auth.signOut()
      return { ok: true }
    }
  }
}
