import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { Pod } from '../../../cluster/ressources/Pod'
import type { ReplicaSet } from '../../../cluster/ressources/ReplicaSet'
import { selectorMatchesLabels } from '../../../cluster/ressources/ReplicaSet'
import { formatAge } from '../../../shared/formatter'
import { formatLabels, formatSelector } from '../internal/helpers'

export const describeReplicaSet = (
  replicaSet: ReplicaSet,
  state?: ClusterStateData
): string => {
  const hasReplicaSetOwnerReference = (pod: Pod): boolean => {
    const ownerReferences = pod.metadata.ownerReferences ?? []
    return ownerReferences.some((ownerReference) => {
      return (
        ownerReference.kind === 'ReplicaSet' &&
        ownerReference.name === replicaSet.metadata.name
      )
    })
  }
  const getManagedPods = (): Pod[] => {
    if (state == null) {
      return []
    }
    const selectorMatchedPods = state.pods.items.filter((pod) => {
      if (pod.metadata.namespace !== replicaSet.metadata.namespace) {
        return false
      }
      return selectorMatchesLabels(
        replicaSet.spec.selector,
        pod.metadata.labels ?? {}
      )
    })
    const ownerMatchedPods = selectorMatchedPods.filter((pod) => {
      return hasReplicaSetOwnerReference(pod)
    })
    if (ownerMatchedPods.length > 0) {
      return ownerMatchedPods
    }
    return selectorMatchedPods
  }
  const managedPods = getManagedPods()
  const getPodsStatusLine = (): string => {
    const counts = {
      running: 0,
      waiting: 0,
      succeeded: 0,
      failed: 0
    }
    for (const pod of managedPods) {
      if (pod.status.phase === 'Running') {
        counts.running += 1
      } else if (pod.status.phase === 'Succeeded') {
        counts.succeeded += 1
      } else if (pod.status.phase === 'Failed') {
        counts.failed += 1
      } else {
        counts.waiting += 1
      }
    }
    return `${counts.running} Running / ${counts.waiting} Waiting / ${counts.succeeded} Succeeded / ${counts.failed} Failed`
  }
  const buildReplicaSetEventLines = (): string[] => {
    if (managedPods.length === 0) {
      return ['Events:            <none>']
    }
    const lines: string[] = [
      'Events:',
      '  Type    Reason            Age   From                   Message',
      '  ----    ------            ----  ----                   -------'
    ]
    const sortedPods = [...managedPods].sort((left, right) => {
      return (
        Date.parse(left.metadata.creationTimestamp) -
        Date.parse(right.metadata.creationTimestamp)
      )
    })
    for (const pod of sortedPods) {
      lines.push(
        `  Normal  SuccessfulCreate  ${formatAge(pod.metadata.creationTimestamp)}    replicaset-controller  Created pod: ${pod.metadata.name}`
      )
    }
    return lines
  }
  const renderContainerEnvironment = (
    container: ReplicaSet['spec']['template']['spec']['containers'][number]
  ): string[] => {
    if (container.env == null || container.env.length === 0) {
      return ['    Environment:   <none>']
    }
    const lines: string[] = ['    Environment:']
    for (const envVar of container.env) {
      if (envVar.source.type === 'value') {
        lines.push(`      ${envVar.name}:  ${envVar.source.value}`)
      } else if (envVar.source.type === 'configMapKeyRef') {
        lines.push(
          `      ${envVar.name}:  <set to the key '${envVar.source.key}' in config map '${envVar.source.name}'>`
        )
      } else {
        lines.push(
          `      ${envVar.name}:  <set to the key '${envVar.source.key}' of secret '${envVar.source.name}'>`
        )
      }
    }
    return lines
  }
  const renderContainerMounts = (
    container: ReplicaSet['spec']['template']['spec']['containers'][number]
  ): string[] => {
    if (container.volumeMounts == null || container.volumeMounts.length === 0) {
      return ['    Mounts:        <none>']
    }
    const lines: string[] = ['    Mounts:']
    for (const volumeMount of container.volumeMounts) {
      lines.push(
        `      ${volumeMount.mountPath} from ${volumeMount.name} (${volumeMount.readOnly === true ? 'ro' : 'rw'})`
      )
    }
    return lines
  }
  const renderTemplateVolumes = (): string[] => {
    const volumes = replicaSet.spec.template.spec.volumes
    if (volumes == null || volumes.length === 0) {
      return ['  Volumes:         <none>']
    }
    const lines: string[] = ['  Volumes:']
    for (const volume of volumes) {
      lines.push(`   ${volume.name}:`)
      lines.push(`    Type:          ${volume.source.type}`)
    }
    return lines
  }
  const renderTemplateTolerations = (): string => {
    const tolerations = replicaSet.spec.template.spec.tolerations
    if (tolerations == null || tolerations.length === 0) {
      return '  Tolerations:     <none>'
    }
    const firstToleration = tolerations[0]
    const firstKey = firstToleration.key ?? '<none>'
    const firstOperator = firstToleration.operator ?? 'Equal'
    const firstValue = firstToleration.value ?? '<none>'
    const firstEffect = firstToleration.effect ?? '<none>'
    const firstRendered = `${firstKey}:${firstOperator}:${firstValue}:${firstEffect}`
    return `  Tolerations:     ${firstRendered}`
  }
  const lines: string[] = []
  const desiredReplicas = replicaSet.spec.replicas ?? 1
  const statusReplicas = replicaSet.status.replicas ?? 0
  const currentReplicas =
    statusReplicas > 0 ? statusReplicas : managedPods.length

  lines.push(`Name:         ${replicaSet.metadata.name}`)
  lines.push(`Namespace:    ${replicaSet.metadata.namespace}`)
  lines.push(`Selector:     ${formatSelector(replicaSet.spec.selector)}`)
  lines.push(`Labels:       ${formatLabels(replicaSet.metadata.labels)}`)
  lines.push(`Annotations:  ${formatLabels(replicaSet.metadata.annotations)}`)
  lines.push(
    `Replicas:     ${currentReplicas} current / ${desiredReplicas} desired`
  )
  lines.push(`Pods Status:  ${getPodsStatusLine()}`)

  lines.push('Pod Template:')
  lines.push(
    `  Labels:  ${formatLabels(replicaSet.spec.template.metadata?.labels)}`
  )
  lines.push(
    `  Annotations:  ${formatLabels(replicaSet.spec.template.metadata?.annotations)}`
  )
  lines.push('  Containers:')
  for (const container of replicaSet.spec.template.spec.containers) {
    lines.push(`   ${container.name}:`)
    lines.push(`    Image:         ${container.image}`)
    if (container.command != null && container.command.length > 0) {
      lines.push(`    Command:       ${container.command.join(' ')}`)
    }
    if (container.args != null && container.args.length > 0) {
      lines.push(`    Args:          ${container.args.join(' ')}`)
    }
    if (container.ports != null && container.ports.length > 0) {
      const firstPort = container.ports[0]
      lines.push(
        `    Port:          ${firstPort.containerPort}/${firstPort.protocol ?? 'TCP'}`
      )
      lines.push(`    Host Port:     0/${firstPort.protocol ?? 'TCP'}`)
    } else {
      lines.push('    Port:          <none>')
      lines.push('    Host Port:     <none>')
    }
    lines.push(...renderContainerEnvironment(container))
    lines.push(...renderContainerMounts(container))
  }
  lines.push(...renderTemplateVolumes())
  lines.push(
    `  Node-Selectors:  ${formatLabels(replicaSet.spec.template.spec.nodeSelector)}`
  )
  lines.push(renderTemplateTolerations())
  lines.push(...buildReplicaSetEventLines())

  return lines.join('\n')
}
