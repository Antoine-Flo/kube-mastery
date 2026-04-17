import type {
  KindToResource,
  ResourceKind
} from '../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { DaemonSet } from '../../../cluster/ressources/DaemonSet'
import type { Deployment } from '../../../cluster/ressources/Deployment'
import type { Pod } from '../../../cluster/ressources/Pod'
import type { ReplicaSet } from '../../../cluster/ressources/ReplicaSet'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand, Resource } from '../types'
import { toKindReference, toPluralKindReference } from '../resourceCatalog'
import {
  buildNotFoundErrorMessage,
  buildRequiresResourceNameMessage,
  buildRequiresResourceTypeMessage
} from '../shared/errorMessages'

type ContainerLike = {
  name: string
  image: string
}

const SET_IMAGE_RESOURCE_KIND_BY_RESOURCE: Partial<
  Record<Resource, ResourceKind>
> = {
  pods: 'Pod',
  deployments: 'Deployment',
  daemonsets: 'DaemonSet',
  replicasets: 'ReplicaSet'
}

const getContainersFromResource = (
  kind: ResourceKind,
  resource: KindToResource<ResourceKind>
): ContainerLike[] => {
  if (kind === 'Pod') {
    return (resource as Pod).spec.containers as ContainerLike[]
  }
  if (kind === 'Deployment') {
    return (resource as Deployment).spec.template.spec
      .containers as ContainerLike[]
  }
  if (kind === 'ReplicaSet') {
    return (resource as ReplicaSet).spec.template.spec
      .containers as ContainerLike[]
  }
  return (resource as DaemonSet).spec.template.spec
    .containers as ContainerLike[]
}

const withUpdatedContainers = (
  kind: ResourceKind,
  resource: KindToResource<ResourceKind>,
  updatedContainers: ContainerLike[]
): KindToResource<ResourceKind> => {
  if (kind === 'Pod') {
    const pod = resource as Pod
    return {
      ...pod,
      spec: {
        ...pod.spec,
        containers: updatedContainers
      }
    } as KindToResource<ResourceKind>
  }
  if (kind === 'Deployment') {
    const deployment = resource as Deployment
    return {
      ...deployment,
      spec: {
        ...deployment.spec,
        template: {
          ...deployment.spec.template,
          spec: {
            ...deployment.spec.template.spec,
            containers: updatedContainers
          }
        }
      }
    } as KindToResource<ResourceKind>
  }
  if (kind === 'ReplicaSet') {
    const replicaSet = resource as ReplicaSet
    return {
      ...replicaSet,
      spec: {
        ...replicaSet.spec,
        template: {
          ...replicaSet.spec.template,
          spec: {
            ...replicaSet.spec.template.spec,
            containers: updatedContainers
          }
        }
      }
    } as KindToResource<ResourceKind>
  }

  const daemonSet = resource as DaemonSet
  return {
    ...daemonSet,
    spec: {
      ...daemonSet.spec,
      template: {
        ...daemonSet.spec.template,
        spec: {
          ...daemonSet.spec.template.spec,
          containers: updatedContainers
        }
      }
    }
  } as KindToResource<ResourceKind>
}

const parseSetImageTarget = (
  parsed: ParsedCommand
): { kind: ResourceKind; name: string } | ExecutionResult => {
  if (parsed.resource == null) {
    return error(buildRequiresResourceTypeMessage('set image'))
  }
  const kind = SET_IMAGE_RESOURCE_KIND_BY_RESOURCE[parsed.resource]
  if (kind == null) {
    return error(
      `error: set image does not support resource type "${parsed.resource}"`
    )
  }
  if (parsed.name == null || parsed.name.length === 0) {
    return error(buildRequiresResourceNameMessage('set image'))
  }
  return {
    kind,
    name: parsed.name
  }
}

const parseImageAssignments = (
  parsed: ParsedCommand
): Record<string, string> | ExecutionResult => {
  const assignments = parsed.setImageAssignments
  if (assignments == null || Object.keys(assignments).length === 0) {
    return error(
      'error: set image requires at least one container=image assignment'
    )
  }
  return assignments
}

export const handleSetImage = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  if (parsed.setSubcommand !== 'image') {
    return error('error: set currently supports only the image subcommand')
  }

  const targetResult = parseSetImageTarget(parsed)
  if ('ok' in targetResult) {
    return targetResult
  }
  const assignmentsResult = parseImageAssignments(parsed)
  const isExecutionResult = (
    x: Record<string, string> | ExecutionResult
  ): x is ExecutionResult => {
    return typeof (x as ExecutionResult).ok === 'boolean'
  }
  if (isExecutionResult(assignmentsResult)) {
    return assignmentsResult
  }

  const namespace = parsed.namespace ?? 'default'
  const existing = apiServer.findResource(
    targetResult.kind,
    targetResult.name,
    namespace
  )
  if (!existing.ok) {
    return error(
      buildNotFoundErrorMessage(
        toPluralKindReference(targetResult.kind),
        targetResult.name
      )
    )
  }

  const containers = getContainersFromResource(
    targetResult.kind,
    existing.value
  )
  const updatedContainers = containers.map((container) => ({ ...container }))
  for (const [containerName, image] of Object.entries(assignmentsResult)) {
    const targetContainer = updatedContainers.find(
      (container) => container.name === containerName
    )
    if (targetContainer == null) {
      return error(`error: unable to find container named "${containerName}"`)
    }
    targetContainer.image = image
  }

  const updatedResource = withUpdatedContainers(
    targetResult.kind,
    existing.value,
    updatedContainers
  )
  const updateResult = apiServer.updateResource(
    targetResult.kind,
    targetResult.name,
    updatedResource,
    namespace
  )
  if (!updateResult.ok) {
    return error(updateResult.error)
  }

  return success(
    `${toKindReference(targetResult.kind)}/${targetResult.name} image updated`
  )
}
