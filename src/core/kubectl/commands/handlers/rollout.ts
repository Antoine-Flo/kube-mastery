import type {
  KindToResource,
  ResourceKind
} from '../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { ControllerRevision } from '../../../cluster/ressources/ControllerRevision'
import { createControllerRevision } from '../../../cluster/ressources/ControllerRevision'
import type { DaemonSet } from '../../../cluster/ressources/DaemonSet'
import type { Deployment } from '../../../cluster/ressources/Deployment'
import type { ReplicaSet } from '../../../cluster/ressources/ReplicaSet'
import type { StatefulSet } from '../../../cluster/ressources/StatefulSet'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { toKindReference, toPluralKindReference } from '../resourceHelpers'
import type { ParsedCommand, Resource } from '../types'

const RESTART_ANNOTATION = 'kubectl.kubernetes.io/restartedAt'
const CHANGE_CAUSE_ANNOTATION = 'kubernetes.io/change-cause'

const ROLLOUT_RESOURCE_KIND_BY_RESOURCE: Partial<
  Record<Resource, ResourceKind>
> = {
  deployments: 'Deployment',
  daemonsets: 'DaemonSet',
  statefulsets: 'StatefulSet'
}

const deepClone = <T>(value: T): T => {
  return JSON.parse(JSON.stringify(value)) as T
}

const parseRolloutTarget = (
  parsed: ParsedCommand
): { kind: ResourceKind; name: string } | ExecutionResult => {
  if (parsed.resource == null) {
    return error('error: rollout requires a resource type')
  }
  const kind = ROLLOUT_RESOURCE_KIND_BY_RESOURCE[parsed.resource]
  if (kind == null) {
    return error(
      'error: rollout supports only deployments, daemonsets, and statefulsets'
    )
  }
  if (parsed.name == null || parsed.name.length === 0) {
    return error('error: rollout requires a resource name')
  }
  return {
    kind,
    name: parsed.name
  }
}

const getWorkloadTemplate = (
  resource: KindToResource<ResourceKind>
): unknown => {
  if (resource.kind === 'Deployment') {
    return (resource as Deployment).spec.template
  }
  if (resource.kind === 'DaemonSet') {
    return (resource as DaemonSet).spec.template
  }
  return (resource as StatefulSet).spec.template
}

const withUpdatedWorkloadTemplate = (
  resource: KindToResource<ResourceKind>,
  template: unknown
): KindToResource<ResourceKind> => {
  if (resource.kind === 'Deployment') {
    const deployment = resource as Deployment
    return {
      ...deployment,
      metadata: {
        ...deployment.metadata,
        generation: (deployment.metadata.generation ?? 1) + 1
      },
      spec: {
        ...deployment.spec,
        template: template as Deployment['spec']['template']
      }
    } as KindToResource<ResourceKind>
  }
  if (resource.kind === 'DaemonSet') {
    const daemonSet = resource as DaemonSet
    return {
      ...daemonSet,
      spec: {
        ...daemonSet.spec,
        template: template as DaemonSet['spec']['template']
      }
    } as KindToResource<ResourceKind>
  }
  const statefulSet = resource as StatefulSet
  return {
    ...statefulSet,
    metadata: {
      ...statefulSet.metadata,
      generation: (statefulSet.metadata.generation ?? 1) + 1
    },
    spec: {
      ...statefulSet.spec,
      template: template as StatefulSet['spec']['template']
    }
  } as KindToResource<ResourceKind>
}

const withRestartAnnotation = (
  template: unknown,
  timestamp: string
): Record<string, unknown> => {
  const templateObject = deepClone(template) as Record<string, unknown>
  const metadata = (templateObject.metadata ?? {}) as Record<string, unknown>
  const annotations = (metadata.annotations ?? {}) as Record<string, unknown>
  metadata.annotations = {
    ...annotations,
    [RESTART_ANNOTATION]: timestamp
  }
  templateObject.metadata = metadata
  return templateObject
}

