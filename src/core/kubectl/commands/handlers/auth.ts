import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import { error, executionResultFromNeverthrow, success } from '../../../shared/result'
import { handleApply } from './apply'
import { readKubeconfigFromFileSystem } from './configKubeconfig'
import type { ParsedCommand } from '../types'
import { err as ntErr, ok as ntOk, type Result as NtResult } from 'neverthrow'
import { flatMap, map, pipe } from 'remeda'
import { dispatchByAction } from '../shared/actionDispatch'
import { buildRequiresFilenameFlagMessage } from '../shared/errorMessages'
import { formatKubectlTable } from '../output/outputHelpers'

type SubjectIdentity =
  | {
      kind: 'ServiceAccount'
      namespace: string
      name: string
      raw: string
      groups: string[]
    }
  | {
      kind: 'User'
      name: string
      raw: string
      groups: string[]
    }

type RbacRule = {
  verbs: string[]
  apiGroups?: string[]
  resources?: string[]
  resourceNames?: string[]
  nonResourceURLs?: string[]
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

const DEFAULT_AUTHENTICATED_NON_RESOURCE_URLS = [
  '/.well-known/openid-configuration/',
  '/.well-known/openid-configuration',
  '/api/*',
  '/api',
  '/apis/*',
  '/apis',
  '/healthz',
  '/healthz',
  '/livez',
  '/livez',
  '/openapi/*',
  '/openapi',
  '/openid/v1/jwks/',
  '/openid/v1/jwks',
  '/readyz',
  '/readyz',
  '/version/',
  '/version/',
  '/version',
  '/version'
]

const DEFAULT_AUTHENTICATED_SELF_SUBJECT_RULES: readonly RbacRule[] = [
  {
    verbs: ['create'],
    apiGroups: ['authentication.k8s.io'],
    resources: ['selfsubjectreviews'],
    resourceNames: [],
    nonResourceURLs: []
  },
  {
    verbs: ['create'],
    apiGroups: ['authorization.k8s.io'],
    resources: ['selfsubjectaccessreviews'],
    resourceNames: [],
    nonResourceURLs: []
  },
  {
    verbs: ['create'],
    apiGroups: ['authorization.k8s.io'],
    resources: ['selfsubjectrulesreviews'],
    resourceNames: [],
    nonResourceURLs: []
  }
]

const parseDistinctOrganizations = (subject: string): string[] => {
  const allMatches = Array.from(subject.matchAll(/O=([^,\n/]+)/g))
  const organizationCandidates = pipe(
    allMatches,
    map((match) => {
      const value = match[1]
      if (value == null) {
        return undefined
      }
      const trimmedValue = value.trim()
      if (trimmedValue.length === 0) {
        return undefined
      }
      return trimmedValue
    })
  )
  return Array.from(
    new Set(
      organizationCandidates.filter((value): value is string => {
        return value !== undefined
      })
    )
  )
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

const buildServiceAccountGroups = (namespace: string): string[] => {
  return [
    'system:serviceaccounts',
    `system:serviceaccounts:${namespace}`,
    'system:authenticated'
  ]
}

const normalizeSubject = (
  parsed: ParsedCommand,
  fileSystem: FileSystem
): SubjectIdentity => {
  const explicitSubject = parsed.authSubject
  if (explicitSubject == null || explicitSubject.length === 0) {
    const defaultIdentity = resolveDefaultUserIdentity(fileSystem)
    return {
      kind: 'User',
      name: defaultIdentity.username,
      raw: defaultIdentity.username,
      groups: defaultIdentity.groups
    }
  }

  if (!explicitSubject.startsWith('system:serviceaccount:')) {
    return {
      kind: 'User',
      name: explicitSubject,
      raw: explicitSubject,
      groups: ['system:authenticated']
    }
  }

  const parts = explicitSubject.split(':')
  const namespace = parts[2]
  const name = parts[3]
  if (namespace == null || name == null) {
    return {
      kind: 'User',
      name: explicitSubject,
      raw: explicitSubject,
      groups: ['system:authenticated']
    }
  }

  return {
    kind: 'ServiceAccount',
    namespace,
    name,
    raw: explicitSubject,
    groups: buildServiceAccountGroups(namespace)
  }
}

const subjectMatchesIdentity = (
  subject: {
    kind: 'ServiceAccount' | 'User' | 'Group'
    name: string
    namespace?: string
  },
  identity: SubjectIdentity,
  namespace: string
): boolean => {
  if (subject.kind === 'Group') {
    return identity.groups.includes(subject.name)
  }

  if (identity.kind !== 'ServiceAccount') {
    if (subject.kind !== 'User') {
      return false
    }
    return subject.name === identity.name
  }

  if (subject.kind !== 'ServiceAccount') {
    return false
  }

  return (
    subject.name === identity.name &&
    (subject.namespace ?? namespace) === identity.namespace
  )
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

const combineResourceGroup = (
  resources: string[] | undefined,
  apiGroups: string[] | undefined
): string => {
  if (resources == null || resources.length === 0) {
    return ''
  }
  const groups = apiGroups != null && apiGroups.length > 0 ? apiGroups : ['']
  const merged = flatMap(resources, (resource) => {
    return groups.map((group) => {
      if (group.length === 0) {
        return resource
      }
      return `${resource}.${group}`
    })
  })
  return merged.join(',')
}

const formatSliceLikeKubectl = (values: string[] | undefined): string => {
  if (values == null || values.length === 0) {
    return '[]'
  }
  return `[${values.join(' ')}]`
}

const buildAuthenticatedDefaultRules = (): RbacRule[] => {
  const defaultNonResourceRules = DEFAULT_AUTHENTICATED_NON_RESOURCE_URLS.map(
    (url) => {
      return {
        verbs: ['get'],
        nonResourceURLs: [url],
        resourceNames: []
      }
    }
  )
  return [...DEFAULT_AUTHENTICATED_SELF_SUBJECT_RULES, ...defaultNonResourceRules]
}

const collectEffectiveRules = (
  apiServer: ApiServerFacade,
  identity: SubjectIdentity,
  namespace: string
): RbacRule[] => {
  const roleRules = collectRoleRules(apiServer, identity, namespace)
  const clusterRoleRules = collectClusterRoleRules(apiServer, identity)
  const baseRules = [...roleRules, ...clusterRoleRules]
  if (!identity.groups.includes('system:authenticated')) {
    return baseRules
  }
  const authenticatedDefaults = buildAuthenticatedDefaultRules()
  const selfSubjectDefaults = authenticatedDefaults.filter((rule) => {
    return rule.resources != null && rule.resources.length > 0
  })
  const nonResourceDefaults = authenticatedDefaults.filter((rule) => {
    return rule.nonResourceURLs != null && rule.nonResourceURLs.length > 0
  })
  return [...selfSubjectDefaults, ...baseRules, ...nonResourceDefaults]
}

const toAuthCanIListRows = (rules: RbacRule[]): string[][] => {
  return rules.map((rule) => {
    return [
      combineResourceGroup(rule.resources, rule.apiGroups),
      formatSliceLikeKubectl(rule.nonResourceURLs),
      formatSliceLikeKubectl(rule.resourceNames),
      formatSliceLikeKubectl(rule.verbs)
    ]
  })
}

const collectRoleRules = (
  apiServer: ApiServerFacade,
  identity: SubjectIdentity,
  namespace: string
): RbacRule[] => {
  const roleBindings = apiServer.listResources('RoleBinding', namespace)
  return pipe(
    roleBindings,
    flatMap((roleBinding) => {
      const hasMatchingSubject = (roleBinding.subjects ?? []).some((subject) => {
        return subjectMatchesIdentity(subject, identity, namespace)
      })
      if (!hasMatchingSubject) {
        return []
      }
      if (roleBinding.roleRef.kind !== 'Role') {
        const clusterRoleResult = apiServer.findResource(
          'ClusterRole',
          roleBinding.roleRef.name
        )
        if (!clusterRoleResult.ok) {
          return []
        }
        return clusterRoleResult.value.rules ?? []
      }
      const roleResult = apiServer.findResource(
        'Role',
        roleBinding.roleRef.name,
        namespace
      )
      if (!roleResult.ok) {
        return []
      }
      return roleResult.value.rules ?? []
    })
  )
}

const collectClusterRoleRules = (
  apiServer: ApiServerFacade,
  identity: SubjectIdentity
): RbacRule[] => {
  const clusterRoleBindings = apiServer.listResources('ClusterRoleBinding')
  return pipe(
    clusterRoleBindings,
    flatMap((clusterRoleBinding) => {
      const hasMatchingSubject = (clusterRoleBinding.subjects ?? []).some(
        (subject) => {
          return subjectMatchesIdentity(subject, identity, '')
        }
      )
      if (!hasMatchingSubject) {
        return []
      }
      const clusterRoleResult = apiServer.findResource(
        'ClusterRole',
        clusterRoleBinding.roleRef.name
      )
      if (!clusterRoleResult.ok) {
        return []
      }
      return clusterRoleResult.value.rules ?? []
    })
  )
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
  const allRules = collectEffectiveRules(apiServer, identity, namespace)
  const isNonResourceRequest = resource.startsWith('/')
  return allRules.some((rule) => {
    const verbAllowed = includesWithWildcard(rule.verbs, verb)
    const resourceAllowed = isNonResourceRequest
      ? includesWithWildcard(rule.nonResourceURLs, resource)
      : includesWithWildcard(rule.resources, resource)
    return verbAllowed && resourceAllowed
  })
}

const resolveAuthCanIResult = (
  apiServer: ApiServerFacade,
  fileSystem: FileSystem,
  parsed: ParsedCommand
): NtResult<string, string> => {
  if (parsed.flags.list === true) {
    const namespace = parsed.namespace ?? 'default'
    const identity = normalizeSubject(parsed, fileSystem)
    const rows = toAuthCanIListRows(
      collectEffectiveRules(apiServer, identity, namespace)
    )
    if (parsed.flags['no-headers'] === true) {
      const rowsWithKubectlNoHeadersSpacing = rows.map((row) => {
        return [row[0] ?? '', row[1] ?? '', `${row[2] ?? ''} `, row[3] ?? '']
      })
      const rendered = formatKubectlTable(['', '', '', ''], rowsWithKubectlNoHeadersSpacing, {
        uppercase: false
      })
      return ntOk(rendered.split('\n').slice(1).join('\n'))
    }
    return ntOk(
      formatKubectlTable(
        ['Resources', 'Non-Resource URLs', 'Resource Names', 'Verbs'],
        rows,
        {
          uppercase: false
        }
      )
    )
  }
  if (parsed.authVerb == null || parsed.authResource == null) {
    return ntErr('auth can-i requires <verb> <resource>')
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
  return ntOk(allowed ? 'yes' : 'no')
}

const handleAuthCanI = (
  apiServer: ApiServerFacade,
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ExecutionResult => {
  return executionResultFromNeverthrow(
    resolveAuthCanIResult(apiServer, fileSystem, parsed)
  )
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
  const groups = `[${identity.groups.join(' ')}]`
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
  const reconcileResult: NtResult<string, string> =
    typeof filename === 'string' && filename.length > 0
      ? ntOk(filename)
      : ntErr(buildRequiresFilenameFlagMessage('auth reconcile'))
  if (reconcileResult.isErr()) {
    return error(reconcileResult.error)
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
  const handlers: Partial<Record<ParsedCommand['action'], () => ExecutionResult>> = {
    'auth-can-i': () => {
      return handleAuthCanI(apiServer, fileSystem, parsed)
    },
    'auth-whoami': () => {
      return handleAuthWhoAmI(fileSystem, parsed)
    },
    'auth-reconcile': () => {
      return handleAuthReconcile(fileSystem, apiServer, parsed)
    }
  }
  return dispatchByAction(parsed.action, handlers, (action) => {
    return error(`Unknown auth action: ${action}`)
  })
}
