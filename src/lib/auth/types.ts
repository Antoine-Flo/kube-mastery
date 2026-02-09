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
