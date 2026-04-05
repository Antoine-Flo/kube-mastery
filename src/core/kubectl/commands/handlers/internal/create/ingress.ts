import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import {
  createIngress,
  type IngressRule
} from '../../../../../cluster/ressources/Ingress'
import type { ExecutionResult } from '../../../../../shared/result'
import { error } from '../../../../../shared/result'
import { createResourceWithEvents } from '../../../resourceHelpers'
import type { ParsedCommand } from '../../../types'

type ParsedIngressRule = {
  host?: string
  path: string
  serviceName: string
  servicePort: number
}

const parseIngressRule = (value: string): ParsedIngressRule | ExecutionResult => {
  const ruleText = value.trim()
  const equalsIndex = ruleText.indexOf('=')
  if (equalsIndex <= 0 || equalsIndex === ruleText.length - 1) {
    return error(
      `error: invalid ingress rule "${value}", expected host/path=service:port`
    )
  }

  const hostAndPath = ruleText.slice(0, equalsIndex).trim()
  const backend = ruleText.slice(equalsIndex + 1).trim()
  const backendParts = backend.split(':')
  if (backendParts.length !== 2) {
    return error(
      `error: invalid ingress backend "${backend}", expected service:port`
    )
  }

  const serviceName = backendParts[0].trim()
  const servicePortText = backendParts[1].trim()
  if (serviceName.length === 0 || servicePortText.length === 0) {
    return error(
      `error: invalid ingress backend "${backend}", expected service:port`
    )
  }
  const servicePort = Number.parseInt(servicePortText, 10)
  if (Number.isNaN(servicePort) || servicePort <= 0 || servicePort > 65535) {
    return error(
      `error: invalid ingress backend port "${servicePortText}", expected 1-65535`
    )
  }

  const firstSlashIndex = hostAndPath.indexOf('/')
  let host: string | undefined = undefined
  let path = '/'
  if (firstSlashIndex === -1) {
    host = hostAndPath.length > 0 ? hostAndPath : undefined
  } else {
    const hostPart = hostAndPath.slice(0, firstSlashIndex).trim()
    const pathPart = hostAndPath.slice(firstSlashIndex).trim()
    host = hostPart.length > 0 ? hostPart : undefined
    path = pathPart.length > 0 ? pathPart : '/'
  }

  return {
    host,
    path,
    serviceName,
    servicePort
  }
}

const buildIngressRules = (
  ruleFlags: string[]
): IngressRule[] | ExecutionResult => {
  const groupedRules = new Map<string, IngressRule>()
  for (const ruleFlag of ruleFlags) {
    const parsedRule = parseIngressRule(ruleFlag)
    if (!('path' in parsedRule)) {
      return parsedRule
    }
    const hostKey = parsedRule.host ?? '*'
    const existingRule = groupedRules.get(hostKey)
    if (existingRule == null) {
      groupedRules.set(hostKey, {
        ...(parsedRule.host != null ? { host: parsedRule.host } : {}),
        http: {
          paths: [
            {
              path: parsedRule.path,
              pathType: 'Prefix',
              backend: {
                service: {
                  name: parsedRule.serviceName,
                  port: {
                    number: parsedRule.servicePort
                  }
                }
              }
            }
          ]
        }
      })
      continue
    }
    existingRule.http.paths.push({
      path: parsedRule.path,
      pathType: 'Prefix',
      backend: {
        service: {
          name: parsedRule.serviceName,
          port: {
            number: parsedRule.servicePort
          }
        }
      }
    })
  }

  return Array.from(groupedRules.values())
}

export const isCreateIngressImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & {
  name: string
  createIngressRules: string[]
} => {
  if (parsed.resource !== 'ingresses') {
    return false
  }
  if (typeof parsed.name !== 'string' || parsed.name.length === 0) {
    return false
  }
  if (
    !Array.isArray(parsed.createIngressRules) ||
    parsed.createIngressRules.length === 0
  ) {
    return false
  }
  return true
}

export const buildCreateIngressDryRunManifest = (
  parsed: ParsedCommand & {
    name: string
    createIngressRules: string[]
  }
): Record<string, unknown> | ExecutionResult => {
  const rules = buildIngressRules(parsed.createIngressRules)
  if (!Array.isArray(rules)) {
    return rules
  }
  const namespace = parsed.namespace ?? 'default'
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: parsed.name,
      ...(namespace !== 'default' ? { namespace } : {})
    },
    spec: {
      ...(parsed.createIngressClassName != null
        ? { ingressClassName: parsed.createIngressClassName }
        : {}),
      rules
    }
  }
}

export const createIngressFromFlags = (
  parsed: ParsedCommand & {
    name: string
    createIngressRules: string[]
  },
  apiServer: ApiServerFacade
): ExecutionResult => {
  const rules = buildIngressRules(parsed.createIngressRules)
  if (!Array.isArray(rules)) {
    return rules
  }
  const namespace = parsed.namespace ?? 'default'
  const ingress = createIngress({
    name: parsed.name,
    namespace,
    spec: {
      ...(parsed.createIngressClassName != null
        ? { ingressClassName: parsed.createIngressClassName }
        : {}),
      rules
    }
  })
  return createResourceWithEvents(ingress, apiServer)
}
