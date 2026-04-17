import type { Action, Resource } from './types'
import type { LeafFlagDefinition } from './subcommandSpecs'

type CreateLeafSpec = {
  token: string
  pathTail: readonly string[]
  use: string
  short: string
  action: Action
  aliases?: readonly string[]
  flags?: readonly LeafFlagDefinition[]
}

export type CreateResourceSpec = CreateLeafSpec & {
  resource: Extract<
    Resource,
    | 'deployments'
    | 'ingresses'
    | 'namespaces'
    | 'clusterroles'
    | 'roles'
    | 'rolebindings'
    | 'clusterrolebindings'
    | 'configmaps'
  >
  pluralToken: string
}

export const CREATE_RESOURCE_SPECS: readonly CreateResourceSpec[] = [
  {
    token: 'deployment',
    pathTail: ['deployment'],
    resource: 'deployments',
    pluralToken: 'deployments',
    use: 'create deployment NAME --image=image [--replicas=COUNT] [--port=PORT]',
    short: 'Create a deployment with the specified name',
    action: 'create',
    flags: [
      { kind: 'stringArray', name: 'image', description: 'Image name' },
      { kind: 'string', name: 'replicas', description: 'Replica count' },
      { kind: 'string', name: 'port', description: 'Port number' },
      { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
      {
        kind: 'enum',
        name: 'dry-run',
        description: 'Must be none, server or client',
        enumValues: ['none', 'server', 'client']
      }
    ]
  },
  {
    token: 'ingress',
    pathTail: ['ingress'],
    resource: 'ingresses',
    pluralToken: 'ingresses',
    use: 'create ingress NAME --rule=host/path=service:port [--class=ingressClassName]',
    short: 'Create an ingress from imperative flags',
    action: 'create',
    flags: [
      {
        kind: 'stringArray',
        name: 'rule',
        description: 'Host/path backend rule'
      },
      { kind: 'string', name: 'class', description: 'Ingress class name' },
      { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
      {
        kind: 'enum',
        name: 'dry-run',
        description: 'Must be none, server or client',
        enumValues: ['none', 'server', 'client']
      }
    ]
  },
  {
    token: 'namespace',
    pathTail: ['namespace'],
    resource: 'namespaces',
    pluralToken: 'namespaces',
    use: 'create namespace NAME [--dry-run=none|server|client] [-o output]',
    short: 'Create a namespace',
    action: 'create',
    aliases: ['ns'],
    flags: [
      { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
      {
        kind: 'enum',
        name: 'dry-run',
        description: 'Must be none, server or client',
        enumValues: ['none', 'server', 'client']
      }
    ]
  },
  {
    token: 'clusterrole',
    pathTail: ['clusterrole'],
    resource: 'clusterroles',
    pluralToken: 'clusterroles',
    use: 'create clusterrole NAME [--verb=verbs] [--resource=resources] [--dry-run=none|server|client] [-o output]',
    short: 'Create a ClusterRole',
    action: 'create',
    flags: [
      {
        kind: 'stringArray',
        name: 'verb',
        description: 'Verbs allowed on the resources'
      },
      {
        kind: 'stringArray',
        name: 'resource',
        description: 'Resources this rule applies to'
      },
      { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
      {
        kind: 'enum',
        name: 'dry-run',
        description: 'Must be none, server or client',
        enumValues: ['none', 'server', 'client']
      }
    ]
  },
  {
    token: 'role',
    pathTail: ['role'],
    resource: 'roles',
    pluralToken: 'roles',
    use: 'create role NAME --verb=verbs --resource=resources [--dry-run=none|server|client] [-o output]',
    short: 'Create a Role',
    action: 'create',
    flags: [
      {
        kind: 'stringArray',
        name: 'verb',
        description: 'Verbs allowed on the resources'
      },
      {
        kind: 'stringArray',
        name: 'resource',
        description: 'Resources this rule applies to'
      },
      { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
      {
        kind: 'enum',
        name: 'dry-run',
        description: 'Must be none, server or client',
        enumValues: ['none', 'server', 'client']
      }
    ]
  },
  {
    token: 'rolebinding',
    pathTail: ['rolebinding'],
    resource: 'rolebindings',
    pluralToken: 'rolebindings',
    use: 'create rolebinding NAME --role=ROLE --serviceaccount=NAMESPACE:NAME [--dry-run=none|server|client] [-o output]',
    short: 'Create a RoleBinding',
    action: 'create',
    flags: [
      {
        kind: 'string',
        name: 'role',
        description: 'Role or ClusterRole to bind'
      },
      {
        kind: 'string',
        name: 'serviceaccount',
        description: 'ServiceAccount subject in namespace:name form'
      },
      { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
      {
        kind: 'enum',
        name: 'dry-run',
        description: 'Must be none, server or client',
        enumValues: ['none', 'server', 'client']
      }
    ]
  },
  {
    token: 'clusterrolebinding',
    pathTail: ['clusterrolebinding'],
    resource: 'clusterrolebindings',
    pluralToken: 'clusterrolebindings',
    use: 'create clusterrolebinding NAME --clusterrole=ROLE --serviceaccount=NAMESPACE:NAME [--dry-run=none|server|client] [-o output]',
    short: 'Create a ClusterRoleBinding',
    action: 'create',
    flags: [
      {
        kind: 'string',
        name: 'clusterrole',
        description: 'ClusterRole to bind'
      },
      {
        kind: 'string',
        name: 'serviceaccount',
        description: 'ServiceAccount subject in namespace:name form'
      },
      { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
      {
        kind: 'enum',
        name: 'dry-run',
        description: 'Must be none, server or client',
        enumValues: ['none', 'server', 'client']
      }
    ]
  },
  {
    token: 'configmap',
    pathTail: ['configmap'],
    resource: 'configmaps',
    pluralToken: 'configmaps',
    use: 'create configmap NAME --from-literal=key=value [--dry-run=none|server|client] [-o output]',
    short: 'Create a configmap from literal values',
    action: 'create',
    aliases: ['cm'],
    flags: [
      {
        kind: 'stringArray',
        name: 'from-literal',
        description: 'Literal key=value entries'
      },
      { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
      {
        kind: 'enum',
        name: 'dry-run',
        description: 'Must be none, server or client',
        enumValues: ['none', 'server', 'client']
      }
    ]
  }
] as const

export const CREATE_SERVICE_SUBCOMMAND_SPECS = [
  {
    token: 'clusterip',
    use: 'create service clusterip NAME --tcp=port:targetPort [--dry-run=none|server|client] [-o output]',
    short: 'Create a ClusterIP service'
  },
  {
    token: 'nodeport',
    use: 'create service nodeport NAME --tcp=port:targetPort [--node-port=port] [--dry-run=none|server|client] [-o output]',
    short: 'Create a NodePort service'
  },
  {
    token: 'loadbalancer',
    use: 'create service loadbalancer NAME --tcp=port:targetPort [--dry-run=none|server|client] [-o output]',
    short: 'Create a LoadBalancer service'
  },
  {
    token: 'externalname',
    use: 'create service externalname NAME --external-name=dns.name [--dry-run=none|server|client] [-o output]',
    short: 'Create an ExternalName service'
  }
] as const

export const CREATE_SECRET_SUBCOMMAND_SPECS = [
  {
    token: 'generic',
    use: 'create secret generic NAME [--from-literal=key=value] [--from-file=[key=]path] [--from-env-file=path]',
    short: 'Create an opaque secret'
  },
  {
    token: 'tls',
    use: 'create secret tls NAME --cert=path --key=path [--dry-run=none|server|client] [-o output]',
    short: 'Create a TLS secret'
  },
  {
    token: 'docker-registry',
    use: 'create secret docker-registry NAME --docker-server=server --docker-username=user --docker-password=pass [--docker-email=email]',
    short: 'Create a docker-registry secret'
  }
] as const

export const CREATE_TOKEN_SPEC: CreateLeafSpec = {
  token: 'token',
  pathTail: ['token'],
  use: 'create token SERVICEACCOUNT',
  short: 'Create a token for a ServiceAccount',
  action: 'create-token'
}

export const CREATE_SERVICE_COMMON_FLAGS: readonly LeafFlagDefinition[] = [
  { kind: 'string', name: 'tcp', description: 'Port mapping list' },
  { kind: 'string', name: 'node-port', description: 'NodePort value' },
  { kind: 'string', name: 'external-name', description: 'External DNS name' },
  { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
  {
    kind: 'enum',
    name: 'dry-run',
    description: 'Must be none, server or client',
    enumValues: ['none', 'server', 'client']
  }
] as const

export const CREATE_SECRET_GENERIC_FLAGS: readonly LeafFlagDefinition[] = [
  {
    kind: 'stringArray',
    name: 'from-literal',
    description: 'Literal key=value entries'
  },
  {
    kind: 'stringArray',
    name: 'from-file',
    description: 'File source entries'
  },
  {
    kind: 'stringArray',
    name: 'from-env-file',
    description: 'Env file entries'
  },
  { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
  {
    kind: 'enum',
    name: 'dry-run',
    description: 'Must be none, server or client',
    enumValues: ['none', 'server', 'client']
  }
] as const

export const CREATE_SECRET_TLS_FLAGS: readonly LeafFlagDefinition[] = [
  { kind: 'string', name: 'cert', description: 'Certificate path' },
  { kind: 'string', name: 'key', description: 'Private key path' },
  { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
  {
    kind: 'enum',
    name: 'dry-run',
    description: 'Must be none, server or client',
    enumValues: ['none', 'server', 'client']
  }
] as const

export const CREATE_SECRET_DOCKER_REGISTRY_FLAGS: readonly LeafFlagDefinition[] = [
  { kind: 'string', name: 'docker-server', description: 'Docker server' },
  { kind: 'string', name: 'docker-username', description: 'Docker username' },
  { kind: 'string', name: 'docker-password', description: 'Docker password' },
  { kind: 'string', name: 'docker-email', description: 'Docker email' },
  { kind: 'string', name: 'output', short: 'o', description: 'Output format' },
  {
    kind: 'enum',
    name: 'dry-run',
    description: 'Must be none, server or client',
    enumValues: ['none', 'server', 'client']
  }
] as const

export const CREATE_IMPERATIVE_PLURAL_TOKENS = CREATE_RESOURCE_SPECS.map(
  (spec) => {
    return spec.pluralToken
  }
)
