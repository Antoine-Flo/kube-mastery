// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Handler pour les commandes kubectl.
// Délègue l'exécution au kubectl executor.

import { createKubectlExecutor } from '../../../kubectl/commands/executor'
import { getCurrentNamespaceFromKubeconfig } from '../../../kubectl/commands/handlers/config'
import {
  createStatefulTabWriter,
  tryParseTableOutput
} from '../../../kubectl/commands/output/statefulTabWriter'
import { parseCommand } from '../../../kubectl/commands/parser'
import type { ParsedCommand, Resource } from '../../../kubectl/commands/types'
import type { Pod } from '../../../cluster/ressources/Pod'
import { createFileSystem } from '../../../filesystem/FileSystem'
import { createShellExecutor } from '../../../shell/commands'
import type { ClusterEvent } from '../../../cluster/events/types'
import { matchesLabelSelector } from '../../../shared/labelSelector'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { buildContainerEnvironmentVariables } from './containerEnvironment'
import type { CommandContext } from '../CommandContext'
import type { CommandHandler } from '../CommandHandler'

type ParsedRedirection = {
  command: string
  outputFile?: string
}

type ResourceMeta = {
  name: string
  namespace: string
  labels?: Record<string, string>
}

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

const ENTER_CONTAINER_PREFIX = 'ENTER_CONTAINER:'
const SHELL_COMMAND_PREFIX = 'SHELL_COMMAND:'
const PROCESS_COMMAND_PREFIX = 'PROCESS_COMMAND:'
const KUBECTL_EDIT_TMP_DIR = '/tmp'
const LOGS_FOLLOW_POLL_INTERVAL_MS = 1000

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
  const shellExecutor = createShellExecutor(
    containerFileSystem,
    context.editorModal,
    {
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
      runCurl: (target, namespace) => {
        if (context.networkRuntime == null) {
          return error('network runtime is not available')
        }
        const curlResult = context.networkRuntime.trafficEngine.simulateHttpGet(
          target,
          {
            sourceNamespace: namespace
          }
        )
        if (!curlResult.ok) {
          return error(curlResult.error)
        }
        return success(curlResult.value)
      },
      getEnvironmentVariables: () => {
        return buildContainerEnvironmentVariables(pod, directive.containerName)
      }
    }
  )
  return shellExecutor.execute(directive.command)
}

