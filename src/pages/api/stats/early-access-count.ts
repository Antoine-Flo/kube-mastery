import type { APIRoute } from 'astro'
import {
  getAuthUserCount,
  EARLY_ACCESS_CAP
} from '../../../lib/auth/early-access-cap'

export const GET: APIRoute = async ({ locals }) => {
  const count = await getAuthUserCount(locals)
  if (count == null) {
    return new Response(JSON.stringify({ error: 'unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  return new Response(JSON.stringify({ count, cap: EARLY_ACCESS_CAP }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
