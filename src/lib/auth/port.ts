/**
 * Ports for auth (hexagonal architecture).
 * Implementations live in adapters (e.g. supabase-adapter).
 */

import type { DeleteAccountRequest, DeleteAccountResult, LayoutAuthContext } from './types'

export type LayoutAuthRequest = {
  locals: unknown
  request: Request
  cookies: {
    set: (name: string, value: string, options?: { path?: string }) => void
    delete?: (name: string, options?: { path?: string }) => void
  }
}

export interface LayoutAuthContextPort {
  getContext(args: LayoutAuthRequest): Promise<LayoutAuthContext>
}

export type { DeleteAccountRequest } from './types'

/** Port for "delete current user account". Adapters (e.g. Supabase) implement it. */
export interface DeleteAccountPort {
  deleteCurrentUser(args: DeleteAccountRequest): Promise<DeleteAccountResult>
}