const executeProcessCommandDirective = (
  context: CommandContext,
  directive: ProcessCommandDirective
): ExecutionResult => {
  if (directive.processName !== 'nginx' || directive.processAction !== 'stop') {
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
  if (!containerSpec.image.includes('nginx')) {
    return error('nginx: command not found')
  }
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
      phase: 'Pending',
      restartCount: pod.status.restartCount + 1,
      containerStatuses: updatedStatuses
    },
    _simulator: {
      ...pod._simulator,
      previousLogs: pod._simulator.logs ?? [],
      previousLogEntries: pod._simulator.logEntries ?? [],
      logEntries: [],
      logStreamState: undefined,
      logs: []
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

const executeKubectlDirective = (
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

const WATCH_EVENT_TYPES_BY_RESOURCE: Record<Resource, string[]> = {
  all: [
    'PodCreated',
    'PodUpdated',
    'PodDeleted',
    'ConfigMapCreated',
    'ConfigMapUpdated',
    'ConfigMapDeleted',
    'SecretCreated',
    'SecretUpdated',
    'SecretDeleted',
    'ReplicaSetCreated',
    'ReplicaSetUpdated',
    'ReplicaSetDeleted',
    'DaemonSetCreated',
    'DaemonSetUpdated',
    'DaemonSetDeleted',
    'DeploymentCreated',
    'DeploymentUpdated',
    'DeploymentDeleted',
    'StatefulSetCreated',
    'StatefulSetUpdated',
    'StatefulSetDeleted',
    'ServiceCreated',
    'ServiceUpdated',
    'ServiceDeleted',
    'PersistentVolumeCreated',
    'PersistentVolumeUpdated',
    'PersistentVolumeDeleted',
    'PersistentVolumeClaimCreated',
    'PersistentVolumeClaimUpdated',
    'PersistentVolumeClaimDeleted',
    'LeaseCreated',
    'LeaseUpdated',
    'LeaseDeleted'
  ],
  pods: ['PodCreated', 'PodUpdated', 'PodDeleted', 'PodBound'],
  configmaps: ['ConfigMapCreated', 'ConfigMapUpdated', 'ConfigMapDeleted'],
  secrets: ['SecretCreated', 'SecretUpdated', 'SecretDeleted'],
  nodes: [],
  replicasets: ['ReplicaSetCreated', 'ReplicaSetUpdated', 'ReplicaSetDeleted'],
  daemonsets: ['DaemonSetCreated', 'DaemonSetUpdated', 'DaemonSetDeleted'],
  deployments: ['DeploymentCreated', 'DeploymentUpdated', 'DeploymentDeleted'],
  statefulsets: [
    'StatefulSetCreated',
    'StatefulSetUpdated',
    'StatefulSetDeleted'
  ],
  services: ['ServiceCreated', 'ServiceUpdated', 'ServiceDeleted'],
  endpoints: ['EndpointsCreated', 'EndpointsUpdated', 'EndpointsDeleted'],
  endpointslices: [
    'EndpointSliceCreated',
    'EndpointSliceUpdated',
    'EndpointSliceDeleted'
  ],
  ingresses: [],
  ingressclasses: [],
  namespaces: [],
  persistentvolumes: [
    'PersistentVolumeCreated',
    'PersistentVolumeUpdated',
    'PersistentVolumeDeleted'
  ],
  persistentvolumeclaims: [
    'PersistentVolumeClaimCreated',
    'PersistentVolumeClaimUpdated',
    'PersistentVolumeClaimDeleted'
  ],
  leases: ['LeaseCreated', 'LeaseUpdated', 'LeaseDeleted']
}

const isWatchEnabled = (parsed: ParsedCommand): boolean => {
  return (
    parsed.flags['watch'] === true ||
    parsed.flags['w'] === true ||
    parsed.flags['watch-only'] === true
  )
}

const isWatchOnly = (parsed: ParsedCommand): boolean => {
  return parsed.flags['watch-only'] === true
}

const getWatchEventTypes = (resource: Resource | undefined): string[] => {
  if (resource == null) {
    return []
  }
  return WATCH_EVENT_TYPES_BY_RESOURCE[resource]
}

const isAllNamespaces = (parsed: ParsedCommand): boolean => {
  return parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true
}

const getEffectiveNamespace = (
  parsed: ParsedCommand,
  context: CommandContext
): string | undefined => {
  if (isAllNamespaces(parsed)) {
    return undefined
  }
  if (parsed.namespace != null) {
    return parsed.namespace
  }
  return getCurrentNamespaceFromKubeconfig(context.fileSystem) ?? 'default'
}

const extractMetaFromClusterEvent = (
  event: ClusterEvent,
  parsedResource: Resource
): ResourceMeta | undefined => {
  if (parsedResource === 'pods') {
    if (event.type === 'PodDeleted') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.deletedPod.metadata.labels
      }
    }
    if (event.type === 'PodCreated') {
      return {
        name: event.payload.pod.metadata.name,
        namespace: event.payload.pod.metadata.namespace,
        labels: event.payload.pod.metadata.labels
      }
    }
    if (event.type === 'PodUpdated' || event.type === 'PodBound') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.pod.metadata.labels
      }
    }
  }
  if (parsedResource === 'configmaps') {
    if (event.type === 'ConfigMapCreated') {
      return {
        name: event.payload.configMap.metadata.name,
        namespace: event.payload.configMap.metadata.namespace,
        labels: event.payload.configMap.metadata.labels
      }
    }
    if (event.type === 'ConfigMapUpdated') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.configMap.metadata.labels
      }
    }
    if (event.type === 'ConfigMapDeleted') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.deletedConfigMap.metadata.labels
      }
    }
  }
  if (parsedResource === 'secrets') {
    if (event.type === 'SecretCreated') {
      return {
        name: event.payload.secret.metadata.name,
        namespace: event.payload.secret.metadata.namespace,
        labels: event.payload.secret.metadata.labels
      }
    }
    if (event.type === 'SecretUpdated') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.secret.metadata.labels
      }
    }
    if (event.type === 'SecretDeleted') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.deletedSecret.metadata.labels
      }
    }
  }
  if (parsedResource === 'services') {
    if (event.type === 'ServiceCreated') {
      return {
        name: event.payload.service.metadata.name,
        namespace: event.payload.service.metadata.namespace,
        labels: event.payload.service.metadata.labels
      }
    }
    if (event.type === 'ServiceUpdated') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.service.metadata.labels
      }
    }
    if (event.type === 'ServiceDeleted') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.deletedService.metadata.labels
      }
    }
  }
  if (parsedResource === 'deployments') {
    if (event.type === 'DeploymentCreated') {
      return {
        name: event.payload.deployment.metadata.name,
        namespace: event.payload.deployment.metadata.namespace,
        labels: event.payload.deployment.metadata.labels
      }
    }
    if (event.type === 'DeploymentUpdated') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.deployment.metadata.labels
      }
    }
    if (event.type === 'DeploymentDeleted') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.deletedDeployment.metadata.labels
      }
    }
  }
  if (parsedResource === 'replicasets') {
    if (event.type === 'ReplicaSetCreated') {
      return {
        name: event.payload.replicaSet.metadata.name,
        namespace: event.payload.replicaSet.metadata.namespace,
        labels: event.payload.replicaSet.metadata.labels
      }
    }
    if (event.type === 'ReplicaSetUpdated') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.replicaSet.metadata.labels
      }
    }
    if (event.type === 'ReplicaSetDeleted') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.deletedReplicaSet.metadata.labels
      }
    }
  }
  if (parsedResource === 'daemonsets') {
    if (event.type === 'DaemonSetCreated') {
      return {
        name: event.payload.daemonSet.metadata.name,
        namespace: event.payload.daemonSet.metadata.namespace,
        labels: event.payload.daemonSet.metadata.labels
      }
    }
    if (event.type === 'DaemonSetUpdated') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.daemonSet.metadata.labels
      }
    }
    if (event.type === 'DaemonSetDeleted') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.deletedDaemonSet.metadata.labels
      }
    }
  }
  if (parsedResource === 'persistentvolumeclaims') {
    if (event.type === 'PersistentVolumeClaimCreated') {
      return {
        name: event.payload.persistentVolumeClaim.metadata.name,
        namespace: event.payload.persistentVolumeClaim.metadata.namespace,
        labels: event.payload.persistentVolumeClaim.metadata.labels
      }
    }
    if (event.type === 'PersistentVolumeClaimUpdated') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.persistentVolumeClaim.metadata.labels
      }
    }
    if (event.type === 'PersistentVolumeClaimDeleted') {
      return {
        name: event.payload.name,
        namespace: event.payload.namespace,
        labels: event.payload.deletedPersistentVolumeClaim.metadata.labels
      }
    }
  }
  if (parsedResource === 'persistentvolumes') {
    if (event.type === 'PersistentVolumeCreated') {
      return {
        name: event.payload.persistentVolume.metadata.name,
        namespace: '',
        labels: event.payload.persistentVolume.metadata.labels
      }
    }
    if (event.type === 'PersistentVolumeUpdated') {
      return {
        name: event.payload.name,
        namespace: '',
        labels: event.payload.persistentVolume.metadata.labels
      }
    }
    if (event.type === 'PersistentVolumeDeleted') {
      return {
        name: event.payload.name,
        namespace: '',
        labels: event.payload.deletedPersistentVolume.metadata.labels
      }
    }
  }
  return undefined
}

