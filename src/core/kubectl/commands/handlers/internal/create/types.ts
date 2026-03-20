import { createSecret } from '../../../../../cluster/ressources/Secret'
import type { ParsedCommand } from '../../../types'

export type ErrorResult = { ok: false; error: string }

export type CreateServiceType = NonNullable<ParsedCommand['createServiceType']>
export type CreateSecretType = NonNullable<ParsedCommand['createSecretType']>
export type SecretTypeConfig = Parameters<typeof createSecret>[0]['secretType']

export type ImperativeCreateServiceConfig = {
  apiVersion: 'v1'
  kind: 'Service'
  metadata: {
    name: string
    namespace?: string
    labels?: Record<string, string>
  }
  spec: {
    type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'
    selector?: Record<string, string>
    externalName?: string
    ports: Array<{
      protocol: 'TCP'
      port: number
      targetPort?: number
      nodePort?: number
    }>
  }
  status: {
    loadBalancer: Record<string, never>
  }
}

export type ImperativeCreateSecretConfig = {
  apiVersion: 'v1'
  kind: 'Secret'
  metadata: {
    name: string
    namespace?: string
  }
  type?: 'Opaque' | 'kubernetes.io/tls' | 'kubernetes.io/dockerconfigjson'
  data: Record<string, string>
}

export type PreparedSecret = {
  secretType: SecretTypeConfig
  data: Record<string, string>
  manifestType:
    | 'Opaque'
    | 'kubernetes.io/tls'
    | 'kubernetes.io/dockerconfigjson'
}
