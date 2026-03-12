# Form Action Error Handling

This project uses a unified strategy for form actions to prevent navigation to raw JSON pages and provide consistent user feedback.

For backend logging standards and PostHog/OTel conventions, see `docs/logging.md`.

## Goals

- Never render API JSON directly to users after form submission.
- Show user-friendly feedback via toast notifications.
- Avoid leaking internal errors from providers, database, or infrastructure.

## API Contract

Form-action endpoints return a minimal public contract for AJAX requests:

- Success:
  - `{ "ok": true, "code": "ok" }`
  - optional redirect: `{ "ok": true, "code": "ok", "redirectTo": "/en/courses" }`
- Error:
  - `{ "ok": false, "code": "..." }`

Only stable public `code` values are returned to clients.

## AJAX Detection

Client helper sends:

- header `x-form-action: 1`
- header `Accept: application/json`

Server checks this header and:

- returns JSON contract for AJAX mode
- keeps redirect fallback for non-JS mode

## Client Helper

`src/lib/form-action-client.ts` is the shared helper to:

- submit forms with `fetch`
- parse the unified response contract
- dispatch `toast-show` events
- resolve message keys by `code`

## Security Rules

- Do not expose raw `error.message` from Supabase, Paddle, DB, or runtime internals.
- Map internal failures to safe public codes such as:
  - `action_failed`
  - `auth_signin_failed`
  - `subscription_active`
- Keep detailed errors in server logs only.

## UX Rules

- Every handled form must show a success or error toast.
- For redirect-required flows, use `redirectTo` from the success payload.
- Keep fallback redirects for non-JS users.

## Recommended Codes

- Generic: `ok`, `invalid_input`, `unauthorized`, `action_failed`
- Billing/account: `subscription_not_found`, `subscription_active`, `refund_failed`, `delete_failed`
- Auth: `auth_signin_failed`, `auth_oauth_failed`, `auth_session_missing`
