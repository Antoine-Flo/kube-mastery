import type { APIRoute } from 'astro'
import { getSupabaseServer } from '../../../lib/supabase'

const json = (body: { error: string; message: string }, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  let supabase
  try {
    supabase = getSupabaseServer(locals, request, cookies)
  } catch (e) {
    return json(
      {
        error: 'auth/config',
        message: e instanceof Error ? e.message : 'Missing Supabase env.'
      },
      500
    )
  }

  const formData = await request.formData()
  const email = formData.get('email')?.toString()
  const password = formData.get('password')?.toString()
  const lang = (formData.get('lang')?.toString() || 'en') as string

  if (!email || !password) {
    return new Response('Email and password are required', { status: 400 })
  }

  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return json({ error: 'auth/register', message: error.message }, 500)
  }

  return redirect(`/${lang}/auth`)
}
