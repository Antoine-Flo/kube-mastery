import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { handleApply } from './apply'
import { readKubeconfigFromFileSystem } from './configKubeconfig'
import type { ParsedCommand } from '../types'

type SubjectIdentity =
  | {
      kind: 'ServiceAccount'
      namespace: string
      name: string
      raw: string
    }
  | {
      kind: 'User'
      name: string
      raw: string
    }

type RbacRule = {
  verbs: string[]
  resources?: string[]
}

type DefaultUserIdentity = {
  username: string
  groups: string[]
  credentialId?: string
}

const DEFAULT_KUBERNETES_ADMIN_GROUPS = [
  'kubeadm:cluster-admins',
  'system:authenticated'
]

const parseDistinctOrganizations = (subject: string): string[] => {
  const organizations: string[] = []
  const matcher = /O=([^,\n/]+)/g
  let match = matcher.exec(subject)
  while (match != null) {
    const value = match[1]?.trim()
    if (value != null && value.length > 0 && !organizations.includes(value)) {
      organizations.push(value)
    }
    match = matcher.exec(subject)
  }
  return organizations
}

const parseCommonName = (subject: string): string | undefined => {
  const match = /CN=([^,\n/]+)/.exec(subject)
  const value = match?.[1]?.trim()
  if (value == null || value.length === 0) {
    return undefined
  }
  return value
}

type NodeCryptoCompat = {
  X509Certificate: new (buffer: Uint8Array) => { subject: string }
  createHash: (algorithm: 'sha256') => {
    update: (input: Uint8Array) => {
      digest: (encoding: 'hex') => string
    }
  }
}

const loadNodeCryptoCompat = (): NodeCryptoCompat | null => {
  const globalRequire = (globalThis as { require?: (id: string) => unknown })
    .require
  if (typeof globalRequire === 'function') {
    try {
      return globalRequire('node:crypto') as NodeCryptoCompat
    } catch {
      return null
    }
  }
  return null
}

const decodeBase64ToBytes = (value: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64')
  }
  const decoded = globalThis.atob(value)
  const bytes = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i)
  }
  return bytes
}

const createCredentialId = (
  nodeCrypto: NodeCryptoCompat,
  certificateBytes: Uint8Array
): string => {
  const fingerprint = nodeCrypto
    .createHash('sha256')
    .update(certificateBytes)
    .digest('hex')
  return `X509SHA256=${fingerprint}`
}

const resolveDefaultUserIdentity = (
  fileSystem: FileSystem
): DefaultUserIdentity => {
  const kubeconfigResult = readKubeconfigFromFileSystem(fileSystem)
  if (!kubeconfigResult.ok) {
    return {
      username: 'kubernetes-admin',
      groups: DEFAULT_KUBERNETES_ADMIN_GROUPS
    }
  }
  const kubeconfig = kubeconfigResult.value
  const currentContextName = kubeconfig['current-context']
  const currentContext = kubeconfig.contexts.find((entry) => {
    return entry.name === currentContextName
  })
  const contextUserName = currentContext?.context.user
  if (contextUserName == null || contextUserName.length === 0) {
    return {
      username: 'kubernetes-admin',
      groups: DEFAULT_KUBERNETES_ADMIN_GROUPS
    }
  }
  const userEntry = kubeconfig.users.find((entry) => {
    return entry.name === contextUserName
  })
  const certificateData = userEntry?.user['client-certificate-data']
  if (typeof certificateData === 'string' && certificateData.length > 0) {
    const nodeCrypto = loadNodeCryptoCompat()
    if (nodeCrypto == null) {
      return {
        username: 'kubernetes-admin',
        groups: DEFAULT_KUBERNETES_ADMIN_GROUPS
      }
    }
    try {
      const certificateBuffer = decodeBase64ToBytes(certificateData)
      const certificate = new nodeCrypto.X509Certificate(certificateBuffer)
      const organizations = parseDistinctOrganizations(certificate.subject)
      const groups = organizations.includes('system:authenticated')
        ? organizations
        : [...organizations, 'system:authenticated']
      return {
        username: parseCommonName(certificate.subject) ?? 'kubernetes-admin',
        groups:
          groups.length > 0 ? groups : ['system:authenticated'],
        credentialId: createCredentialId(nodeCrypto, certificateBuffer)
      }
    } catch {
      return {
        username: 'kubernetes-admin',
        groups: DEFAULT_KUBERNETES_ADMIN_GROUPS
      }
    }
  }

  const directUsername = userEntry?.user.username
  if (typeof directUsername === 'string' && directUsername.length > 0) {
    return {
      username: directUsername,
      groups: ['system:authenticated']
    }
  }

  return {
    username: 'kubernetes-admin',
    groups: DEFAULT_KUBERNETES_ADMIN_GROUPS
  }
}

const normalizeSubject = (
  parsed: ParsedCommand,
  fileSystem: FileSystem
): SubjectIdentity => {
  const explicitSubject = parsed.authSubject
  if (explicitSubject != null && explicitSubject.length > 0) {
    if (explicitSubject.startsWith('system:serviceaccount:')) {
      const parts = explicitSubject.split(':')
      const namespace = parts[2]
      const name = parts[3]
      if (namespace != null && name != null) {
        return {
          kind: 'ServiceAccount',
          namespace,
          name,
          raw: explicitSubject
        }
      }
    }
    return {
      kind: 'User',
      name: explicitSubject,
      raw: explicitSubject
    }
  }

  const defaultIdentity = resolveDefaultUserIdentity(fileSystem)
  return {
    kind: 'User',
    name: defaultIdentity.username,
    raw: defaultIdentity.username
  }
}

