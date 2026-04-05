import type { Deployment } from '../../../../../cluster/ressources/Deployment'
import type { Pod } from '../../../../../cluster/ressources/Pod'
import type { Secret } from '../../../../../cluster/ressources/Secret'
import type { ConfigMap } from '../../../../../cluster/ressources/ConfigMap'
import type { Resource } from '../../../types'
import { RESOURCE_OUTPUT_METADATA_BY_RESOURCE } from '../../../resourceHelpers'
import { shapeDeploymentForStructuredOutput } from '../../../output/deploymentOutputShaper'
import { shapePodForStructuredOutput } from '../../../output/podOutputShaper'
import { shapeConfigMapForStructuredOutput } from '../../../output/configMapOutputShaper'
import { shapeSecretForStructuredOutput } from '../../../output/secretOutputShaper'
import type {
  ResourceListOutput,
  ResourceOutputMetadata,
  ResourceWithMetadata,
  StructuredResource
} from './types'

export const sanitizeForOutput = <T extends Record<string, unknown>>(
  resource: T
): Omit<T, '_simulator'> => {
  const { _simulator, ...rest } = resource as T & { _simulator?: unknown }
  return rest as Omit<T, '_simulator'>
}

const getResourceOutputMetadata = (
  resourceType: StructuredResource
): ResourceOutputMetadata => {
  return RESOURCE_OUTPUT_METADATA_BY_RESOURCE[resourceType]
}

export const buildListOutput = <T>(
  resourceType: StructuredResource,
  items: T[],
  resourceVersion: string
): ResourceListOutput<T> => {
  const metadata = getResourceOutputMetadata(resourceType)
  return {
    apiVersion: metadata.apiVersion,
    items,
    kind: 'List',
    metadata: {
      resourceVersion
    }
  }
}

export const buildGenericListOutput = <T>(
  items: T[],
  resourceVersion: string
): ResourceListOutput<T> => {
  return {
    apiVersion: 'v1',
    items,
    kind: 'List',
    metadata: {
      resourceVersion
    }
  }
}

export const shapeStructuredItemsForOutput = (
  resourceType: StructuredResource,
  items: unknown[]
): unknown[] => {
  if (resourceType === 'pods') {
    return items.map((item) => {
      return shapePodForStructuredOutput(item as Pod)
    })
  }
  if (resourceType === 'deployments') {
    return items.map((item) => {
      return shapeDeploymentForStructuredOutput(item as Deployment)
    })
  }
  if (resourceType === 'secrets') {
    return items.map((item) => {
      return shapeSecretForStructuredOutput(item as Secret)
    })
  }
  if (resourceType === 'configmaps') {
    return items.map((item) => {
      return shapeConfigMapForStructuredOutput(item as ConfigMap)
    })
  }
  return items
}

export const buildNotFoundErrorMessage = (
  resourceType: Resource,
  name: string,
  toPluralResourceKindReference: (resourceType: Resource) => string
): string => {
  const pluralReference = toPluralResourceKindReference(resourceType)
  return `Error from server (NotFound): ${pluralReference} "${name}" not found`
}

export const buildNameOutput = (
  resourceType: Resource,
  resources: ResourceWithMetadata[],
  toResourceKindReference: (resourceType: Resource) => string
): string => {
  const kindReference = toResourceKindReference(resourceType)
  const lines = resources.map((resource) => {
    return `${kindReference}/${resource.metadata.name}`
  })
  return lines.join('\n')
}

export const appendTrailingErrors = (
  output: string,
  errors: string[]
): string => {
  if (errors.length === 0) {
    return output
  }
  if (output.length === 0) {
    return errors.join('\n')
  }
  return `${output}\n${errors.join('\n')}`
}

export const isStructuredOutputDirective = (kind: string): boolean => {
  return kind === 'json' || kind === 'yaml' || kind === 'jsonpath'
}