const getDeploymentRevisionFromReplicaSet = (
  replicaSet: ReplicaSet
): number => {
  const value =
    replicaSet.metadata.annotations?.['deployment.kubernetes.io/revision'] ??
    '0'
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

const getOwnedReplicaSets = (
  apiServer: ApiServerFacade,
  deployment: Deployment
): ReplicaSet[] => {
  const replicaSets = apiServer.listResources(
    'ReplicaSet',
    deployment.metadata.namespace
  )
  return replicaSets.filter((replicaSet) => {
    const ownerReferences = replicaSet.metadata.ownerReferences ?? []
    return ownerReferences.some((ownerReference) => {
      return (
        ownerReference.kind === 'Deployment' &&
        ownerReference.name === deployment.metadata.name
      )
    })
  })
}

const getOwnedControllerRevisions = (
  apiServer: ApiServerFacade,
  kind: 'DaemonSet' | 'StatefulSet',
  name: string,
  namespace: string
): ControllerRevision[] => {
  const revisions = apiServer.listResources('ControllerRevision', namespace)
  const owned = revisions.filter((revision) => {
    const ownerReferences = revision.metadata.ownerReferences ?? []
    return ownerReferences.some((ownerReference) => {
      return ownerReference.kind === kind && ownerReference.name === name
    })
  })
  return owned.sort((a, b) => a.revision - b.revision)
}

const ensureControllerRevisionHistory = (
  apiServer: ApiServerFacade,
  workload: DaemonSet | StatefulSet
): ControllerRevision[] => {
  const kind = workload.kind
  const existing = getOwnedControllerRevisions(
    apiServer,
    kind,
    workload.metadata.name,
    workload.metadata.namespace
  )
  const currentTemplate = getWorkloadTemplate(workload)
  if (existing.length === 0) {
    const firstRevision = createControllerRevision({
      name: `${workload.metadata.name}-${1}`,
      namespace: workload.metadata.namespace,
      revision: 1,
      template: currentTemplate,
      labels: {
        app: workload.metadata.name
      },
      ownerReferences: [
        {
          apiVersion: workload.apiVersion,
          kind: workload.kind,
          name: workload.metadata.name,
          uid: `${workload.metadata.namespace}-${workload.metadata.name}`,
          controller: true
        }
      ]
    })
    apiServer.createResource(
      'ControllerRevision',
      firstRevision,
      workload.metadata.namespace
    )
    return [firstRevision]
  }

  const latest = existing[existing.length - 1]
  const latestTemplate = latest.data.template
  if (JSON.stringify(latestTemplate) === JSON.stringify(currentTemplate)) {
    return existing
  }

  const nextRevisionNumber = latest.revision + 1
  const newRevision = createControllerRevision({
    name: `${workload.metadata.name}-${nextRevisionNumber}`,
    namespace: workload.metadata.namespace,
    revision: nextRevisionNumber,
    template: currentTemplate,
    labels: {
      app: workload.metadata.name
    },
    ownerReferences: [
      {
        apiVersion: workload.apiVersion,
        kind: workload.kind,
        name: workload.metadata.name,
        uid: `${workload.metadata.namespace}-${workload.metadata.name}`,
        controller: true
      }
    ]
  })
  apiServer.createResource(
    'ControllerRevision',
    newRevision,
    workload.metadata.namespace
  )
  return [...existing, newRevision]
}

const rolloutStatusComplete = (
  resource: KindToResource<ResourceKind>
): { done: boolean; details: string } => {
  if (resource.kind === 'Deployment') {
    const deployment = resource as Deployment
    const desired = deployment.spec.replicas ?? 1
    const updated = deployment.status.updatedReplicas ?? 0
    const available = deployment.status.availableReplicas ?? 0
    const done = updated >= desired && available >= desired
    return {
      done,
      details: `${updated}/${desired} updated, ${available}/${desired} available`
    }
  }
  if (resource.kind === 'DaemonSet') {
    const daemonSet = resource as DaemonSet
    const desired = daemonSet.status.desiredNumberScheduled ?? 0
    const current = daemonSet.status.currentNumberScheduled ?? 0
    const ready = daemonSet.status.numberReady ?? 0
    const done = desired > 0 && current >= desired && ready >= desired
    return {
      done,
      details: `${ready}/${desired} ready, ${current}/${desired} current`
    }
  }
  const statefulSet = resource as StatefulSet
  const desired = statefulSet.spec.replicas ?? 1
  const ready = statefulSet.status.readyReplicas ?? 0
  const updated = statefulSet.status.updatedReplicas ?? 0
  const done = desired === 0 || (ready >= desired && updated >= desired)
  return {
    done,
    details: `${ready}/${desired} ready, ${updated}/${desired} updated`
  }
}

const formatRolloutWaitingMessage = (
  resource: KindToResource<ResourceKind>,
  name: string
): string => {
  if (resource.kind === 'Deployment') {
    const deployment = resource as Deployment
    const desired = deployment.spec.replicas ?? 1
    const replicas = deployment.status.replicas ?? desired
    const updated = deployment.status.updatedReplicas ?? 0
    const available = deployment.status.availableReplicas ?? 0
    const oldPendingTermination = Math.max(0, replicas - updated)
    if (updated < desired) {
      return `Waiting for deployment "${name}" rollout to finish: ${updated} out of ${desired} new replicas have been updated...`
    }
    if (available < desired) {
      return `Waiting for deployment "${name}" rollout to finish: ${available} of ${desired} updated replicas are available...`
    }
    if (oldPendingTermination > 0) {
      return `Waiting for deployment "${name}" rollout to finish: ${oldPendingTermination} old replicas are pending termination...`
    }
    return `Waiting for deployment "${name}" rollout to finish...`
  }
  return `Waiting for ${toKindReference(resource.kind as ResourceKind)}/${name} rollout to finish...`
}

type HistorySummaryRow = {
  revision: number
  changeCause?: string
}

const formatHistorySummary = (
  kind: ResourceKind,
  name: string,
  rows: HistorySummaryRow[]
): string => {
  const header = `${toKindReference(kind)}/${name}`
  const maxRevisionDigits = rows.reduce((maxDigits, row) => {
    return Math.max(maxDigits, String(row.revision).length)
  }, 1)
  const revisionColumnWidth = Math.max('REVISION'.length, maxRevisionDigits) + 2
  const headerRow = `${'REVISION'.padEnd(revisionColumnWidth)}CHANGE-CAUSE`
  if (rows.length === 0) {
    return `${header}\n${headerRow}\n${'<none>'.padEnd(revisionColumnWidth)}<none>`
  }
  const formattedRows = rows.map((row) => {
    return `${String(row.revision).padEnd(revisionColumnWidth)}${row.changeCause ?? '<none>'}`
  })
  return `${header}\n${headerRow}\n${formattedRows.join('\n')}`
}

const formatHistoryDetails = (
  kind: ResourceKind,
  name: string,
  revision: number,
  template: unknown
): string => {
  const renderTemplateMap = (value: unknown): Record<string, unknown> => {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as Record<string, unknown>
  }
  const formatLabelMap = (labels: Record<string, unknown>): string[] => {
    const entries = Object.entries(labels).filter((entry) => {
      return typeof entry[1] === 'string'
    }) as Array<[string, string]>
    if (entries.length === 0) {
      return ['  Labels:       <none>']
    }
    const [firstKey, firstValue] = entries[0]
    const lines = [`  Labels:       ${firstKey}=${firstValue}`]
    for (let index = 1; index < entries.length; index++) {
      const [key, value] = entries[index]
      lines.push(`                ${key}=${value}`)
    }
    return lines
  }

  const templateMap = renderTemplateMap(template)
  const metadataMap = renderTemplateMap(templateMap.metadata)
  const specMap = renderTemplateMap(templateMap.spec)
  const labelsMap = renderTemplateMap(metadataMap.labels)
  const containers = Array.isArray(specMap.containers) ? specMap.containers : []
  const nodeSelectorsMap = renderTemplateMap(specMap.nodeSelector)
  const tolerations = Array.isArray(specMap.tolerations)
    ? specMap.tolerations
    : []
  const volumes = Array.isArray(specMap.volumes) ? specMap.volumes : []

  const lines: string[] = []
  lines.push(...formatLabelMap(labelsMap))
  lines.push('  Containers:')
  if (containers.length === 0) {
    lines.push('   <none>')
  } else {
    for (const container of containers) {
      const containerMap = renderTemplateMap(container)
      const containerName =
        typeof containerMap.name === 'string' ? containerMap.name : 'container'
      const containerImage =
        typeof containerMap.image === 'string' ? containerMap.image : '<none>'
      lines.push(`   ${containerName}:`)
      lines.push(`    Image:      ${containerImage}`)
      const ports = Array.isArray(containerMap.ports) ? containerMap.ports : []
      if (ports.length > 0) {
        const firstPort = renderTemplateMap(ports[0])
        const portValue =
          typeof firstPort.containerPort === 'number'
            ? String(firstPort.containerPort)
            : '<none>'
        const protocol =
          typeof firstPort.protocol === 'string' ? firstPort.protocol : 'TCP'
        const hostPortValue =
          typeof firstPort.hostPort === 'number'
            ? String(firstPort.hostPort)
            : '0'
        lines.push(`    Port:       ${portValue}/${protocol}`)
        lines.push(`    Host Port:  ${hostPortValue}/${protocol}`)
      }
      lines.push('    Environment:  <none>')
      lines.push('    Mounts:       <none>')
    }
  }

  lines.push(`  Volumes:      ${volumes.length > 0 ? '<set>' : '<none>'}`)
  lines.push(
    `  Node-Selectors: ${Object.keys(nodeSelectorsMap).length > 0 ? '<set>' : '<none>'}`
  )
  lines.push(`  Tolerations:  ${tolerations.length > 0 ? '<set>' : '<none>'}`)

  return `${toKindReference(kind)}/${name} with revision #${revision}\nPod Template:\n${lines.join('\n')}`
}

const handleRolloutStatus = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  name: string,
  namespace: string,
  parsed: ParsedCommand,
  reconcileForWait?: (namespace?: string) => void
): ExecutionResult => {
  const watch = parsed.rolloutWatch ?? true
  const timeoutSeconds = parsed.rolloutTimeoutSeconds ?? 60
  const successMessage = `${toKindReference(kind)} "${name}" successfully rolled out`

  if (reconcileForWait == null) {
    const resourceResult = apiServer.findResource(kind, name, namespace)
    if (!resourceResult.ok) {
      return error(
        `Error from server (NotFound): ${toPluralKindReference(kind)} "${name}" not found`
      )
    }
    const status = rolloutStatusComplete(resourceResult.value)
    if (status.done) {
      return success(successMessage)
    }
    return success(formatRolloutWaitingMessage(resourceResult.value, name))
  }

  const maxIterations = Math.max(1, Math.min(timeoutSeconds, 240))
  const progressLines: string[] = []
  let previousWaitingMessage: string | undefined

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (reconcileForWait != null) {
      reconcileForWait(namespace)
    }
    const resourceResult = apiServer.findResource(kind, name, namespace)
    if (!resourceResult.ok) {
      return error(
        `Error from server (NotFound): ${toPluralKindReference(kind)} "${name}" not found`
      )
    }
    const status = rolloutStatusComplete(resourceResult.value)
    if (status.done) {
      if (progressLines.length === 0) {
        return success(successMessage)
      }
      return success([...progressLines, successMessage].join('\n'))
    }
    if (!watch) {
      return success(formatRolloutWaitingMessage(resourceResult.value, name))
    }
    const waitingMessage = formatRolloutWaitingMessage(
      resourceResult.value,
      name
    )
    if (waitingMessage !== previousWaitingMessage) {
      progressLines.push(waitingMessage)
      previousWaitingMessage = waitingMessage
    }
  }

  return error(
    `error: timed out waiting for the condition on ${toKindReference(kind)}/${name}`
  )
}

