import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'

const base64UrlEncode = (value: string): string => {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

const buildServiceAccountToken = (
  namespace: string,
  serviceAccountName: string
): string => {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64UrlEncode(
    JSON.stringify({
      aud: ['https://kubernetes.default.svc'],
      exp: nowSeconds + 3600,
      iat: nowSeconds,
      iss: 'kubernetes/serviceaccount',
      sub: `system:serviceaccount:${namespace}:${serviceAccountName}`
    })
  )
  const signature = base64UrlEncode('simulated-signature')
  return `${header}.${payload}.${signature}`
}

export const handleCreateToken = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  if (parsed.name == null || parsed.name.length === 0) {
    return error('error: create token requires a serviceaccount name')
  }
  const namespace = parsed.namespace ?? 'default'
  const serviceAccountResult = apiServer.findResource(
    'ServiceAccount',
    parsed.name,
    namespace
  )
  if (!serviceAccountResult.ok) {
    return error(
      `Error from server (NotFound): serviceaccounts "${parsed.name}" not found`
    )
  }
  const token = buildServiceAccountToken(namespace, parsed.name)
  return success(token)
}
