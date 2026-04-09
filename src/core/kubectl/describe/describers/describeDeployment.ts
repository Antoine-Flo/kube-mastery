import type { DeploymentLifecycleDescribeEvent } from '../../../api/DeploymentLifecycleEventStore'
import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { Deployment } from '../../../cluster/ressources/Deployment'
import { blank, indent, kv, section } from '../../formatters/describeHelpers'
import {
  findDeploymentReplicaSets,
  formatDeploymentConditions,
  formatDeploymentEvents,
  formatDeploymentOldReplicaSets,
  formatDeploymentReplicaSetReference,
  formatDeploymentReplicas,
  formatDescribeDate,
  formatIntOrString,
  formatLabels,
  formatSelector,
  formatStrategyType,
  formatTemplateEnv,
} from '../internal/helpers'

export const describeDeployment = (
  deployment: Deployment,
  state?: ClusterStateData,
  deploymentLifecycleEvents?: readonly DeploymentLifecycleDescribeEvent[]
): string => {
  const lines: string[] = []
  const strategyType = formatStrategyType(deployment.spec.strategy?.type)

  lines.push(`Name:             ${deployment.metadata.name}`)
  lines.push(`Namespace:        ${deployment.metadata.namespace}`)
  lines.push(
    `CreationTimestamp: ${formatDescribeDate(deployment.metadata.creationTimestamp)}`
  )
  lines.push(`Labels:           ${formatLabels(deployment.metadata.labels)}`)
  lines.push(
    `Annotations:      ${formatLabels(deployment.metadata.annotations)}`
  )
  lines.push(`Selector:         ${formatSelector(deployment.spec.selector)}`)
  lines.push(`Replicas:         ${formatDeploymentReplicas(deployment)}`)
  lines.push(`StrategyType:     ${strategyType}`)
  lines.push(`MinReadySeconds:  ${deployment.spec.minReadySeconds ?? 0}`)
  if (deployment.spec.strategy?.rollingUpdate != null) {
    const rollingUpdate = deployment.spec.strategy?.rollingUpdate
    lines.push(
      `RollingUpdateStrategy: ${formatIntOrString(rollingUpdate?.maxUnavailable)} max unavailable, ${formatIntOrString(rollingUpdate?.maxSurge)} max surge`
    )
  }

  lines.push(blank())

  const templateLines: string[] = []
  templateLines.push(
    kv('Labels', formatLabels(deployment.spec.template.metadata?.labels))
  )
  templateLines.push(
    kv(
      'Annotations',
      formatLabels(deployment.spec.template.metadata?.annotations)
    )
  )
  templateLines.push(
    kv(
      'Node-Selectors',
      formatLabels(deployment.spec.template.spec.nodeSelector)
    )
  )

  const tolerations = deployment.spec.template.spec.tolerations
  if (tolerations && tolerations.length > 0) {
    const tolerationParts = tolerations.map((toleration) => {
      const key = toleration.key ?? '<none>'
      const operator = toleration.operator ?? 'Equal'
      const value = toleration.value ?? '<none>'
      const effect = toleration.effect ?? '<none>'
      return `${key}:${operator}:${value}:${effect}`
    })
    templateLines.push(kv('Tolerations', tolerationParts.join(', ')))
  } else {
    templateLines.push(kv('Tolerations', '<none>'))
  }

  const initContainers = deployment.spec.template.spec.initContainers
  if (initContainers && initContainers.length > 0) {
    templateLines.push('Init Containers:')
    for (const container of initContainers) {
      templateLines.push(indent(`${container.name}:`, 1))
      templateLines.push(indent(kv('Image', container.image), 2))
    }
  }

  templateLines.push('Containers:')
  for (const container of deployment.spec.template.spec.containers) {
    templateLines.push(indent(`${container.name}:`, 1))
    templateLines.push(indent(kv('Image', container.image), 2))

    if (container.command && container.command.length > 0) {
      templateLines.push(indent('Command:', 2))
      for (const cmd of container.command) {
        templateLines.push(indent(cmd, 3))
      }
    }

    if (container.args && container.args.length > 0) {
      templateLines.push(indent('Args:', 2))
      for (const arg of container.args) {
        templateLines.push(indent(arg, 3))
      }
    }

    if (container.ports && container.ports.length > 0) {
      const ports = container.ports
        .map((port) => `${port.containerPort}/${port.protocol ?? 'TCP'}`)
        .join(', ')
      templateLines.push(indent(kv('Ports', ports), 2))
    }

    if (container.env && container.env.length > 0) {
      templateLines.push(indent('Environment:', 2))
      for (const envVar of container.env) {
        formatTemplateEnv(envVar, templateLines)
      }
    }
  }

  lines.push(...section('Pod Template', templateLines))
  lines.push(blank())
  lines.push(...formatDeploymentConditions(deployment.status.conditions))
  lines.push(blank())
  const deploymentReplicaSets = findDeploymentReplicaSets(deployment, state)
  lines.push(
    `OldReplicaSets:    ${formatDeploymentOldReplicaSets(deploymentReplicaSets.oldReplicaSets)}`
  )
  lines.push(
    `NewReplicaSet:     ${formatDeploymentReplicaSetReference(deploymentReplicaSets.newReplicaSet)}`
  )
  lines.push(...formatDeploymentEvents(deploymentLifecycleEvents))

  return lines.join('\n')
}
