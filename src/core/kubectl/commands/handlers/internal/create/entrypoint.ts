import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import { createClusterRole } from '../../../../../cluster/ressources/ClusterRole'
import { createClusterRoleBinding } from '../../../../../cluster/ressources/ClusterRoleBinding'
import { createRole } from '../../../../../cluster/ressources/Role'
import { createRoleBinding } from '../../../../../cluster/ressources/RoleBinding'
import type { FileSystem } from '../../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../../shared/result'
import { error } from '../../../../../shared/result'
import { parseKubernetesYaml } from '../../../../yamlParser'
import { formatKubectlFileSystemError } from '../../../filesystemErrorPresenter'
import { createResourceWithEvents } from '../../../resourceCatalog'
import { buildMustSpecifyFilenameFlagMessage } from '../../../shared/errorMessages'
import { getFilenameFromFlags } from '../../../shared/filenameFlags'
import type { ParsedCommand } from '../../../types'
import {
  buildCreateConfigMapDryRunManifest,
  createConfigMapFromFlags,
  isCreateConfigMapImperative,
  isExecutionErrorResult
} from './configMap'
import {
  buildCreateDeploymentDryRunManifest,
  createDeploymentFromFlags,
  isCreateDeploymentImperative,
  validateCreateDeploymentCommand
} from './deployment'
import {
  buildDryRunResponse,
  isDryRunRequested,
  isSupportedDryRunValue
} from './dryRunResponse'
import {
  buildCreateNamespaceDryRunManifest,
  createNamespaceFromFlags,
  isCreateNamespaceImperative
} from './namespace'
import {
  buildCreateIngressDryRunManifest,
  createIngressFromFlags,
  isCreateIngressImperative
} from './ingress'
import {
  buildCreateSecretDryRunManifest,
  createSecretFromFlags,
  isCreateSecretImperative
} from './secret'
import {
  buildCreateServiceConfig,
  createServiceFromFlags,
  isCreateServiceImperative
} from './service'

const splitCsvValues = (raw: string): string[] => {
  return raw
    .split(',')
    .map((item) => {
      return item.trim()
    })
    .filter((item) => {
      return item.length > 0
    })
}

const parseServiceAccountSubject = (
  value: string
): { namespace: string; name: string } | undefined => {
  const [namespace, name] = value.split(':', 2)
  if (namespace == null || namespace.length === 0) {
    return undefined
  }
  if (name == null || name.length === 0) {
    return undefined
  }
  return {
    namespace,
    name
  }
}

const loadAndParseYaml = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ExecutionResult & { resource?: any } => {
  const filename = getFilenameFromFlags(parsed)

  if (!filename) {
    return error(buildMustSpecifyFilenameFlagMessage())
  }

  const fileResult = fileSystem.readFileDetailed(filename as string)
  if (!fileResult.ok) {
    return error(formatKubectlFileSystemError(fileResult.error, filename))
  }

  const parseResult = parseKubernetesYaml(fileResult.value)
  if (!parseResult.ok) {
    return error(`error: ${parseResult.error}`)
  }

  return { ok: true, value: '', resource: parseResult.value }
}

export { buildDryRunResponse }

