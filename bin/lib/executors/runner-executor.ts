import { readFileSync, statSync } from 'fs'
import { basename, join } from 'path'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { initializeControlPlane } from '../../../src/core/control-plane/initializers'
import { CONFIG } from '../../../src/config'
import { type ClusterNodeRole } from '../../../src/core/cluster/clusterConfig'
import { parseKubernetesYaml } from '../../../src/core/kubectl/yamlParser'
import { createKubectlExecutor } from '../../../src/core/kubectl/commands/executor'
import type { Pod } from '../../../src/core/cluster/ressources/Pod'
import { createFileSystem } from '../../../src/core/filesystem/FileSystem'
import { createDirectory } from '../../../src/core/filesystem/models/Directory'
import { createFile } from '../../../src/core/filesystem/models/File'
import { createLogger } from '../../../src/logger/Logger'
import { createConformanceBootstrapConfig } from '../../../src/core/cluster/systemBootstrap'
import { parseCommand } from '../../../src/core/kubectl/commands/parser'
import { listYamlFiles } from '../cluster-manager'
import { loadClusterNodeRoles } from '../cluster-manager'
import type {
  ApplyYamlAction,
  CommandExecutionResult,
  DeleteYamlAction,
  WaitPodsReadyAction
} from '../conformance-types'

interface ParsedManifestResource {
  kind: string
  metadata: {
    name: string
    namespace?: string
  }
}

export interface RunnerExecutor {
  executeCommand: (command: string) => CommandExecutionResult
  applyYaml: (action: ApplyYamlAction) => CommandExecutionResult
  deleteYaml: (action: DeleteYamlAction) => CommandExecutionResult
  waitPodsReady: (action: WaitPodsReadyAction) => CommandExecutionResult
}

const splitYamlDocuments = (yamlContent: string): string[] => {
  const documents = yamlContent.split(/^---\s*$/m)
  return documents.filter((doc) => doc.trim().length > 0)
}

const resolveYamlFiles = (targetPath: string): string[] => {
  const stat = statSync(targetPath)
  if (stat.isDirectory()) {
    return listYamlFiles(targetPath)
  }
  return [targetPath]
}

const parseResourcesFromPath = (
  targetPath: string
): ParsedManifestResource[] => {
  const files = resolveYamlFiles(targetPath)
  const resources: ParsedManifestResource[] = []
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8')
    const documents = splitYamlDocuments(content)
    for (const document of documents) {
      const parsed = parseKubernetesYaml(document.trim())
      if (!parsed.ok) {
        continue
      }
      resources.push({
        kind: parsed.value.kind,
        metadata: parsed.value.metadata
      })
    }
  }
  return resources
}

const buildDeleteCommand = (
  resource: ParsedManifestResource
): string | undefined => {
  const namespace = resource.metadata.namespace || 'default'
  const name = resource.metadata.name
  if (resource.kind === 'Pod') {
    return `kubectl delete pods ${name} -n ${namespace}`
  }
  if (resource.kind === 'ConfigMap') {
    return `kubectl delete configmaps ${name} -n ${namespace}`
  }
  if (resource.kind === 'Secret') {
    return `kubectl delete secrets ${name} -n ${namespace}`
  }
  if (resource.kind === 'ReplicaSet') {
    return `kubectl delete replicasets ${name} -n ${namespace}`
  }
  if (resource.kind === 'Deployment') {
    return `kubectl delete deployments ${name} -n ${namespace}`
  }
  if (resource.kind === 'Service') {
    return `kubectl delete services ${name} -n ${namespace}`
  }
  if (resource.kind === 'Ingress') {
    return `kubectl delete ingress ${name} -n ${namespace}`
  }
  return undefined
}

const createSingleFileSystem = (filePath: string) => {
  const root = createDirectory('root', '/')
  const filename = basename(filePath)
  const content = readFileSync(filePath, 'utf-8')
  root.children.set(filename, createFile(filename, `/${filename}`, content))
  return createFileSystem({
    currentPath: '/',
    tree: root
  })
}

const executionFromOutput = (
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string
): CommandExecutionResult => {
  const combined = stdout && stderr ? `${stdout}\n${stderr}` : stdout || stderr
  return {
    command,
    exitCode,
    stdout,
    stderr,
    combined
  }
}

const getDiffFilenameFromCommand = (command: string): string | undefined => {
  const parsed = parseCommand(command)
  if (!parsed.ok) {
    return undefined
  }
  if (parsed.value.action !== 'diff') {
    return undefined
  }

  const filename = parsed.value.flags.f || parsed.value.flags.filename
  if (typeof filename !== 'string') {
    return undefined
  }
  return filename
}