const shouldRenderEvent = (
  event: ClusterEvent,
  parsed: ParsedCommand,
  effectiveNamespace: string | undefined
): boolean => {
  const resource = parsed.resource
  if (resource == null) {
    return false
  }
  const watchedEvents = getWatchEventTypes(resource)
  if (!watchedEvents.includes(event.type)) {
    return false
  }
  if (resource === 'all') {
    return true
  }
  const meta = extractMetaFromClusterEvent(event, resource)
  if (meta == null) {
    return true
  }
  if (
    effectiveNamespace != null &&
    meta.namespace.length > 0 &&
    meta.namespace !== effectiveNamespace
  ) {
    return false
  }
  const queryNames =
    parsed.names != null && parsed.names.length > 0
      ? parsed.names
      : parsed.name != null
        ? [parsed.name]
        : undefined
  if (queryNames != null && !queryNames.includes(meta.name)) {
    return false
  }
  if (!matchesLabelSelector(parsed.selector, meta.labels)) {
    return false
  }
  return true
}

const extractWatchLines = (
  output: string,
  stripTableHeader: boolean
): string[] => {
  const lines = output.split('\n').filter((line) => line.length > 0)
  if (!stripTableHeader) {
    return lines
  }
  if (lines.length <= 1) {
    return lines
  }
  const firstLine = lines[0].trim()
  if (!/^NAME(\s+|$)/.test(firstLine)) {
    return lines
  }
  return lines.slice(1)
}

