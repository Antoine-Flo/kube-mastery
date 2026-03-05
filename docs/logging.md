# Backend Logging Guide

This project uses OpenTelemetry logs exported to PostHog.

## Goals

- Keep logs actionable for production incidents.
- Prefer request outcome logs over step-by-step code logs.
- Keep sensitive data out of logs.
- Keep event schema stable over time.

## Current Contract

All API logs emitted through `emitApiLog` include a stable base schema:

- `event`
- `request_id`
- `trace_id` (when available from `traceparent`)
- `posthog_distinct_id` (when provided by caller)
- `posthog_session_id` (when provided by caller)
- `route`
- `method`
- `env`
- `status_code` (when available)
- `duration_ms` (when available)
- `error_code` (when available)
- `user_id` (when available)
- `log_schema_version`

Resource-level attributes are set once by OTel:

- `service.name = kubemastery-backend`
- `service.version = 1`

## Event Style

- Use structured events with business context in attributes.
- Keep one concise message in `body`.
- Use stable event names:
  - `billing_webhook_failed`
  - `auth_signin_succeeded`
  - `account_delete_failed`

## Levels

- `error`: operation failed and needs action.
- `warn`: abnormal but non-blocking condition.
- `info`: normal request outcomes and key lifecycle points.
- `debug`: local troubleshooting only.

## Wide Events First

Default pattern for APIs:

- one final outcome event (`*_succeeded`, `*_failed`, `*_skipped`)

Keep only final outcome logs in routes. Do not rely on runtime log filtering for this.

## Sampling

- Errors and warnings are always kept.
- Sampling is handled by route-level decisions and provider retention settings.
- Default policy: keep all final outcome events.

## Security Rules

Never log:

- API keys, tokens, cookies, passwords, secrets
- full request/response bodies
- direct PII fields (email, phone, address, IP)

The logger redacts sensitive keys automatically before export.

## Schema Evolution

Treat log fields like an API contract:

- avoid renaming existing keys without migration
- add new fields in backward-compatible way
- bump `log_schema_version` when a breaking change is unavoidable

## PostHog Setup Checklist

- `POSTHOG_PROJECT_TOKEN` is set in runtime secrets.
- Logs are visible in PostHog with `service.name = kubemastery-backend`.
- Saved views exist for:
  - billing webhook failures
  - auth failures
  - account and billing actions
- Alerts configured for:
  - `billing_webhook_failed` spike
  - `auth_signin_failed` spike
  - `account_delete_failed` spike
