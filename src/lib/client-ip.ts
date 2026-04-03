function normalizeIp(candidate: string | null | undefined): string | null {
  if (candidate == null) {
    return null
  }
  const trimmedCandidate = candidate.trim()
  if (trimmedCandidate === '') {
    return null
  }
  return trimmedCandidate
}

export function getTrustedClientIp(args: {
  request: Request
  clientAddress?: string
}): string | null {
  const normalizedClientAddress = normalizeIp(args.clientAddress)
  if (normalizedClientAddress != null) {
    return normalizedClientAddress
  }

  const normalizedCfConnectingIp = normalizeIp(
    args.request.headers.get('cf-connecting-ip')
  )
  if (normalizedCfConnectingIp != null) {
    return normalizedCfConnectingIp
  }

  const normalizedTrueClientIp = normalizeIp(
    args.request.headers.get('true-client-ip')
  )
  if (normalizedTrueClientIp != null) {
    return normalizedTrueClientIp
  }

  return null
}