const buildWatchDeltaOutput = (
  previousOutput: string,
  nextOutput: string,
  stripTableHeader: boolean
): string => {
  if (nextOutput.length === 0) {
    return ''
  }
  if (previousOutput.length === 0) {
    const initialLines = extractWatchLines(nextOutput, stripTableHeader)
    return initialLines.join('\n')
  }

  const previousLines = extractWatchLines(previousOutput, stripTableHeader)
  const nextLines = extractWatchLines(nextOutput, stripTableHeader)
  if (nextLines.length === 0) {
    return ''
  }

  if (!stripTableHeader) {
    const previousRows = new Set(previousLines)
    const changedRows = nextLines.filter((row) => !previousRows.has(row))
    if (changedRows.length === 0) {
      return ''
    }
    return changedRows.join('\n')
  }

  const previousRows = new Set(previousLines)
  const changedRows = nextLines.filter((row) => !previousRows.has(row))
  if (changedRows.length === 0) {
    return ''
  }
  return changedRows.join('\n')
}

const isLogsFollowEnabled = (parsedCommand: ParsedCommand): boolean => {
  if (parsedCommand.action !== 'logs') {
    return false
  }
  if (parsedCommand.flags.follow === true) {
    return true
  }
  return parsedCommand.flags.f !== undefined
}

const isRolloutStatusFollowEnabled = (parsedCommand: ParsedCommand): boolean => {
  if (parsedCommand.action !== 'rollout') {
    return false
  }
  if (parsedCommand.rolloutSubcommand !== 'status') {
    return false
  }
  return parsedCommand.rolloutWatch !== false
}

const isRolloutStatusSuccessOutput = (output: string): boolean => {
  return output.includes('successfully rolled out')
}

type RolloutProgressSnapshot = {
  deploymentName: string
  current: number
  desired: number
  mode: 'available' | 'updated'
}

const parseRolloutProgress = (
  output: string
): RolloutProgressSnapshot | undefined => {
  const availableMatch = output.match(
    /^Waiting for deployment "([^"]+)" rollout to finish: (\d+) of (\d+) updated replicas are available\.\.\.$/
  )
  if (availableMatch != null) {
    const current = Number.parseInt(availableMatch[2], 10)
    const desired = Number.parseInt(availableMatch[3], 10)
    if (!Number.isFinite(current) || !Number.isFinite(desired)) {
      return undefined
    }
    return {
      deploymentName: availableMatch[1],
      current,
      desired,
      mode: 'available'
    }
  }
  const updatedMatch = output.match(
    /^Waiting for deployment "([^"]+)" rollout to finish: (\d+) out of (\d+) new replicas have been updated\.\.\.$/
  )
  if (updatedMatch == null) {
    return undefined
  }
  const current = Number.parseInt(updatedMatch[2], 10)
  const desired = Number.parseInt(updatedMatch[3], 10)
  if (!Number.isFinite(current) || !Number.isFinite(desired)) {
    return undefined
  }
  return {
    deploymentName: updatedMatch[1],
    current,
    desired,
    mode: 'updated'
  }
}

