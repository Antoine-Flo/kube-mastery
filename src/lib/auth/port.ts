/**
 * Port for layout auth context (hexagonal architecture).
 */

import type { LayoutAuthContext } from './types'

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
