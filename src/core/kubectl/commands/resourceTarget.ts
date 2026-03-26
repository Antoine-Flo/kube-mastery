import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import { RESOURCE_ALIAS_MAP } from './resources'
import type { Resource } from './types'

export type ParsedResourceTarget = {
  resource: Resource
  name?: string
  usesTypeNameSyntax: boolean
}

export const parseResourceTargetToken = (
  token: string | undefined
): Result<ParsedResourceTarget> => {
  if (!token || token.startsWith('-')) {
    return error('Invalid or missing resource type')
  }

  if (!token.includes('/')) {
    const resource = RESOURCE_ALIAS_MAP[token] as Resource | undefined
    if (!resource) {
      return error('Invalid or missing resource type')
    }
    return success({
      resource,
      usesTypeNameSyntax: false
    })
  }

  const [resourceToken, nameToken] = token.split('/', 2)
  const resource = RESOURCE_ALIAS_MAP[resourceToken] as Resource | undefined
  if (!resource) {
    return error('Invalid or missing resource type')
  }

  return success({
    resource,
    name: nameToken && nameToken.length > 0 ? nameToken : undefined,
    usesTypeNameSyntax: true
  })
}