const buildRolloutProgressLine = (
  deploymentName: string,
  current: number,
  desired: number,
  mode: 'available' | 'updated'
): string => {
  if (mode === 'updated') {
    return `Waiting for deployment "${deploymentName}" rollout to finish: ${current} out of ${desired} new replicas have been updated...`
  }
  return `Waiting for deployment "${deploymentName}" rollout to finish: ${current} of ${desired} updated replicas are available...`
}

const expandRolloutStatusOutput = (
  previousOutput: string,
  nextOutput: string
): string[] => {
  const previous = parseRolloutProgress(previousOutput)
  if (previous == null) {
    return [nextOutput]
  }

  const next = parseRolloutProgress(nextOutput)
  if (next != null) {
    if (
      next.deploymentName !== previous.deploymentName ||
      next.mode !== previous.mode ||
      next.desired !== previous.desired ||
      next.current <= previous.current + 1
    ) {
      return [nextOutput]
    }
    const expanded: string[] = []
    for (let value = previous.current + 1; value <= next.current; value++) {
      expanded.push(
        buildRolloutProgressLine(next.deploymentName, value, next.desired, next.mode)
      )
    }
    return expanded
  }

  if (!isRolloutStatusSuccessOutput(nextOutput)) {
    return [nextOutput]
  }
  if (previous.current >= previous.desired) {
    return [nextOutput]
  }
  const expanded: string[] = []
  for (let value = previous.current + 1; value < previous.desired; value++) {
    expanded.push(
      buildRolloutProgressLine(
        previous.deploymentName,
        value,
        previous.desired,
        previous.mode
      )
    )
  }
  expanded.push(nextOutput)
  return expanded
}

const restorePromptAfterStreamStop = (context: CommandContext): void => {
  context.output.showCursor()
  context.renderer.write(context.shellContextStack.getCurrentPrompt())
  context.renderer.focus()
}

const buildLogsFollowDeltaOutput = (
  previousOutput: string,
  nextOutput: string
): string => {
  if (nextOutput.length === 0) {
    return ''
  }
  if (previousOutput.length === 0) {
    return nextOutput
  }
  const previousLines = previousOutput
    .split('\n')
    .filter((line) => line.length > 0)
  const nextLines = nextOutput.split('\n').filter((line) => line.length > 0)
  if (nextLines.length <= previousLines.length) {
    return ''
  }
  const sharedLength = Math.min(previousLines.length, nextLines.length)
  let firstChangedIndex = sharedLength
  for (let index = 0; index < sharedLength; index++) {
    if (previousLines[index] !== nextLines[index]) {
      firstChangedIndex = index
      break
    }
  }
  const newLines = nextLines.slice(firstChangedIndex)
  if (newLines.length === 0) {
    return ''
  }
  return newLines.join('\n')
}

const parseKubectlOutputRedirection = (
  command: string
): ExecutionResult & { parsed?: ParsedRedirection } => {
  const trimmed = command.trim()
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaping = false
  const redirectIndexes: number[] = []
  for (let index = 0; index < trimmed.length; index++) {
    const char = trimmed[index]
    if (escaping) {
      escaping = false
      continue
    }
    if (char === '\\') {
      escaping = true
      continue
    }
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }
    if (char === '>' && !inSingleQuote && !inDoubleQuote) {
      redirectIndexes.push(index)
    }
  }

  if (redirectIndexes.length === 0) {
    return {
      ok: true,
      value: '',
      parsed: {
        command: trimmed
      }
    }
  }

  if (redirectIndexes.length !== 1) {
    return error('unsupported output redirection syntax')
  }

  const redirectIndex = redirectIndexes[0]
  const commandPart = trimmed.slice(0, redirectIndex).trim()
  const outputFile = trimmed.slice(redirectIndex + 1).trim()

  if (commandPart.length === 0) {
    return error('missing kubectl command before output redirection')
  }
  if (outputFile.length === 0) {
    return error('missing output file after redirection operator')
  }
  if (outputFile.includes(' ')) {
    return error('output redirection supports only one target file')
  }

  return {
    ok: true,
    value: '',
    parsed: {
      command: commandPart,
      outputFile
    }
  }
}

