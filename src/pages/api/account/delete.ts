import type { APIRoute } from 'astro'
import { deleteCurrentUserAccount } from '../../../lib/auth/server'

function getSafeRedirectTarget(
  redirectParam: string | null,
  fallback: string
): string {
  if (!redirectParam) {
    return fallback
  }
  const path =
    redirectParam.startsWith('/') && !redirectParam.includes('//')
      ? redirectParam
      : ''
  return path || fallback
}

const json = (body: { error: string }, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

export const POST: APIRoute = async ({
  url,
  cookies,
  redirect,
  locals,
  request
}) => {
  const redirectTo = getSafeRedirectTarget(
    url.searchParams.get('redirect'),
    '/en'
  )

  const result = await deleteCurrentUserAccount({ locals, request, cookies })

  if (result.ok) {
    return redirect(redirectTo)
  }

  if (result.reason === 'not_authenticated') {
    return redirect(redirectTo)
  }

  if (result.reason === 'admin_missing') {
    return json(
      { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set.' },
      500
    )
  }

  return json({ error: result.message }, 400)
}