const includesWithWildcard = (
  values: string[] | undefined,
  target: string
): boolean => {
  if (values == null || values.length === 0) {
    return false
  }
  if (values.includes('*')) {
    return true
  }
  return values.includes(target)
}

const collectRoleRules = (
  apiServer: ApiServerFacade,
  identity: SubjectIdentity,
  namespace: string
): RbacRule[] => {
  const roleRules: RbacRule[] = []
  const roleBindings = apiServer.listResources('RoleBinding', namespace)
  for (const roleBinding of roleBindings) {
    const hasMatchingSubject = (roleBinding.subjects ?? []).some((subject) => {
      if (identity.kind === 'ServiceAccount') {
        return (
          subject.kind === 'ServiceAccount' &&
          subject.name === identity.name &&
          (subject.namespace ?? namespace) === identity.namespace
        )
      }
      return subject.kind === 'User' && subject.name === identity.name
    })
    if (!hasMatchingSubject) {
      continue
    }
    if (roleBinding.roleRef.kind === 'Role') {
      const roleResult = apiServer.findResource(
        'Role',
        roleBinding.roleRef.name,
        namespace
      )
      if (roleResult.ok) {
        roleRules.push(...(roleResult.value.rules ?? []))
      }
      continue
    }
    const clusterRoleResult = apiServer.findResource(
      'ClusterRole',
      roleBinding.roleRef.name
    )
    if (clusterRoleResult.ok) {
      roleRules.push(...(clusterRoleResult.value.rules ?? []))
    }
  }
  return roleRules
}

const collectClusterRoleRules = (
  apiServer: ApiServerFacade,
  identity: SubjectIdentity
): RbacRule[] => {
  const rules: RbacRule[] = []
  const clusterRoleBindings = apiServer.listResources('ClusterRoleBinding')
  for (const clusterRoleBinding of clusterRoleBindings) {
    const hasMatchingSubject = (clusterRoleBinding.subjects ?? []).some(
      (subject) => {
        if (identity.kind === 'ServiceAccount') {
          return (
            subject.kind === 'ServiceAccount' &&
            subject.name === identity.name &&
            subject.namespace === identity.namespace
          )
        }
        return subject.kind === 'User' && subject.name === identity.name
      }
    )
    if (!hasMatchingSubject) {
      continue
    }
    const clusterRoleResult = apiServer.findResource(
      'ClusterRole',
      clusterRoleBinding.roleRef.name
    )
    if (clusterRoleResult.ok) {
      rules.push(...(clusterRoleResult.value.rules ?? []))
    }
  }
  return rules
}

const canIdentity = (
  apiServer: ApiServerFacade,
  identity: SubjectIdentity,
  namespace: string,
  verb: string,
  resource: string
): boolean => {
  if (identity.raw === 'kubernetes-admin') {
    return true
  }
  const roleRules = collectRoleRules(apiServer, identity, namespace)
  const clusterRoleRules = collectClusterRoleRules(apiServer, identity)
  const allRules = [...roleRules, ...clusterRoleRules]
  return allRules.some((rule) => {
    const verbAllowed = includesWithWildcard(rule.verbs, verb)
    const resourceAllowed = includesWithWildcard(rule.resources, resource)
    return verbAllowed && resourceAllowed
  })
}

const handleAuthCanI = (
  apiServer: ApiServerFacade,
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ExecutionResult => {
  if (parsed.authVerb == null || parsed.authResource == null) {
    return error('auth can-i requires <verb> <resource>')
  }
  const namespace = parsed.namespace ?? 'default'
  const identity = normalizeSubject(parsed, fileSystem)
  const allowed = canIdentity(
    apiServer,
    identity,
    namespace,
    parsed.authVerb,
    parsed.authResource
  )
  return success(allowed ? 'yes' : 'no')
}

const handleAuthWhoAmI = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ExecutionResult => {
  const explicitSubject = parsed.authSubject
  if (explicitSubject == null || explicitSubject.length === 0) {
    const defaultIdentity = resolveDefaultUserIdentity(fileSystem)
    const outputRows = [
      'ATTRIBUTE                                           VALUE',
      `Username                                            ${defaultIdentity.username}`,
      `Groups                                              [${defaultIdentity.groups.join(' ')}]`
    ]
    if (
      defaultIdentity.credentialId != null &&
      defaultIdentity.credentialId.length > 0
    ) {
      outputRows.push(
        `Extra: authentication.kubernetes.io/credential-id   [${defaultIdentity.credentialId}]`
      )
    }
    return success(outputRows.join('\n'))
  }

  const identity = normalizeSubject(parsed, fileSystem)
  const groups =
    identity.kind === 'ServiceAccount'
      ? `[system:serviceaccounts system:serviceaccounts:${identity.namespace} system:authenticated]`
      : '[system:authenticated]'
  const output = [
    'ATTRIBUTE   VALUE',
    `Username    ${identity.raw}`,
    `Groups      ${groups}`
  ].join('\n')
  return success(output)
}

const handleAuthReconcile = (
  fileSystem: FileSystem,
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  const filename = parsed.flags.filename ?? parsed.flags.f
  if (typeof filename !== 'string' || filename.length === 0) {
    return error('auth reconcile requires one of -f or --filename')
  }
  return handleApply(fileSystem, apiServer, {
    ...parsed,
    action: 'apply',
    resource: 'pods'
  })
}

export const handleAuth = (
  fileSystem: FileSystem,
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  if (parsed.action === 'auth-can-i') {
    return handleAuthCanI(apiServer, fileSystem, parsed)
  }
  if (parsed.action === 'auth-whoami') {
    return handleAuthWhoAmI(fileSystem, parsed)
  }
  if (parsed.action === 'auth-reconcile') {
    return handleAuthReconcile(fileSystem, apiServer, parsed)
  }
  return error(`Unknown auth action: ${parsed.action}`)
}