const stripInlineShellComment = (command: string): string => {
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaping = false
  for (let index = 0; index < command.length; index++) {
    const char = command[index]
    if (escaping) {
      escaping = false
      continue
    }
    if (char === '\\') {
      escaping = true
      continue
    }
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }
    if (char === '#' && !inSingleQuote && !inDoubleQuote) {
      return command.slice(0, index).trimEnd()
    }
  }
  return command
}

export class KubectlCommandHandler implements CommandHandler {
  canHandle(command: string): boolean {
    // Vérifie si la commande commence par "kubectl" suivi d'un espace ou fin de ligne
    const trimmed = command.trim()
    return trimmed === 'kubectl' || trimmed.startsWith('kubectl ')
  }

  execute(command: string, context: CommandContext): ExecutionResult {
    const commandWithoutComment = stripInlineShellComment(command)
    const parseRedirectionResult =
      parseKubectlOutputRedirection(commandWithoutComment)
    if (!parseRedirectionResult.ok || parseRedirectionResult.parsed == null) {
      const redirectionError = parseRedirectionResult.ok
        ? 'invalid output redirection'
        : parseRedirectionResult.error
      context.output.writeOutput(redirectionError)
      return error(redirectionError)
    }

    const parsedRedirection = parseRedirectionResult.parsed

    // Créer l'executor avec les dépendances du contexte
    const executor = createKubectlExecutor(
      context.apiServer,
      context.fileSystem,
      context.logger,
      context.networkRuntime,
      undefined,
      {
        editorModal: context.editorModal,
        onAsyncOutput: (message: string) => {
          if (message.length === 0) {
            return
          }
          // Async editor save happens after prompt is already rendered.
          // Replace current prompt line to avoid inserting an extra blank line.
          context.output.write('\r')
          context.renderer.clearLine()
          context.output.writeOutput(message)
          context.output.write(context.shellContextStack.getCurrentPrompt())
        },
        preserveFailedEditCopy: (content: string) => {
          const createTmpDirectoryResult = context.fileSystem.createDirectory(
            KUBECTL_EDIT_TMP_DIR,
            true
          )
          if (
            !createTmpDirectoryResult.ok &&
            !createTmpDirectoryResult.error.includes('File exists')
          ) {
            return undefined
          }
          const uniqueId = Math.floor(Math.random() * 10000000000)
          const copyPath = `${KUBECTL_EDIT_TMP_DIR}/kubectl-edit-${uniqueId}.yaml`
          const writeCopyResult = context.fileSystem.writeFile(
            copyPath,
            content
          )
          if (!writeCopyResult.ok) {
            return undefined
          }
          return copyPath
        }
      }
    )

    const parsedCommandResult = parseCommand(parsedRedirection.command)
    if (!parsedCommandResult.ok) {
      context.output.writeOutput(parsedCommandResult.error)
      return error(parsedCommandResult.error)
    }
    const parsedCommand = parsedCommandResult.value
    const watchEnabled =
      parsedCommand.action === 'get' &&
      parsedCommand.rawPath == null &&
      isWatchEnabled(parsedCommand)
    const logsFollowEnabled = isLogsFollowEnabled(parsedCommand)
    const rolloutStatusFollowEnabled =
      isRolloutStatusFollowEnabled(parsedCommand)

    if (watchEnabled && parsedRedirection.outputFile != null) {
      const watchRedirectionError =
        'unsupported output redirection syntax for watch mode'
      context.output.writeOutput(watchRedirectionError)
      return error(watchRedirectionError)
    }
    if (logsFollowEnabled && parsedRedirection.outputFile != null) {
      const followRedirectionError =
        'unsupported output redirection syntax for follow mode'
      context.output.writeOutput(followRedirectionError)
      return error(followRedirectionError)
    }
    if (rolloutStatusFollowEnabled && parsedRedirection.outputFile != null) {
      const rolloutFollowRedirectionError =
        'unsupported output redirection syntax for rollout follow mode'
      context.output.writeOutput(rolloutFollowRedirectionError)
      return error(rolloutFollowRedirectionError)
    }
    if (logsFollowEnabled && parsedCommand.flags.previous === true) {
      const previousWithFollowError =
        'error: only one of follow (-f) or previous (-p) is allowed'
      context.output.writeOutput(previousWithFollowError)
      return error(previousWithFollowError)
    }
    if (watchEnabled && parsedCommand.resource != null) {
      const supportedWatchEvents = getWatchEventTypes(parsedCommand.resource)
      if (supportedWatchEvents.length === 0) {
        const unsupportedResourceError = `watch is not supported for resource: ${parsedCommand.resource}`
        context.output.writeOutput(unsupportedResourceError)
        return error(unsupportedResourceError)
      }
    }

    // Exécuter la commande kubectl
    const result = executor.execute(parsedRedirection.command)

    if (result.ok && typeof result.value === 'string') {
      const directiveResult = executeKubectlDirective(context, result.value)
      if (directiveResult != null) {
        if (!directiveResult.ok) {
          context.output.writeOutput(directiveResult.error)
          return directiveResult
        }
        if (directiveResult.value.length > 0) {
          context.output.writeOutput(directiveResult.value)
        }
        return directiveResult
      }
    }

    if (parsedRedirection.outputFile != null) {
      if (!result.ok) {
        context.output.writeOutput(result.error)
        return result
      }

      const outputToWrite = result.value || ''
      const writeResult = context.fileSystem.writeFile(
        parsedRedirection.outputFile,
        outputToWrite
      )
      if (!writeResult.ok) {
        context.output.writeOutput(writeResult.error)
        return error(writeResult.error)
      }

      return success('')
    }

    if (
      watchEnabled &&
      context.startStream != null &&
      parsedCommand.resource != null
    ) {
      const outputDirective =
        parsedCommand.flags['output'] ?? parsedCommand.flags['o']
      const isStructuredOutput =
        typeof outputDirective === 'string' &&
        (outputDirective === 'json' ||
          outputDirective === 'yaml' ||
          outputDirective === 'name' ||
          outputDirective.startsWith('jsonpath'))
      const stripTableHeader = !isStructuredOutput
      const noHeadersRequested =
        parsedCommand.flags['no-headers'] === true ||
        parsedCommand.flags.noHeaders === true
      const useStatefulTableWriter = stripTableHeader && !noHeadersRequested
      const effectiveNamespace = getEffectiveNamespace(parsedCommand, context)
      const watchTableWriter = createStatefulTabWriter({
        spacing: 3,
        minColumnWidthsByHeader: {
          STATUS: 'ImagePullBackOff'.length
        }
      })
      let hasSeededWatchTable = false
      let lastOutput = isWatchOnly(parsedCommand)
        ? ''
        : result.ok
          ? result.value || ''
          : result.error

      if (isWatchOnly(parsedCommand)) {
        if (!result.ok) {
          context.output.writeOutput(result.error)
          return result
        }
      } else {
        if (!result.ok) {
          context.output.writeOutput(result.error)
          return result
        }
        if (result.value != null && result.value.length > 0) {
          if (useStatefulTableWriter) {
            const parsedTableOutput = tryParseTableOutput(result.value)
            if (parsedTableOutput != null) {
              const initialLines = watchTableWriter.ingestHeaderAndRows(
                parsedTableOutput.header,
                parsedTableOutput.rows
              )
              hasSeededWatchTable = true
              context.output.writeOutput(initialLines.join('\n'))
            } else {
              context.output.writeOutput(result.value)
            }
          } else {
            context.output.writeOutput(result.value)
          }
        }
      }

      const onWatchEvent = () => {
        const next = executor.execute(parsedRedirection.command)
        const nextOutput = next.ok ? next.value || '' : next.error
        if (nextOutput === lastOutput) {
          return
        }
        if (useStatefulTableWriter) {
          const parsedTableOutput = tryParseTableOutput(nextOutput)
          if (parsedTableOutput != null) {
            if (!hasSeededWatchTable) {
              const seededLines = watchTableWriter.ingestHeaderAndRows(
                parsedTableOutput.header,
                parsedTableOutput.rows
              )
              hasSeededWatchTable = true
              lastOutput = nextOutput
              const firstRows = seededLines.slice(1)
              if (firstRows.length === 0) {
                return
              }
              context.output.writeOutput(firstRows.join('\n'))
              return
            }
            const changedRows = watchTableWriter.formatDelta(
              parsedTableOutput.rows
            )
            lastOutput = nextOutput
            if (changedRows.length === 0) {
              return
            }
            context.output.writeOutput(changedRows.join('\n'))
            return
          }
        }
        const deltaOutput = buildWatchDeltaOutput(
          lastOutput,
          nextOutput,
          stripTableHeader
        )
        lastOutput = nextOutput
        if (deltaOutput.length === 0) {
          return
        }
        context.output.writeOutput(deltaOutput)
      }
      const unsubscribe = context.apiServer.watchHub.watchAllClusterEvents(
        (clusterEvent) => {
          if (
            !shouldRenderEvent(clusterEvent, parsedCommand, effectiveNamespace)
          ) {
            return
          }
          onWatchEvent()
        }
      )
      context.startStream(() => {
        unsubscribe()
        watchTableWriter.reset()
      })
      return success('')
    }

    if (logsFollowEnabled && context.startStream != null) {
      if (!result.ok) {
        context.output.writeOutput(result.error)
        return result
      }
      if (result.value != null && result.value.length > 0) {
        context.output.writeOutput(result.value)
      }

      let lastOutput = result.value || ''
      const intervalId = setInterval(() => {
        const next = executor.execute(parsedRedirection.command)
        const nextOutput = next.ok ? next.value || '' : next.error
        if (!next.ok) {
          context.output.writeOutput(next.error)
          if (context.stopStream != null) {
            context.stopStream()
            restorePromptAfterStreamStop(context)
          } else {
            clearInterval(intervalId)
          }
          return
        }
        if (nextOutput === lastOutput) {
          return
        }
        const deltaOutput = buildLogsFollowDeltaOutput(lastOutput, nextOutput)
        lastOutput = nextOutput
        if (deltaOutput.length === 0) {
          return
        }
        context.output.writeOutput(deltaOutput)
      }, LOGS_FOLLOW_POLL_INTERVAL_MS)

      context.startStream(() => {
        clearInterval(intervalId)
      })
      return success('')
    }

    if (rolloutStatusFollowEnabled && context.startStream != null) {
      if (!result.ok) {
        context.output.writeOutput(result.error)
        return result
      }
      if (result.value != null && result.value.length > 0) {
        context.output.writeOutput(result.value)
      }
      if (isRolloutStatusSuccessOutput(result.value || '')) {
        return success('')
      }

      let lastOutput = result.value || ''
      const effectiveNamespace = getEffectiveNamespace(parsedCommand, context)
      const onRolloutStatusEvent = () => {
        const next = executor.execute(parsedRedirection.command)
        const nextOutput = next.ok ? next.value || '' : next.error
        if (!next.ok) {
          context.output.writeOutput(next.error)
          if (context.stopStream != null) {
            context.stopStream()
          }
          return
        }
        if (nextOutput === lastOutput) {
          return
        }
        const expandedOutputs = expandRolloutStatusOutput(lastOutput, nextOutput)
        lastOutput = nextOutput
        if (expandedOutputs.length > 0) {
          context.output.writeOutput(expandedOutputs.join('\n'))
        }
        if (isRolloutStatusSuccessOutput(nextOutput)) {
          if (context.stopStream != null) {
            context.stopStream()
            restorePromptAfterStreamStop(context)
          }
        }
      }

      const unsubscribe = context.apiServer.watchHub.watchAllClusterEvents(
        (clusterEvent) => {
          if (
            !shouldRenderEvent(clusterEvent, parsedCommand, effectiveNamespace)
          ) {
            return
          }
          onRolloutStatusEvent()
        }
      )

      context.startStream(() => {
        unsubscribe()
      })
      return success('')
    }

    // Afficher le résultat dans le terminal
    if (result.ok) {
      if (result.value) {
        context.output.writeOutput(result.value)
      }
    } else {
      context.output.writeOutput(result.error)
    }

    return result
  }
}
