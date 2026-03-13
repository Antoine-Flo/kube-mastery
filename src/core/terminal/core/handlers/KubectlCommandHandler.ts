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
import type { ClusterEvent } from '../../../cluster/events/types'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
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
    'ServiceCreated',
    'ServiceUpdated',
    'ServiceDeleted',
    'PersistentVolumeCreated',
    'PersistentVolumeUpdated',
    'PersistentVolumeDeleted',
    'PersistentVolumeClaimCreated',
    'PersistentVolumeClaimUpdated',
    'PersistentVolumeClaimDeleted'
  ],
  pods: ['PodCreated', 'PodUpdated', 'PodDeleted', 'PodBound'],
  configmaps: ['ConfigMapCreated', 'ConfigMapUpdated', 'ConfigMapDeleted'],
  secrets: ['SecretCreated', 'SecretUpdated', 'SecretDeleted'],
  nodes: [],
  replicasets: ['ReplicaSetCreated', 'ReplicaSetUpdated', 'ReplicaSetDeleted'],
  daemonsets: ['DaemonSetCreated', 'DaemonSetUpdated', 'DaemonSetDeleted'],
  deployments: ['DeploymentCreated', 'DeploymentUpdated', 'DeploymentDeleted'],
  services: ['ServiceCreated', 'ServiceUpdated', 'ServiceDeleted'],
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
  ]
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
  return (
    parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true
  )
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
  return getCurrentNamespaceFromKubeconfig(context.clusterState.toJSON()) ?? 'default'
}

const matchesSelector = (
  selector: Record<string, string> | undefined,
  labels: Record<string, string> | undefined
): boolean => {
  if (selector == null) {
    return true
  }
  if (labels == null) {
    return true
  }
  for (const [key, value] of Object.entries(selector)) {
    if (labels[key] !== value) {
      return false
    }
  }
  return true
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
  if (!matchesSelector(parsed.selector, meta.labels)) {
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

const parseKubectlOutputRedirection = (
  command: string
): ExecutionResult & { parsed?: ParsedRedirection } => {
  const trimmed = command.trim()
  const segments = trimmed.split('>')

  if (segments.length === 1) {
    return {
      ok: true,
      value: '',
      parsed: {
        command: trimmed
      }
    }
  }

  if (segments.length !== 2) {
    return error('unsupported output redirection syntax')
  }

  const commandPart = segments[0].trim()
  const outputFile = segments[1].trim()

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

export class KubectlCommandHandler implements CommandHandler {
  canHandle(command: string): boolean {
    // Vérifie si la commande commence par "kubectl" suivi d'un espace ou fin de ligne
    const trimmed = command.trim()
    return trimmed === 'kubectl' || trimmed.startsWith('kubectl ')
  }

  execute(command: string, context: CommandContext): ExecutionResult {
    const parseRedirectionResult = parseKubectlOutputRedirection(command)
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
      context.clusterState,
      context.fileSystem,
      context.logger,
      context.eventBus,
      context.networkRuntime
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

    if (watchEnabled && parsedRedirection.outputFile != null) {
      const watchRedirectionError =
        'unsupported output redirection syntax for watch mode'
      context.output.writeOutput(watchRedirectionError)
      return error(watchRedirectionError)
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
      const outputDirective = parsedCommand.flags['output'] ?? parsedCommand.flags['o']
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

      const unsubscribe = context.eventBus.subscribeFiltered(
        (appEvent) => {
          const clusterEvent = appEvent as ClusterEvent
          return shouldRenderEvent(clusterEvent, parsedCommand, effectiveNamespace)
        },
        () => {
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
              const changedRows = watchTableWriter.formatDelta(parsedTableOutput.rows)
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
      )
      context.startStream(() => {
        unsubscribe()
        watchTableWriter.reset()
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