const handleRolloutHistory = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  name: string,
  namespace: string,
  parsed: ParsedCommand
): ExecutionResult => {
  if (kind === 'Deployment') {
    const deploymentResult = apiServer.findResource(
      'Deployment',
      name,
      namespace
    )
    if (!deploymentResult.ok) {
      return error(
        `Error from server (NotFound): ${toPluralKindReference(kind)} "${name}" not found`
      )
    }
    const ownedReplicaSets = getOwnedReplicaSets(
      apiServer,
      deploymentResult.value
    )
    const sorted = [...ownedReplicaSets].sort((a, b) => {
      return (
        getDeploymentRevisionFromReplicaSet(a) -
        getDeploymentRevisionFromReplicaSet(b)
      )
    })
    const revisionRows: HistorySummaryRow[] = sorted.map((replicaSet) => ({
      revision: getDeploymentRevisionFromReplicaSet(replicaSet),
      changeCause: replicaSet.metadata.annotations?.[CHANGE_CAUSE_ANNOTATION]
    }))
    if (parsed.rolloutRevision != null) {
      const targetReplicaSet = sorted.find((replicaSet) => {
        return (
          getDeploymentRevisionFromReplicaSet(replicaSet) ===
          parsed.rolloutRevision
        )
      })
      if (targetReplicaSet == null) {
        return error(
          `error: unable to find the specified revision ${parsed.rolloutRevision}`
        )
      }
      return success(
        formatHistoryDetails(
          kind,
          name,
          parsed.rolloutRevision,
          targetReplicaSet.spec.template
        )
      )
    }
    return success(formatHistorySummary(kind, name, revisionRows))
  }

  const workloadResult =
    kind === 'DaemonSet'
      ? apiServer.findResource('DaemonSet', name, namespace)
      : apiServer.findResource('StatefulSet', name, namespace)
  if (!workloadResult.ok) {
    return error(
      `Error from server (NotFound): ${toPluralKindReference(kind)} "${name}" not found`
    )
  }

  const revisions = ensureControllerRevisionHistory(
    apiServer,
    workloadResult.value
  )
  if (parsed.rolloutRevision != null) {
    const targetRevision = revisions.find((revision) => {
      return revision.revision === parsed.rolloutRevision
    })
    if (targetRevision == null) {
      return error(
        `error: unable to find the specified revision ${parsed.rolloutRevision}`
      )
    }
    return success(
      formatHistoryDetails(
        kind,
        name,
        targetRevision.revision,
        targetRevision.data.template
      )
    )
  }

  return success(
    formatHistorySummary(
      kind,
      name,
      revisions.map((revision) => ({
        revision: revision.revision,
        changeCause: revision.metadata.annotations?.[CHANGE_CAUSE_ANNOTATION]
      }))
    )
  )
}

