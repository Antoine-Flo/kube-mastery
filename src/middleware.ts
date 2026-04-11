import { defineMiddleware } from 'astro:middleware'
import { getDisabledLocaleRedirectPath } from './i18n/locale-routing'
import { initOpenTelemetry } from './lib/api-log'

function shouldAddNoindexHeader(pathname: string): boolean {
  if (/^\/api(?:\/|$)/.test(pathname)) {
    return true
  }
  if (/^\/(en|fr)\/profile(?:\/|$)/.test(pathname)) {
    return true
  }
  if (/^\/(en|fr)\/drills(?:\/|$)/.test(pathname)) {
    return true
  }
  if (/^\/(en|fr)\/checkout\/success(?:\/|$)/.test(pathname)) {
    return true
  }
  return false
}

export const onRequest = defineMiddleware(async (context, next) => {
  initOpenTelemetry(context.locals)
  const redirectPath = getDisabledLocaleRedirectPath(
    context.url.pathname,
    context.url.search
  )
  if (redirectPath === null) {
    const response = await next()
    if (shouldAddNoindexHeader(context.url.pathname)) {
      response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    }
    return response
  }

  const destinationUrl = new URL(redirectPath, context.url)
  return context.redirect(destinationUrl.toString())
})
