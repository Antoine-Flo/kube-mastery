import {
  buildPodContainerFileSystem,
  type Pod
} from '../../cluster/ressources/Pod'
import { createFileSystem } from '../../filesystem/FileSystem'
import { executeShellScriptFromContext } from '../../shell/commands/executionContext'
import type { ExecutionResult } from '../../shared/result'
import { error, success } from '../../shared/result'
import { buildContainerEnvironmentVariables } from '../core/handlers/containerEnvironment'
import type { CommandContext } from '../core/CommandContext'

const ENTER_CONTAINER_PREFIX = 'ENTER_CONTAINER:'
const SHELL_COMMAND_PREFIX = 'SHELL_COMMAND:'
const PROCESS_COMMAND_PREFIX = 'PROCESS_COMMAND:'

type EnterContainerDirective = {
  namespace: string
  podName: string
  containerName: string
}

type ShellCommandDirective = {
  namespace: string
  podName: string
  containerName: string
  command: string
}

type ProcessCommandDirective = {
  processName: string
  processAction: string
  namespace: string
  podName: string
  containerName: string
}

const parseEnterContainerDirective = (
  output: string
): EnterContainerDirective | undefined => {
  if (!output.startsWith(ENTER_CONTAINER_PREFIX)) {
    return undefined
  }

  const payload = output.slice(ENTER_CONTAINER_PREFIX.length)
  const parts = payload.split(':')
  if (parts.length !== 3) {
    return undefined
  }

  const [namespace, podName, containerName] = parts

  if (
    namespace.length === 0 ||
    podName.length === 0 ||
    containerName.length === 0
  ) {
    return undefined
  }

  return { namespace, podName, containerName }
}

const parseShellCommandDirective = (
  output: string
): ShellCommandDirective | undefined => {
  if (!output.startsWith(SHELL_COMMAND_PREFIX)) {
    return undefined
  }

  const payload = output.slice(SHELL_COMMAND_PREFIX.length)
  const separatorIndex = payload.indexOf(':')
  if (separatorIndex === -1) {
    return undefined
  }

  const namespace = payload.slice(0, separatorIndex)
  const remainderAfterNamespace = payload.slice(separatorIndex + 1)
  const secondSeparatorIndex = remainderAfterNamespace.indexOf(':')
  if (secondSeparatorIndex === -1) {
    return undefined
  }

  const podName = remainderAfterNamespace.slice(0, secondSeparatorIndex)
  const remainderAfterPod = remainderAfterNamespace.slice(
    secondSeparatorIndex + 1
  )

  const thirdSeparatorIndex = remainderAfterPod.indexOf(':')
  if (thirdSeparatorIndex === -1) {
    return undefined
  }
  
  const containerName = remainderAfterPod.slice(0, thirdSeparatorIndex)
  const encodedCommand = remainderAfterPod.slice(thirdSeparatorIndex + 1)
  if (
    namespace.length === 0 ||
    podName.length === 0 ||
    containerName.length === 0 ||
    encodedCommand.length === 0
  ) {
    return undefined
  }
  let command = ''
  try {
    command = decodeURIComponent(encodedCommand)
  } catch {
    return undefined
  }
  return { namespace, podName, containerName, command }
}

const parseProcessCommandDirective = (
  output: string
): ProcessCommandDirective | undefined => {
  if (!output.startsWith(PROCESS_COMMAND_PREFIX)) {
    return undefined
  }
  const payload = output.slice(PROCESS_COMMAND_PREFIX.length)
  const parts = payload.split(':')
  if (parts.length !== 5) {
    return undefined
  }
  const [processName, processAction, namespace, podName, containerName] = parts
  if (
    processName.length === 0 ||
    processAction.length === 0 ||
    namespace.length === 0 ||
    podName.length === 0 ||
    containerName.length === 0
  ) {
    return undefined
  }
  return {
    processName,
    processAction,
    namespace,
    podName,
    containerName
  }
}

const findPodForDirective = (
  context: CommandContext,
  namespace: string,
  podName: string
): ExecutionResult & { pod?: Pod } => {
  const podResult = context.apiServer.findResource('Pod', podName, namespace)
  if (!podResult.ok) {
    return error(`Error from server (NotFound): pods "${podName}" not found`)
  }
  return {
    ok: true,
    value: '',
    pod: podResult.value
  }
}

const executeEnterContainerDirective = (
  context: CommandContext,
  directive: EnterContainerDirective
): ExecutionResult => {
  const podLookup = findPodForDirective(
    context,
    directive.namespace,
    directive.podName
  )
  if (!podLookup.ok || podLookup.pod == null) {
    return error(podLookup.ok ? 'pod not found' : podLookup.error)
  }
  const containerEntry =
    podLookup.pod._simulator.containers[directive.containerName]
  if (containerEntry == null) {
    return error(
      `Error: container ${directive.containerName} not found in pod ${directive.podName}`
    )
  }
  context.shellContextStack.pushContainerContext(
    directive.podName,
    directive.containerName,
    directive.namespace,
    containerEntry.fileSystem
  )
  context.shellContextStack.updateCurrentPrompt()
  return success('')
}

