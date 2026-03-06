import { reconcilePendingSubscriptionsForUser } from '../billing/provisioning'
import { getSupabaseAdmin } from '../supabase'
import { emitOtelLog } from '../observability/otel'

type AuthenticatedUser = {
  id?: string | null
  email?: string | null
}

/**
 * Reconcile pending Paddle subscriptions for an authenticated user.
 */
export async function reconcileBillingForAuthenticatedUser(
  locals: unknown,
  user: AuthenticatedUser | null | undefined
): Promise<void> {
  const userId = user?.id ?? ''
  const userEmail = user?.email ?? ''
  if (userId === '' || userEmail === '') {
    return
  }

  const supabaseAdmin = getSupabaseAdmin(locals)
  if (supabaseAdmin == null) {
    return
  }

  try {
    const result = await reconcilePendingSubscriptionsForUser({
      supabaseAdmin,
      userId,
      email: userEmail
    })
    if (!result.ok) {
      emitOtelLog({
        severityText: 'error',
        body: 'billing_reconcile_failed',
        attributes: {
          event: 'billing_reconcile_failed',
          user_id: userId,
          failure_reason: result.error ?? 'unknown'
        }
      })
      return
    }
  } catch (error) {
    emitOtelLog({
      severityText: 'error',
      body: 'billing_reconcile_failed',
      attributes: {
        event: 'billing_reconcile_failed',
        user_id: userId,
        failure_reason: error instanceof Error ? error.message : 'unknown'
      }
    })
  }
}