const rewriteDiffCommandForMountedFile = (
  command: string,
  originalPath: string,
  mountedPath: string
): string => {
  if (command.includes(`--filename=${originalPath}`)) {
    return command.replace(
      `--filename=${originalPath}`,
      `--filename=${mountedPath}`
    )
  }
  if (command.includes(`-f=${originalPath}`)) {
    return command.replace(`-f=${originalPath}`, `-f=${mountedPath}`)
  }
  if (command.includes(`--filename ${originalPath}`)) {
    return command.replace(
      `--filename ${originalPath}`,
      `--filename ${mountedPath}`
    )
  }
  if (command.includes(`-f ${originalPath}`)) {
    return command.replace(`-f ${originalPath}`, `-f ${mountedPath}`)
  }
  return command
}

const MAX_READY_PASSES = 24
const MAX_PENDING_IN_ERROR = 10

const isPodReadyForWait = (pod: Pod): boolean => {
  if (pod.status.phase === 'Succeeded') {
    return true
  }
  if (pod.status.phase !== 'Running') {
    return false
  }
  const statuses = pod.status.containerStatuses ?? []
  if (statuses.length === 0) {
    return false
  }
  for (const status of statuses) {
    if (status.ready !== true) {
      return false
    }
  }
  return true
}

export const createRunnerExecutor = (
  clusterName = CONFIG.cluster.conformanceClusterName
): RunnerExecutor => {
  const logger = createLogger({ mirrorToConsole: false })
  const nodeRolesResult = loadClusterNodeRoles()
  const nodeRoles: readonly ClusterNodeRole[] | undefined = nodeRolesResult.ok
    ? nodeRolesResult.value
    : undefined
  const apiServer = createApiServerFacade({
    bootstrap: createConformanceBootstrapConfig(clusterName, nodeRoles)
  })
  const controllers = initializeControlPlane(apiServer)
  const fileSystem = createFileSystem()
  const executor = createKubectlExecutor(
    apiServer,
    fileSystem,
    logger
  )

  const listScopedPods = (namespace?: string): Pod[] => {
    if (namespace != null && namespace.length > 0) {
      return apiServer.listResources('Pod', namespace)
    }
    return apiServer.listResources('Pod')
  }

  const countReadyContainers = (pod: Pod): number => {
    const statuses = pod.status.containerStatuses ?? []
    if (statuses.length === 0) {
      return 0
    }
    return statuses.reduce((count, status) => {
      if (status.ready === true) {
        return count + 1
      }
      return count
    }, 0)
  }

  const getStateDigest = (namespace?: string): string => {
    const pods = listScopedPods(namespace)
      .map((pod) => {
        return `${pod.metadata.namespace}/${pod.metadata.name}:${pod.status.phase}:${pod.spec.nodeName ?? ''}:${countReadyContainers(pod)}`
      })
      .sort()
      .join('|')
    const deploymentsCount = apiServer.listResources('Deployment', namespace).length
    const replicaSetsCount = apiServer.listResources('ReplicaSet', namespace).length
    const daemonSetsCount = apiServer.listResources('DaemonSet', namespace).length
    return `${deploymentsCount};${replicaSetsCount};${daemonSetsCount};${pods}`
  }

  const reconcileWorkloadControllersOnce = (namespace?: string): void => {
    const deployments = apiServer.listResources('Deployment', namespace)
    for (const deployment of deployments) {
      controllers.deploymentController.reconcile(
        `${deployment.metadata.namespace}/${deployment.metadata.name}`
      )
    }

    const replicaSets = apiServer.listResources('ReplicaSet', namespace)
    for (const replicaSet of replicaSets) {
      controllers.replicaSetController.reconcile(
        `${replicaSet.metadata.namespace}/${replicaSet.metadata.name}`
      )
    }

    const daemonSets = apiServer.listResources('DaemonSet', namespace)
    for (const daemonSet of daemonSets) {
      controllers.daemonSetController.reconcile(
        `${daemonSet.metadata.namespace}/${daemonSet.metadata.name}`
      )
    }
  }

  const reconcileSchedulingControllersOnce = (namespace?: string): void => {
    const pods = listScopedPods(namespace)
    for (const pod of pods) {
      const podKey = `${pod.metadata.namespace}/${pod.metadata.name}`
      controllers.schedulerController.reconcile(podKey)
      controllers.podLifecycleController.reconcile(podKey)
    }
  }

  const convergePodsToReady = (namespace?: string): string | undefined => {
    const formatWaitTimeoutError = (): string => {
      const unresolvedPods = listScopedPods(namespace).filter((pod) => {
        return !isPodReadyForWait(pod)
      })
      const renderedPods = unresolvedPods
        .slice(0, MAX_PENDING_IN_ERROR)
        .map((pod) => {
          return `${pod.metadata.namespace}/${pod.metadata.name}:${pod.status.phase}`
        })
        .join(', ')
      const hasMore = unresolvedPods.length > MAX_PENDING_IN_ERROR
      const suffix = hasMore ? ', ...' : ''
      const details = renderedPods.length > 0 ? renderedPods : '<none>'
      const scope =
        namespace != null && namespace.length > 0
          ? `namespace "${namespace}"`
          : 'all namespaces'
      return `Timed out waiting for pods to become Ready in ${scope}. Not ready: ${details}${suffix}`
    }

    for (let pass = 0; pass < MAX_READY_PASSES; pass++) {
      const beforeDigest = getStateDigest(namespace)
      reconcileWorkloadControllersOnce(namespace)
      reconcileSchedulingControllersOnce(namespace)

      const currentPods = listScopedPods(namespace)
      const notReadyPods = currentPods.filter((pod) => {
        return !isPodReadyForWait(pod)
      })
      if (notReadyPods.length === 0) {
        return undefined
      }
      const afterDigest = getStateDigest(namespace)
      if (beforeDigest === afterDigest) {
        return formatWaitTimeoutError()
      }
    }
    return formatWaitTimeoutError()
  }

  return {
    executeCommand(command: string): CommandExecutionResult {
      reconcileWorkloadControllersOnce()
      const diffFilename = getDiffFilenameFromCommand(command)
      let result
      if (diffFilename != null) {
        const filePath = diffFilename.startsWith('/')
          ? diffFilename
          : join(process.cwd(), diffFilename)
        const mountedPath = `/${basename(filePath)}`
        const fs = createSingleFileSystem(filePath)
        const rewrittenCommand = rewriteDiffCommandForMountedFile(
          command,
          diffFilename,
          mountedPath
        )
        result = executor.execute(rewrittenCommand, fs)
      } else {
        result = executor.execute(command)
      }

      if (result.ok) {
        const value = result.value ?? ''
        if (diffFilename != null) {
          const exitCode = value.trim().length === 0 ? 0 : 1
          return executionFromOutput(command, exitCode, value, '')
        }
        return executionFromOutput(command, 0, value, '')
      }
      return executionFromOutput(command, 1, '', result.error)
    },
    applyYaml(action: ApplyYamlAction): CommandExecutionResult {
      try {
        const files = resolveYamlFiles(action.targetPath)
        const outputs: string[] = []
        for (const filePath of files) {
          const fs = createSingleFileSystem(filePath)
          const command = `kubectl apply -f /${basename(filePath)}`
          const result = executor.execute(command, fs)
          if (!result.ok) {
            return executionFromOutput(
              `kubectl apply -f ${action.targetPath}`,
              1,
              '',
              result.error
            )
          }
          outputs.push(result.value ?? '')
        }
        if (action.waitForPods === true) {
          const waitError = convergePodsToReady(action.namespace)
          if (waitError != null) {
            return executionFromOutput(
              `kubectl apply -f ${action.targetPath}`,
              1,
              outputs.filter((line) => line.length > 0).join('\n'),
              waitError
            )
          }
        }
        return executionFromOutput(
          `kubectl apply -f ${action.targetPath}`,
          0,
          outputs.filter((line) => line.length > 0).join('\n'),
          ''
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return executionFromOutput(
          `kubectl apply -f ${action.targetPath}`,
          1,
          '',
          message
        )
      }
    },
    deleteYaml(action: DeleteYamlAction): CommandExecutionResult {
      try {
        const resources = parseResourcesFromPath(action.targetPath)
        const outputs: string[] = []
        for (const resource of resources) {
          const deleteCommand = buildDeleteCommand(resource)
          if (deleteCommand === undefined) {
            continue
          }
          const result = executor.execute(deleteCommand)
          if (!result.ok) {
            if (action.ignoreNotFound && result.error.includes('not found')) {
              continue
            }
            return executionFromOutput(
              `kubectl delete -f ${action.targetPath}`,
              1,
              '',
              result.error
            )
          }
          outputs.push(result.value ?? '')
        }
        return executionFromOutput(
          `kubectl delete -f ${action.targetPath}`,
          0,
          outputs.filter((line) => line.length > 0).join('\n'),
          ''
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return executionFromOutput(
          `kubectl delete -f ${action.targetPath}`,
          1,
          '',
          message
        )
      }
    },
    waitPodsReady(action: WaitPodsReadyAction): CommandExecutionResult {
      const command = action.namespace
        ? `kubectl wait --for=condition=Ready pod --all -n ${action.namespace}`
        : 'kubectl wait --for=condition=Ready pod --all --all-namespaces'
      const waitError = convergePodsToReady(action.namespace)
      if (waitError != null) {
        return executionFromOutput(command, 1, '', waitError)
      }
      return executionFromOutput(command, 0, 'pods ready', '')
    }
  }
}
