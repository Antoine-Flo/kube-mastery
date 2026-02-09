/**
 * Supabase adapter for layout auth context (implements LayoutAuthContextPort).
 * All Supabase and DB access lives here.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServer } from '../supabase'
import { isPaidSubscription } from './domain'
import type { LayoutAuthContextPort, LayoutAuthRequest } from './port'
import type { LayoutAuthContext, LayoutAuthUser } from './types'

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
        const { data: { user: authUser }, error } = await supabase.auth.getUser()

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
