import type { ConfigMap } from '../../../cluster/ressources/ConfigMap'
import {
  buildDeterministicResourceVersion,
  buildDeterministicUid,
  normalizeKubernetesTimestamp
} from './metadataOutput'

export const shapeConfigMapForStructuredOutput = (
  configMap: ConfigMap
): Record<string, unknown> => {
  const creationTimestamp = normalizeKubernetesTimestamp(
    configMap.metadata.creationTimestamp
  )
  return {
    apiVersion: configMap.apiVersion,
    ...(configMap.data != null ? { data: configMap.data } : {}),
    ...(configMap.binaryData != null
      ? { binaryData: configMap.binaryData }
      : {}),
    kind: configMap.kind,
    metadata: {
      creationTimestamp,
      ...(configMap.metadata.labels != null
        ? { labels: configMap.metadata.labels }
        : {}),
      ...(configMap.metadata.annotations != null
        ? { annotations: configMap.metadata.annotations }
        : {}),
      name: configMap.metadata.name,
      namespace: configMap.metadata.namespace,
      resourceVersion: buildDeterministicResourceVersion(
        configMap.metadata.namespace,
        configMap.metadata.name,
        creationTimestamp
      ),
      uid: buildDeterministicUid(
        configMap.metadata.namespace,
        configMap.metadata.name,
        creationTimestamp
      )
    }
  }
}