const executeShellCommandDirective = (
  context: CommandContext,
  directive: ShellCommandDirective
): ExecutionResult => {
  const podLookup = findPodForDirective(
    context,
    directive.namespace,
    directive.podName
  )
  if (!podLookup.ok || podLookup.pod == null) {
    return error(podLookup.ok ? 'pod not found' : podLookup.error)
  }
  const containerEntry =
    podLookup.pod._simulator.containers[directive.containerName]
  if (containerEntry == null) {
    return error(
      `Error: container ${directive.containerName} not found in pod ${directive.podName}`
    )
  }
  const pod = podLookup.pod
  const containerFileSystem = createFileSystem(
    containerEntry.fileSystem,
    undefined,
    {
      mutable: true
    }
  )
  return executeShellScriptFromContext(
    {
      fileSystem: containerFileSystem,
      editorModal: context.editorModal,
      runtimeOptions: {
        resolveNamespace: () => {
          return directive.namespace
        },
        runDnsLookup: (query, namespace) => {
          if (context.networkRuntime == null) {
            return error('network runtime is not available')
          }
          const dnsResult = context.networkRuntime.dnsResolver.resolveARecord(
            query,
            namespace
          )
          if (!dnsResult.ok) {
            return error(dnsResult.error)
          }
          const address = dnsResult.value.addresses[0]
          return success(
            [
              'Server:\t10.96.0.10',
              'Address:\t10.96.0.10:53',
              '',
              `Name:\t${dnsResult.value.fqdn}`,
              `Address:\t${address}`
            ].join('\n')
          )
        },
        getSimTrafficSourcePod: () => {
          return {
            name: pod.metadata.name,
            namespace: directive.namespace,
            labels: pod.metadata.labels ?? {}
          }
        },
        runCurl: (target, namespace, sourcePod) => {
          if (context.networkRuntime == null) {
            return error('network runtime is not available')
          }
          const curlResult =
            context.networkRuntime.trafficEngine.simulateHttpGet(target, {
              sourceNamespace: namespace,
              ...(sourcePod != null && { sourcePod })
            })
          if (!curlResult.ok) {
            return error(curlResult.error)
          }
          return success(curlResult.value)
        },
        getEnvironmentVariables: () => {
          return buildContainerEnvironmentVariables(
            pod,
            directive.containerName,
            context.apiServer
          )
        }
      }
    },
    directive.command
  )
}

const executeProcessCommandDirective = (
  context: CommandContext,
  directive: ProcessCommandDirective
): ExecutionResult => {
  const isNginxStop =
    directive.processName === 'nginx' && directive.processAction === 'stop'
  const isPidOneKill =
    directive.processName === 'pid1' && directive.processAction === 'kill'
  if (!isNginxStop && !isPidOneKill) {
    return error(
      `unsupported process command: ${directive.processName} ${directive.processAction}`
    )
  }
  const podLookup = findPodForDirective(
    context,
    directive.namespace,
    directive.podName
  )
  if (!podLookup.ok || podLookup.pod == null) {
    return error(podLookup.ok ? 'pod not found' : podLookup.error)
  }
  const pod = podLookup.pod
  const containerSpec = pod.spec.containers.find((container) => {
    return container.name === directive.containerName
  })
  if (containerSpec == null) {
    return error(
      `Error: container ${directive.containerName} not found in pod ${directive.podName}`
    )
  }
  if (isNginxStop && !containerSpec.image.includes('nginx')) {
    return error('nginx: command not found')
  }
  const currentContainerEntry =
    pod._simulator.containers[directive.containerName]
  if (currentContainerEntry == null) {
    return error(
      `Error: container ${directive.containerName} not found in pod ${directive.podName}`
    )
  }
  const rebuildContainerFileSystemResult = buildPodContainerFileSystem(
    pod,
    directive.containerName
  )
  if (!rebuildContainerFileSystemResult.ok) {
    return error(rebuildContainerFileSystemResult.error)
  }
  const resetFileSystem = rebuildContainerFileSystemResult.value.fileSystem
  const volumeBackings = rebuildContainerFileSystemResult.value.volumeBackings
  const transitionTime = new Date().toISOString()
  const currentStatuses = pod.status.containerStatuses ?? []
  const updatedStatuses = currentStatuses.map((status) => {
    if (status.name !== directive.containerName) {
      return status
    }
    return {
      ...status,
      ready: false,
      started: false,
      restartCount: status.restartCount + 1,
      lastRestartAt: transitionTime,
      lastStateDetails: status.stateDetails ?? status.lastStateDetails,
      stateDetails: {
        state: 'Waiting' as const,
        reason: 'ContainerCreating'
      }
    }
  })
  const updatedPod: Pod = {
    ...pod,
    status: {
      ...pod.status,
      phase: pod.status.phase === 'Running' ? 'Running' : 'Pending',
      restartCount: pod.status.restartCount + 1,
      containerStatuses: updatedStatuses
    },
    _simulator: {
      ...pod._simulator,
      previousLogs: pod._simulator.logs ?? [],
      previousLogEntries: pod._simulator.logEntries ?? [],
      logEntries: [],
      logStreamState: undefined,
      logs: [],
      volumeBackings,
      containers: {
        ...pod._simulator.containers,
        [directive.containerName]: {
          ...currentContainerEntry,
          fileSystem: resetFileSystem
        }
      }
    }
  }
  const updateResult = context.apiServer.updateResource(
    'Pod',
    directive.podName,
    updatedPod,
    directive.namespace
  )
  if (!updateResult.ok) {
    return error(updateResult.error)
  }
  return success('')
}

export const executeKubectlDirective = (
  context: CommandContext,
  output: string
): ExecutionResult | undefined => {
  const enterContainerDirective = parseEnterContainerDirective(output)
  if (enterContainerDirective != null) {
    return executeEnterContainerDirective(context, enterContainerDirective)
  }
  const shellCommandDirective = parseShellCommandDirective(output)
  if (shellCommandDirective != null) {
    return executeShellCommandDirective(context, shellCommandDirective)
  }
  const processCommandDirective = parseProcessCommandDirective(output)
  if (processCommandDirective != null) {
    return executeProcessCommandDirective(context, processCommandDirective)
  }
  return undefined
}
