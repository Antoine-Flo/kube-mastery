import { defineMiddleware } from 'astro:middleware'
import { getDisabledLocaleRedirectPath } from './i18n/locale-routing'
import { initOpenTelemetry } from './lib/observability/otel'

export const onRequest = defineMiddleware(async (context, next) => {
  initOpenTelemetry(context.locals)
  const redirectPath = getDisabledLocaleRedirectPath(
    context.url.pathname,
    context.url.search
  )
  if (redirectPath === null) {
    return next()
  }

  const destinationUrl = new URL(redirectPath, context.url)
  return context.redirect(destinationUrl.toString())
})
