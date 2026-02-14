// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL APPLY & CREATE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════
// Unified handlers for apply and create commands using event-driven architecture

import type { ClusterState } from '../../../cluster/ClusterState'
import type { EventBus } from '../../../cluster/events/EventBus'
import { createDeployment } from '../../../cluster/ressources/Deployment'
import type { PodTemplateSpec } from '../../../cluster/ressources/ReplicaSet'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import { error } from '../../../shared/result'
import { parseKubernetesYaml } from '../../yamlParser'
import type { ParsedCommand } from '../types'
import {
  applyResourceWithEvents,
  createResourceWithEvents
} from './resourceHelpers'

const getFilenameFromFlags = (parsed: ParsedCommand): string | undefined => {
  const filename = parsed.flags.f || parsed.flags.filename
  if (typeof filename !== 'string') {
    return undefined
  }
  return filename
}

const getCreateImages = (parsed: ParsedCommand): string[] => {
  if (parsed.createImages && parsed.createImages.length > 0) {
    return parsed.createImages
  }

  const imageFlag = parsed.flags.image
  if (typeof imageFlag !== 'string') {
    return []
  }

  return [imageFlag]
}

const getContainerName = (
  deploymentName: string,
  image: string,
  index: number
): string => {
  const imageBaseName = image.split('/').pop() || image
  const imageWithoutTag = imageBaseName.split(':')[0]
  const sanitized = imageWithoutTag.replace(/[^a-zA-Z0-9-]/g, '-')
  if (sanitized.length > 0) {
    return sanitized
  }
  return `${deploymentName}-${index + 1}`
}

const buildPodTemplate = (
  deploymentName: string,
  images: string[],
  command?: string[],
  port?: number
): PodTemplateSpec => {
  const containers = images.map((image, index) => {
    const container = {
      name: getContainerName(deploymentName, image, index),
      image
    } as PodTemplateSpec['spec']['containers'][number]

    if (command && command.length > 0) {
      container.command = command
    }
    if (typeof port === 'number') {
      container.ports = [{ containerPort: port }]
    }

    return container
  })

  return {
    metadata: {
      labels: { app: deploymentName }
    },
    spec: { containers }
  }
}

const isCreateDeploymentImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & { name: string } => {
  if (parsed.resource !== 'deployments') {
    return false
  }
  if (typeof parsed.name !== 'string') {
    return false
  }
  return parsed.name.length > 0
}

const isCreateDeploymentCommand = (parsed: ParsedCommand): boolean => {
  return parsed.resource === 'deployments'
}

const validateCreateDeploymentCommand = (
  parsed: ParsedCommand
): ExecutionResult | undefined => {
  if (!isCreateDeploymentCommand(parsed)) {
    return undefined
  }

  if (typeof parsed.name !== 'string' || parsed.name.length === 0) {
    return error('error: create deployment requires a name')
  }

  return undefined
}

const createDeploymentFromFlags = (
  parsed: ParsedCommand & { name: string },
  clusterState: ClusterState,
  eventBus: EventBus
): ExecutionResult => {
  const images = getCreateImages(parsed)
  if (images.length > 1 && parsed.createCommand && parsed.createCommand.length > 0) {
    return error('error: cannot specify multiple --image options and command')
  }

  if (images.length === 0) {
    return error('error: required flag(s) "image" not set')
  }

  const deploymentName = parsed.name
  const namespace = parsed.namespace || 'default'
  const template = buildPodTemplate(
    deploymentName,
    images,
    parsed.createCommand,
    parsed.port
  )

  const deployment = createDeployment({
    name: deploymentName,
    namespace,
    replicas: parsed.replicas,
    selector: { matchLabels: { app: deploymentName } },
    template
  })

  return createResourceWithEvents(deployment, clusterState, eventBus)
}

/**
 * Shared helper to load and parse YAML from filesystem
 */
const loadAndParseYaml = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ExecutionResult & { resource?: any } => {
  // Extract filename from flags
  const filename = getFilenameFromFlags(parsed)

  if (!filename) {
    return error('error: must specify one of -f or --filename')
  }

  // Read file from filesystem
  const fileResult = fileSystem.readFile(filename as string)
  if (!fileResult.ok) {
    return error(`error: ${fileResult.error}`)
  }

  // Parse and validate YAML
  const parseResult = parseKubernetesYaml(fileResult.value)
  if (!parseResult.ok) {
    return error(`error: ${parseResult.error}`)
  }

  return { ok: true, value: '', resource: parseResult.value }
}

/**
 * Handle kubectl apply command
 * Creates or updates resources from YAML files
 */
export const handleApply = (
  fileSystem: FileSystem,
  clusterState: ClusterState,
  parsed: ParsedCommand,
  eventBus: EventBus
): ExecutionResult => {
  const loadResult = loadAndParseYaml(fileSystem, parsed)
  if (!loadResult.ok) {
    return loadResult
  }

  return applyResourceWithEvents(loadResult.resource, clusterState, eventBus)
}

/**
 * Handle kubectl create command
 * Creates resources from YAML files (fails if resource already exists)
 */
export const handleCreate = (
  fileSystem: FileSystem,
  clusterState: ClusterState,
  parsed: ParsedCommand,
  eventBus: EventBus
): ExecutionResult => {
  const validationResult = validateCreateDeploymentCommand(parsed)
  if (validationResult) {
    return validationResult
  }

  if (isCreateDeploymentImperative(parsed)) {
    return createDeploymentFromFlags(parsed, clusterState, eventBus)
  }

  const loadResult = loadAndParseYaml(fileSystem, parsed)
  if (!loadResult.ok) {
    return loadResult
  }

  return createResourceWithEvents(loadResult.resource, clusterState, eventBus)
}
