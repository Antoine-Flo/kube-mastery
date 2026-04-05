import type { Secret } from '../../../cluster/ressources/Secret'
import {
  buildDeterministicResourceVersion,
  buildDeterministicUid,
  normalizeKubernetesTimestamp
} from './metadataOutput'

export const shapeSecretForStructuredOutput = (
  secret: Secret
): Record<string, unknown> => {
  const creationTimestamp = normalizeKubernetesTimestamp(
    secret.metadata.creationTimestamp
  )
  return {
    apiVersion: secret.apiVersion,
    data: secret.data,
    kind: secret.kind,
    metadata: {
      creationTimestamp,
      ...(secret.metadata.labels != null
        ? { labels: secret.metadata.labels }
        : {}),
      ...(secret.metadata.annotations != null
        ? { annotations: secret.metadata.annotations }
        : {}),
      name: secret.metadata.name,
      namespace: secret.metadata.namespace,
      resourceVersion: buildDeterministicResourceVersion(
        secret.metadata.namespace,
        secret.metadata.name,
        creationTimestamp
      ),
      uid: buildDeterministicUid(
        secret.metadata.namespace,
        secret.metadata.name,
        creationTimestamp
      )
    },
    type: secret.type.type
  }
}
