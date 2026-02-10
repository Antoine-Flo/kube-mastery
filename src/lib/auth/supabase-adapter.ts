/**
 * Supabase adapters for auth: layout context + delete account.
 * All Supabase and DB access for auth lives here.
 */

import { getSupabaseAdmin, getSupabaseServer } from '../supabase'
import { isPaidSubscription } from './domain'
import type { DeleteAccountPort, DeleteAccountRequest, LayoutAuthContextPort, LayoutAuthRequest } from './port'
import type { DeleteAccountResult, LayoutAuthContext, LayoutAuthUser } from './types'

const EMPTY_CONTEXT: LayoutAuthContext = {
  isLoggedIn: false,
  user: null,
  hasPaidSubscription: false
}

function mapAuthUser(raw: { id: string; email?: string | null; user_metadata?: unknown }): LayoutAuthUser {
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

        const hasPaidSubscription = (subs ?? []).some((s) => isPaidSubscription(s.plan_tier, s.status))

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
    async deleteCurrentUser(args: DeleteAccountRequest): Promise<DeleteAccountResult> {
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

      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
      if (deleteError) {
        return { ok: false, reason: 'delete_failed', message: deleteError.message }
      }

      await supabase.auth.signOut()
      return { ok: true }
    }
  }
}
