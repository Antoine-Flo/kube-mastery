/**
 * Server-side auth: layout context + delete account. Entry point for Layout and API routes.
 */

import {
  createSupabaseDeleteAccountAdapter,
  createSupabaseLayoutAuthAdapter
} from './supabase-adapter'
import type { DeleteAccountPort } from './port'
import type { LayoutAuthContext } from './types'
import type { DeleteAccountRequest, DeleteAccountResult } from './types'

export type { LayoutAuthContext, LayoutAuthUser, DeleteAccountRequest, DeleteAccountResult } from './types'
export type { LayoutAuthRequest, LayoutAuthContextPort, DeleteAccountPort } from './port'

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

/**
 * Deletes the current user account and signs out. Pass adapter for tests or alternate backend.
 */
export async function deleteCurrentUserAccount(
  args: DeleteAccountRequest,
  adapter?: DeleteAccountPort
): Promise<DeleteAccountResult> {
  const port = adapter ?? createSupabaseDeleteAccountAdapter()
  return port.deleteCurrentUser(args)
}
