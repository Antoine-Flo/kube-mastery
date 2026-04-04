import { readFileSync, statSync } from 'fs'
import { basename, join } from 'path'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { initializeControlPlane } from '../../../src/core/control-plane/initializers'
import { CONFIG } from '../../../src/config'
import { type ClusterNodeRole } from '../../../src/core/cluster/clusterConfig'
import { parseKubernetesYamlDocuments } from '../../../src/core/kubectl/yamlParser'
import { createKubectlExecutor } from '../../../src/core/kubectl/commands/executor'
import type { Pod } from '../../../src/core/cluster/ressources/Pod'
import { createFileSystem } from '../../../src/core/filesystem/FileSystem'
import { createDirectory } from '../../../src/core/filesystem/models/Directory'
import { createFile } from '../../../src/core/filesystem/models/File'
import { createLogger } from '../../../src/logger/Logger'
import { createConformanceBootstrapConfig } from '../../../src/core/cluster/systemBootstrap'
import { parseCommand } from '../../../src/core/kubectl/commands/parser'
import { initializeSimNetworkRuntime } from '../../../src/core/network/SimNetworkRuntime'
import { initializeSimPodIpAllocation } from '../../../src/core/cluster/ipAllocator/SimPodIpAllocationService'
import { listYamlFiles } from '../cluster-manager'
import { loadClusterNodeRoles } from '../cluster-manager'
import type {
  ApplyYamlAction,
  CommandExecutionResult,
  DeleteYamlAction
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
    const parsed = parseKubernetesYamlDocuments(content)
    if (!parsed.ok) {
      continue
    }
    for (const resource of parsed.value) {
      resources.push({
        kind: resource.kind,
        metadata: resource.metadata
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

const getManifestFilenameFromCommand = (
  command: string
): { action: string; filename: string } | undefined => {
  const parsed = parseCommand(command)
  if (!parsed.ok) {
    return undefined
  }
  const action = parsed.value.action
  const supportsManifest =
    action === 'diff' ||
    action === 'replace' ||
    action === 'apply' ||
    action === 'create' ||
    action === 'delete'
  if (!supportsManifest) {
    return undefined
  }

  const filename = parsed.value.flags.f || parsed.value.flags.filename
  if (typeof filename !== 'string') {
    return undefined
  }
  return {
    action,
    filename
  }
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

export const createRunnerExecutor = (
  clusterName: string = CONFIG.cluster.conformanceClusterName
): RunnerExecutor => {
  const logger = createLogger({ mirrorToConsole: false })
  const nodeRolesResult = loadClusterNodeRoles()
  const nodeRoles: readonly ClusterNodeRole[] | undefined = nodeRolesResult.ok
    ? nodeRolesResult.value
    : undefined
  const apiServer = createApiServerFacade({
    bootstrap: createConformanceBootstrapConfig(
      clusterName as 'conformance',
      nodeRoles
    )
  })
  const controllers = initializeControlPlane(apiServer)
  const networkRuntime = initializeSimNetworkRuntime(apiServer)
  initializeSimPodIpAllocation(apiServer)
  const fileSystem = createFileSystem()

  const listScopedPods = (namespace?: string): Pod[] => {
    if (namespace != null && namespace.length > 0) {
      return apiServer.listResources('Pod', namespace)
    }
    return apiServer.listResources('Pod')
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

    const statefulSets = apiServer.listResources('StatefulSet', namespace)
    for (const statefulSet of statefulSets) {
      controllers.statefulSetController.reconcile(
        `${statefulSet.metadata.namespace}/${statefulSet.metadata.name}`
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

  const reconcileForWait = (namespace?: string): void => {
    reconcileWorkloadControllersOnce(namespace)
    reconcileSchedulingControllersOnce(namespace)
    networkRuntime.controller.resyncAll()
  }

  const executor = createKubectlExecutor(
    apiServer,
    fileSystem,
    logger,
    networkRuntime,
    reconcileForWait
  )

  return {
    executeCommand(command: string): CommandExecutionResult {
      reconcileForWait()
      const manifestTarget = getManifestFilenameFromCommand(command)
      let result
      if (manifestTarget != null) {
        const filePath = manifestTarget.filename.startsWith('/')
          ? manifestTarget.filename
          : join(process.cwd(), manifestTarget.filename)
        const mountedPath = `/${basename(filePath)}`
        const fs = createSingleFileSystem(filePath)
        const rewrittenCommand = rewriteDiffCommandForMountedFile(
          command,
          manifestTarget.filename,
          mountedPath
        )
        result = executor.execute(rewrittenCommand, fs)
      } else {
        result = executor.execute(command)
      }

      if (result.ok) {
        if (result.io != null) {
          return executionFromOutput(
            command,
            result.io.exitCode,
            result.io.stdout,
            result.io.stderr
          )
        }
        const value = result.value ?? ''
        if (manifestTarget?.action === 'diff') {
          const exitCode = value.trim().length === 0 ? 0 : 1
          return executionFromOutput(command, exitCode, value, '')
        }
        return executionFromOutput(command, 0, value, '')
      }
      if (result.io != null) {
        return executionFromOutput(
          command,
          result.io.exitCode,
          result.io.stdout,
          result.io.stderr
        )
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
    }
  }
}
