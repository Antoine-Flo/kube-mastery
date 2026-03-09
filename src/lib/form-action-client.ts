export type FormActionSuccess = {
  ok: true
  code: string
  redirectTo?: string
}

export type FormActionError = {
  ok: false
  code: string
}

export type FormActionResponse = FormActionSuccess | FormActionError

export async function submitFormAction(
  form: HTMLFormElement
): Promise<FormActionResponse> {
  const response = await fetch(form.action, {
    method: (form.method || 'POST').toUpperCase(),
    body: new FormData(form),
    headers: {
      'x-form-action': '1',
      Accept: 'application/json'
    }
  })

  const payload = await readActionPayload(response)
  if (payload == null) {
    return { ok: false, code: 'action_failed' }
  }
  return payload
}

async function readActionPayload(
  response: Response
): Promise<FormActionResponse | null> {
  try {
    const json = (await response.json()) as
      | Partial<FormActionSuccess>
      | Partial<FormActionError>
    if (json.ok === true) {
      return {
        ok: true,
        code: typeof json.code === 'string' ? json.code : 'ok',
        redirectTo:
          typeof json.redirectTo === 'string' ? json.redirectTo : undefined
      }
    }
    if (json.ok === false) {
      return {
        ok: false,
        code: typeof json.code === 'string' ? json.code : 'action_failed'
      }
    }
  } catch {
    return null
  }
  return null
}

export function showActionToast(args: {
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
}): void {
  document.dispatchEvent(
    new CustomEvent('toast-show', {
      detail: {
        type: args.type,
        title: args.title,
        description: args.description
      }
    })
  )
}

export function resolveActionMessage(args: {
  code: string
  map: Record<string, string>
  fallback: string
}): string {
  const value = args.map[args.code]
  if (typeof value === 'string' && value !== '') {
    return value
  }
  return args.fallback
}
