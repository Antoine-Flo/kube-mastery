import { reconcilePendingSubscriptionsForUser } from '../billing/provisioning'
import { getSupabaseAdmin } from '../supabase'

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

  await reconcilePendingSubscriptionsForUser({
    supabaseAdmin,
    userId,
    email: userEmail
  })
}