const handleRolloutRestart = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  name: string,
  namespace: string
): ExecutionResult => {
  const resourceResult = apiServer.findResource(kind, name, namespace)
  if (!resourceResult.ok) {
    return error(
      `Error from server (NotFound): ${toPluralKindReference(kind)} "${name}" not found`
    )
  }

  if (kind === 'DaemonSet' || kind === 'StatefulSet') {
    ensureControllerRevisionHistory(
      apiServer,
      resourceResult.value as DaemonSet | StatefulSet
    )
  }

  const currentTemplate = getWorkloadTemplate(resourceResult.value)
  const nextTemplate = withRestartAnnotation(
    currentTemplate,
    new Date().toISOString()
  )
  const updatedResource = withUpdatedWorkloadTemplate(
    resourceResult.value,
    nextTemplate
  )
  const updateResult = apiServer.updateResource(
    kind,
    name,
    updatedResource,
    namespace
  )
  if (!updateResult.ok) {
    return error(updateResult.error)
  }

  if (kind === 'DaemonSet' || kind === 'StatefulSet') {
    ensureControllerRevisionHistory(
      apiServer,
      updateResult.value as DaemonSet | StatefulSet
    )
  }

  return success(`${toKindReference(kind)}/${name} restarted`)
}

const handleRolloutUndo = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  name: string,
  namespace: string,
  parsed: ParsedCommand
): ExecutionResult => {
  const resourceResult = apiServer.findResource(kind, name, namespace)
  if (!resourceResult.ok) {
    return error(
      `Error from server (NotFound): ${toPluralKindReference(kind)} "${name}" not found`
    )
  }

  let targetTemplate: unknown | undefined
  if (kind === 'Deployment') {
    const deployment = resourceResult.value as Deployment
    const sortedReplicaSets = getOwnedReplicaSets(apiServer, deployment).sort(
      (a, b) => {
        return (
          getDeploymentRevisionFromReplicaSet(a) -
          getDeploymentRevisionFromReplicaSet(b)
        )
      }
    )
    const desiredRevision = parsed.rolloutRevision
    if (desiredRevision != null) {
      const targetReplicaSet = sortedReplicaSets.find((replicaSet) => {
        return (
          getDeploymentRevisionFromReplicaSet(replicaSet) === desiredRevision
        )
      })
      if (targetReplicaSet == null) {
        return error(
          `error: unable to find the specified revision ${desiredRevision}`
        )
      }
      targetTemplate = targetReplicaSet.spec.template
    } else {
      if (sortedReplicaSets.length < 2) {
        return error('error: no revision found to roll back to')
      }
      targetTemplate =
        sortedReplicaSets[sortedReplicaSets.length - 2].spec.template
    }
  } else {
    const revisions = ensureControllerRevisionHistory(
      apiServer,
      resourceResult.value as DaemonSet | StatefulSet
    )
    const desiredRevision = parsed.rolloutRevision
    if (desiredRevision != null) {
      const targetRevision = revisions.find((revision) => {
        return revision.revision === desiredRevision
      })
      if (targetRevision == null) {
        return error(
          `error: unable to find the specified revision ${desiredRevision}`
        )
      }
      targetTemplate = targetRevision.data.template
    } else {
      if (revisions.length < 2) {
        return error('error: no revision found to roll back to')
      }
      targetTemplate = revisions[revisions.length - 2].data.template
    }
  }

  if (targetTemplate == null) {
    return error('error: no revision found to roll back to')
  }

  const updatedResource = withUpdatedWorkloadTemplate(
    resourceResult.value,
    deepClone(targetTemplate)
  )
  const updateResult = apiServer.updateResource(
    kind,
    name,
    updatedResource,
    namespace
  )
  if (!updateResult.ok) {
    return error(updateResult.error)
  }
  if (kind === 'DaemonSet' || kind === 'StatefulSet') {
    ensureControllerRevisionHistory(
      apiServer,
      updateResult.value as DaemonSet | StatefulSet
    )
  }
  return success(`${toKindReference(kind)}/${name} rolled back`)
}

export const handleRollout = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  reconcileForWait?: (namespace?: string) => void
): ExecutionResult => {
  const target = parseRolloutTarget(parsed)
  if ('ok' in target) {
    return target
  }

  const subcommand = parsed.rolloutSubcommand
  if (subcommand == null) {
    return error('error: rollout requires a subcommand')
  }

  const namespace = parsed.namespace ?? 'default'
  if (subcommand === 'status') {
    return handleRolloutStatus(
      apiServer,
      target.kind,
      target.name,
      namespace,
      parsed,
      reconcileForWait
    )
  }
  if (subcommand === 'history') {
    return handleRolloutHistory(
      apiServer,
      target.kind,
      target.name,
      namespace,
      parsed
    )
  }
  if (subcommand === 'restart') {
    return handleRolloutRestart(apiServer, target.kind, target.name, namespace)
  }
  if (subcommand === 'undo') {
    return handleRolloutUndo(
      apiServer,
      target.kind,
      target.name,
      namespace,
      parsed
    )
  }
  return error(`error: unsupported rollout subcommand "${subcommand}"`)
}
