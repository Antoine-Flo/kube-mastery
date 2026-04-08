import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import { createDeployment } from '../../../../../cluster/ressources/Deployment'
import type { PodTemplateSpec } from '../../../../../cluster/ressources/ReplicaSet'
import type { ExecutionResult } from '../../../../../shared/result'
import { error } from '../../../../../shared/result'
import { createResourceWithEvents } from '../../../resourceCatalog'
import type { ParsedCommand } from '../../../types'

export const getCreateImages = (parsed: ParsedCommand): string[] => {
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

export const buildCreateDeploymentDryRunManifest = (
  parsed: ParsedCommand & { name: string }
): Record<string, unknown> => {
  const images = getCreateImages(parsed)
  const metadataLabels = { app: parsed.name }
  const container = {
    image: images[0],
    name: images[0].split('/').pop()?.split(':')[0] || parsed.name,
    resources: {}
  } as Record<string, unknown>

  if (parsed.port != null) {
    container['ports'] = [{ containerPort: parsed.port }]
  }
  if (parsed.createCommand != null && parsed.createCommand.length > 0) {
    container['command'] = parsed.createCommand
  }

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      labels: metadataLabels,
      name: parsed.name,
      ...(parsed.namespace != null && parsed.namespace !== 'default'
        ? { namespace: parsed.namespace }
        : {})
    },
    spec: {
      replicas: parsed.replicas ?? 1,
      selector: { matchLabels: metadataLabels },
      strategy: {},
      template: {
        metadata: {
          labels: metadataLabels
        },
        spec: {
          containers: [container]
        }
      }
    },
    status: {}
  }
}

export const isCreateDeploymentImperative = (
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

export const validateCreateDeploymentCommand = (
  parsed: ParsedCommand
): ExecutionResult | undefined => {
  if (!isCreateDeploymentCommand(parsed)) {
    return undefined
  }

  if (typeof parsed.name !== 'string' || parsed.name.length === 0) {
    return error('error: create deployment requires a name')
  }

  const images = getCreateImages(parsed)
  if (images.length === 0) {
    return error('error: required flag(s) "image" not set')
  }
  if (
    images.length > 1 &&
    parsed.createCommand &&
    parsed.createCommand.length > 0
  ) {
    return error('error: cannot specify multiple --image options and command')
  }

  return undefined
}

export const createDeploymentFromFlags = (
  parsed: ParsedCommand & { name: string },
  apiServer: ApiServerFacade
): ExecutionResult => {
  const images = getCreateImages(parsed)
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
    labels: { app: deploymentName },
    replicas: parsed.replicas,
    selector: { matchLabels: { app: deploymentName } },
    template
  })

  return createResourceWithEvents(deployment, apiServer)
}
