export function getSafeLocalRedirectTarget(
  redirectParam: string | null | undefined,
  fallback: string
): string {
  if (redirectParam == null) {
    return fallback
  }
  const trimmedRedirect = redirectParam.trim()
  if (trimmedRedirect === '') {
    return fallback
  }
  if (!trimmedRedirect.startsWith('/')) {
    return fallback
  }
  try {
    const targetUrl = new URL(trimmedRedirect, 'http://localhost')
    if (targetUrl.hostname !== 'localhost') {
      return fallback
    }
    return `${targetUrl.pathname}${targetUrl.search}`
  } catch {
    return fallback
  }
}
