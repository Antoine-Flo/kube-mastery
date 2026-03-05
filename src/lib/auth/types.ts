/**
 * Auth context for layout / UI: minimal user info and subscription flag.
 * Filled by the auth server port (e.g. Supabase adapter).
 */

export interface LayoutAuthUser {
  id: string
  email?: string
  user_metadata?: { full_name?: string }
}

export interface LayoutAuthContext {
  isLoggedIn: boolean
  user: LayoutAuthUser | null
  hasPaidSubscription: boolean
}

/** Input for delete-current-user-account flow (API route passes this; redirectTo is HTTP-only, not used by auth). */
export type DeleteAccountRequest = {
  locals: unknown
  request: Request
  cookies: {
    set: (name: string, value: string, options?: { path?: string }) => void
    delete?: (name: string, options?: { path?: string }) => void
  }
}

/** Result of deleteCurrentUserAccount. API route maps this to redirect or JSON Response. */
export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: 'not_authenticated' }
  | { ok: false; reason: 'admin_missing' }
  | { ok: false; reason: 'subscription_active'; message: string }
  | { ok: false; reason: 'delete_failed'; message: string }
