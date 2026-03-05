export type ActionCode =
  | 'ok'
  | 'unauthorized'
  | 'subscription_not_found'
  | 'subscription_active'
  | 'pause_failed'
  | 'resume_failed'
  | 'cancel_failed'
  | 'refund_failed'
  | 'delete_failed'
  | 'auth_oauth_failed'
  | 'auth_signin_failed'
  | 'auth_session_missing'
  | 'invalid_input'
  | 'action_failed'

export type ActionSuccessBody = {
  ok: true
  code: ActionCode
  redirectTo?: string
}

export type ActionErrorBody = {
  ok: false
  code: ActionCode
}

export function isAjaxFormAction(request: Request): boolean {
  return request.headers.get('x-form-action') === '1'
}

export function actionJsonSuccess(
  body: ActionSuccessBody,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export function actionJsonError(body: ActionErrorBody, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