export const handleCreate = (
  fileSystem: FileSystem,
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  const dryRunFlag = parsed.flags['dry-run']
  if (!isSupportedDryRunValue(dryRunFlag)) {
    return error(
      `error: Invalid dry-run value (${String(dryRunFlag)}). Must be "none", "server", or "client".`
    )
  }

  const validationResult = validateCreateDeploymentCommand(parsed)
  if (validationResult) {
    return validationResult
  }

  if (isCreateDeploymentImperative(parsed)) {
    if (isDryRunRequested(parsed)) {
      const dryRunManifest = buildCreateDeploymentDryRunManifest(parsed)
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createDeploymentFromFlags(parsed, apiServer)
  }

  if (isCreateNamespaceImperative(parsed)) {
    if (isDryRunRequested(parsed)) {
      const dryRunManifest = buildCreateNamespaceDryRunManifest(parsed)
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createNamespaceFromFlags(parsed, apiServer)
  }

  if (isCreateServiceImperative(parsed)) {
    const serviceConfig = buildCreateServiceConfig(parsed)
    if (!('kind' in serviceConfig)) {
      return serviceConfig
    }
    if (isDryRunRequested(parsed)) {
      return buildDryRunResponse(serviceConfig, parsed)
    }
    return createServiceFromFlags(parsed, apiServer)
  }

  if (isCreateIngressImperative(parsed)) {
    if (isDryRunRequested(parsed)) {
      const dryRunManifest = buildCreateIngressDryRunManifest(parsed)
      if (isExecutionErrorResult(dryRunManifest)) {
        return dryRunManifest
      }
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createIngressFromFlags(parsed, apiServer)
  }

  if (isCreateConfigMapImperative(parsed)) {
    if (isDryRunRequested(parsed)) {
      const dryRunManifest = buildCreateConfigMapDryRunManifest(parsed)
      if (isExecutionErrorResult(dryRunManifest)) {
        return dryRunManifest
      }
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createConfigMapFromFlags(parsed, apiServer)
  }

  if (isCreateSecretImperative(parsed)) {
    if (isDryRunRequested(parsed)) {
      const dryRunManifest = buildCreateSecretDryRunManifest(fileSystem, parsed)
      if (isExecutionErrorResult(dryRunManifest)) {
        return dryRunManifest
      }
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createSecretFromFlags(fileSystem, parsed, apiServer)
  }

  if (parsed.resource === 'roles' && parsed.name != null) {
    const verbFlag = parsed.flags.verb
    const resourceFlag = parsed.flags.resource
    if (typeof verbFlag !== 'string' || typeof resourceFlag !== 'string') {
      return error('error: create role requires --verb and --resource')
    }
    const role = createRole({
      name: parsed.name,
      namespace: parsed.namespace ?? 'default',
      rules: [
        {
          verbs: splitCsvValues(verbFlag),
          resources: splitCsvValues(resourceFlag),
          apiGroups: ['']
        }
      ]
    })
    if (isDryRunRequested(parsed)) {
      return buildDryRunResponse(role, parsed)
    }
    return createResourceWithEvents(role, apiServer)
  }

  if (parsed.resource === 'clusterroles' && parsed.name != null) {
    const verbFlag = parsed.flags.verb
    const resourceFlag = parsed.flags.resource
    if (typeof verbFlag !== 'string' || typeof resourceFlag !== 'string') {
      return error('error: create clusterrole requires --verb and --resource')
    }
    const clusterRole = createClusterRole({
      name: parsed.name,
      rules: [
        {
          verbs: splitCsvValues(verbFlag),
          resources: splitCsvValues(resourceFlag),
          apiGroups: ['']
        }
      ]
    })
    if (isDryRunRequested(parsed)) {
      return buildDryRunResponse(clusterRole, parsed)
    }
    return createResourceWithEvents(clusterRole, apiServer)
  }

  if (parsed.resource === 'rolebindings' && parsed.name != null) {
    const roleFlag = parsed.flags.role
    const serviceAccountFlag = parsed.flags.serviceaccount
    if (typeof roleFlag !== 'string' || typeof serviceAccountFlag !== 'string') {
      return error('error: create rolebinding requires --role and --serviceaccount')
    }
    const subject = parseServiceAccountSubject(serviceAccountFlag)
    if (subject == null) {
      return error(
        'error: create rolebinding --serviceaccount must use namespace:name'
      )
    }
    const roleBinding = createRoleBinding({
      name: parsed.name,
      namespace: parsed.namespace ?? 'default',
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: roleFlag
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: subject.name,
          namespace: subject.namespace
        }
      ]
    })
    if (isDryRunRequested(parsed)) {
      return buildDryRunResponse(roleBinding, parsed)
    }
    return createResourceWithEvents(roleBinding, apiServer)
  }

  if (parsed.resource === 'clusterrolebindings' && parsed.name != null) {
    const clusterRoleFlag = parsed.flags.clusterrole
    const serviceAccountFlag = parsed.flags.serviceaccount
    if (
      typeof clusterRoleFlag !== 'string' ||
      typeof serviceAccountFlag !== 'string'
    ) {
      return error(
        'error: create clusterrolebinding requires --clusterrole and --serviceaccount'
      )
    }
    const subject = parseServiceAccountSubject(serviceAccountFlag)
    if (subject == null) {
      return error(
        'error: create clusterrolebinding --serviceaccount must use namespace:name'
      )
    }
    const clusterRoleBinding = createClusterRoleBinding({
      name: parsed.name,
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: clusterRoleFlag
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: subject.name,
          namespace: subject.namespace
        }
      ]
    })
    if (isDryRunRequested(parsed)) {
      return buildDryRunResponse(clusterRoleBinding, parsed)
    }
    return createResourceWithEvents(clusterRoleBinding, apiServer)
  }

  const loadResult = loadAndParseYaml(fileSystem, parsed)
  if (!loadResult.ok) {
    return loadResult
  }

  if (isDryRunRequested(parsed)) {
    return buildDryRunResponse(loadResult.resource, parsed)
  }

  return createResourceWithEvents(loadResult.resource, apiServer)
}
