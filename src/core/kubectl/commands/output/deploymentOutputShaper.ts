import type {
  Deployment,
  DeploymentCondition,
  DeploymentStatus
} from '../../../cluster/ressources/Deployment'

const DEPLOYMENT_REVISION_ANNOTATION = 'deployment.kubernetes.io/revision'

const stableHash = (value: string): string => {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const buildUid = (deployment: Deployment): string => {
  const base = `${deployment.metadata.namespace}/${deployment.metadata.name}/${deployment.metadata.creationTimestamp}`
  const chunk = stableHash(base)
  return `${chunk}-${chunk.slice(0, 4)}-${chunk.slice(4)}-${chunk.slice(0, 4)}-${chunk}${chunk.slice(0, 4)}`
}

const buildResourceVersion = (deployment: Deployment): string => {
  const base = `${deployment.metadata.namespace}/${deployment.metadata.name}/${deployment.metadata.creationTimestamp}`
  const numeric = parseInt(stableHash(base).slice(0, 7), 16)
  return String((numeric % 900000) + 100000)
}

const toDeploymentConditions = (
  deployment: Deployment,
  status: DeploymentStatus
): DeploymentCondition[] => {
  if (status.conditions != null && status.conditions.length > 0) {
    return status.conditions
  }
  const now = deployment.metadata.creationTimestamp
  const desiredReplicas = deployment.spec.replicas ?? 1
  const availableReplicas = status.availableReplicas ?? 0
  const isAvailable = availableReplicas >= desiredReplicas
  return [
    {
      type: 'Progressing',
      status: 'True',
      reason: 'NewReplicaSetAvailable',
      message: `ReplicaSet "${deployment.metadata.name}" has successfully progressed.`,
      lastTransitionTime: now,
      lastUpdateTime: now
    },
    {
      type: 'Available',
      status: isAvailable ? 'True' : 'False',
      reason: isAvailable
        ? 'MinimumReplicasAvailable'
        : 'MinimumReplicasUnavailable',
      message: isAvailable
        ? 'Deployment has minimum availability.'
        : 'Deployment does not have minimum availability.',
      lastTransitionTime: now,
      lastUpdateTime: now
    }
  ]
}

export const shapeDeploymentForStructuredOutput = (
  deployment: Deployment
): Record<string, unknown> => {
  const generation = deployment.metadata.generation ?? 1
  const conditions = toDeploymentConditions(deployment, deployment.status)
  const metadataAnnotations = Object.entries(
    deployment.metadata.annotations ?? {}
  ).reduce<Record<string, string>>((acc, [key, value]) => {
    if (key.startsWith('sim.kubernetes.io/')) {
      return acc
    }
    acc[key] = value
    return acc
  }, {})

  if (metadataAnnotations[DEPLOYMENT_REVISION_ANNOTATION] == null) {
    metadataAnnotations[DEPLOYMENT_REVISION_ANNOTATION] = '1'
  }

  return {
    apiVersion: deployment.apiVersion,
    kind: deployment.kind,
    metadata: {
      ...(Object.keys(metadataAnnotations).length > 0
        ? { annotations: metadataAnnotations }
        : {}),
      creationTimestamp: deployment.metadata.creationTimestamp,
      generation,
      ...(deployment.metadata.labels != null
        ? { labels: deployment.metadata.labels }
        : {}),
      name: deployment.metadata.name,
      namespace: deployment.metadata.namespace,
      resourceVersion: buildResourceVersion(deployment),
      uid: buildUid(deployment)
    },
    spec: deployment.spec,
    status: {
      availableReplicas: deployment.status.availableReplicas ?? 0,
      conditions,
      observedGeneration: deployment.status.observedGeneration ?? generation,
      readyReplicas: deployment.status.readyReplicas ?? 0,
      replicas: deployment.status.replicas ?? 0,
      terminatingReplicas: 0,
      updatedReplicas: deployment.status.updatedReplicas ?? 0
    }
  }
}
