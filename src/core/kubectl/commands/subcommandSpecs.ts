import type { Action, ParsedCommand } from './types'

export type LeafFlagDefinition = {
  kind: 'bool' | 'string' | 'enum' | 'stringArray'
  name: string
  description: string
  short?: string
  defaultValue?: string
  enumValues?: readonly string[]
}

export type ConfigTransformKind =
  | 'none'
  | 'contextName'
  | 'userName'
  | 'clusterName'
  | 'path'
  | 'renameContext'

export type AuthTransformKind = 'none' | 'verbResource'

export type ConfigSubcommandSpec = {
  token: string
  action: Extract<Action, `config-${string}`>
  subcommand: NonNullable<ParsedCommand['configSubcommand']>
  use: string
  short: string
  transformKind: ConfigTransformKind
  flags?: readonly LeafFlagDefinition[]
}

export type AuthSubcommandSpec = {
  token: string
  action: Extract<Action, `auth-${string}`>
  use: string
  short: string
  transformKind: AuthTransformKind
  flags?: readonly LeafFlagDefinition[]
}

const AS_SUBJECT_FLAG: LeafFlagDefinition = {
  kind: 'string',
  name: 'as',
  description: 'User to impersonate'
}

export const CONFIG_SUBCOMMAND_SPECS: readonly ConfigSubcommandSpec[] = [
  {
    token: 'get-contexts',
    action: 'config-get-contexts',
    subcommand: 'get-contexts',
    use: 'config get-contexts',
    short: 'Display one or many contexts from the kubeconfig file',
    transformKind: 'none'
  },
  {
    token: 'current-context',
    action: 'config-current-context',
    subcommand: 'current-context',
    use: 'config current-context',
    short: 'Display the current-context',
    transformKind: 'none'
  },
  {
    token: 'view',
    action: 'config-view',
    subcommand: 'view',
    use: 'config view',
    short: 'Display merged kubeconfig settings',
    transformKind: 'none',
    flags: [
      { kind: 'bool', name: 'minify', description: 'Minify output' },
      { kind: 'string', name: 'output', short: 'o', description: 'Output format' }
    ]
  },
  {
    token: 'set-context',
    action: 'config-set-context',
    subcommand: 'set-context',
    use: 'config set-context --current --namespace=NAME',
    short: 'Set a context entry in kubeconfig',
    transformKind: 'none',
    flags: [
      { kind: 'bool', name: 'current', description: 'Use current context' },
      { kind: 'string', name: 'namespace', description: 'Namespace name' }
    ]
  },
  {
    token: 'use-context',
    action: 'config-use-context',
    subcommand: 'use-context',
    use: 'config use-context NAME',
    short: 'Set the current-context in kubeconfig',
    transformKind: 'contextName'
  },
  {
    token: 'get-clusters',
    action: 'config-get-clusters',
    subcommand: 'get-clusters',
    use: 'config get-clusters',
    short: 'Display clusters from the kubeconfig file',
    transformKind: 'none'
  },
  {
    token: 'get-users',
    action: 'config-get-users',
    subcommand: 'get-users',
    use: 'config get-users',
    short: 'Display users from the kubeconfig file',
    transformKind: 'none'
  },
  {
    token: 'set-credentials',
    action: 'config-set-credentials',
    subcommand: 'set-credentials',
    use: 'config set-credentials NAME --token=TOKEN',
    short: 'Set a user entry in kubeconfig',
    transformKind: 'userName',
    flags: [{ kind: 'string', name: 'token', description: 'Bearer token' }]
  },
  {
    token: 'set-cluster',
    action: 'config-set-cluster',
    subcommand: 'set-cluster',
    use: 'config set-cluster NAME --server=URL',
    short: 'Set a cluster entry in kubeconfig',
    transformKind: 'clusterName',
    flags: [{ kind: 'string', name: 'server', description: 'API server URL' }]
  },
  {
    token: 'unset',
    action: 'config-unset',
    subcommand: 'unset',
    use: 'config unset PROPERTY_NAME',
    short: 'Unset an individual value in kubeconfig',
    transformKind: 'path'
  },
  {
    token: 'rename-context',
    action: 'config-rename-context',
    subcommand: 'rename-context',
    use: 'config rename-context OLD_NAME NEW_NAME',
    short: 'Rename a context from kubeconfig',
    transformKind: 'renameContext'
  }
] as const

export const AUTH_SUBCOMMAND_SPECS: readonly AuthSubcommandSpec[] = [
  {
    token: 'can-i',
    action: 'auth-can-i',
    use: 'auth can-i VERB RESOURCE [--as=SUBJECT]',
    short: 'Check whether an action is allowed',
    transformKind: 'verbResource',
    flags: [
      AS_SUBJECT_FLAG,
      {
        kind: 'bool',
        name: 'list',
        description: 'If true, prints all allowed actions'
      },
      {
        kind: 'bool',
        name: 'no-headers',
        description: 'If true, prints allowed actions without headers'
      }
    ]
  },
  {
    token: 'whoami',
    action: 'auth-whoami',
    use: 'auth whoami [--as=SUBJECT]',
    short: 'Display the current user identity',
    transformKind: 'none',
    flags: [AS_SUBJECT_FLAG]
  },
  {
    token: 'reconcile',
    action: 'auth-reconcile',
    use: 'auth reconcile -f FILENAME',
    short: 'Reconcile RBAC roles from a file',
    transformKind: 'none',
    flags: [
      { kind: 'string', name: 'filename', short: 'f', description: 'File path' }
    ]
  }
] as const
