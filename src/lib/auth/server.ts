/**
 * Server-side auth context for layout: entry point that delegates to the port adapter.
 */

import { createSupabaseLayoutAuthAdapter } from './supabase-adapter'
import type { LayoutAuthContext } from './types'

export type { LayoutAuthContext, LayoutAuthUser } from './types'
export type { LayoutAuthRequest, LayoutAuthContextPort } from './port'

/**
 * Returns auth context for the current request (user, login state, paid subscription).
 * Safe to call from Layout. Delegates to the Supabase adapter.
 */
export async function getLayoutAuthContext(
  locals: unknown,
  request: Request,
  cookies: { set: (name: string, value: string, options?: { path?: string }) => void; delete?: (name: string, options?: { path?: string }) => void }
): Promise<LayoutAuthContext> {
  const adapter = createSupabaseLayoutAuthAdapter()
  return adapter.getContext({ locals, request, cookies })
}
