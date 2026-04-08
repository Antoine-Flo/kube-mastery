import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import { createNamespace } from '../../../../../cluster/ressources/Namespace'
import type { ExecutionResult } from '../../../../../shared/result'
import { createResourceWithEvents } from '../../../resourceCatalog'
import type { ParsedCommand } from '../../../types'

export const buildCreateNamespaceDryRunManifest = (
  parsed: ParsedCommand & { name: string }
): Record<string, unknown> => {
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: parsed.name
    },
    spec: {},
    status: {}
  }
}

export const isCreateNamespaceImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & { name: string } => {
  if (parsed.resource !== 'namespaces') {
    return false
  }
  if (typeof parsed.name !== 'string') {
    return false
  }
  return parsed.name.length > 0
}

export const createNamespaceFromFlags = (
  parsed: ParsedCommand & { name: string },
  apiServer: ApiServerFacade
): ExecutionResult => {
  const namespace = createNamespace({
    name: parsed.name,
    labels: {
      'kubernetes.io/metadata.name': parsed.name
    }
  })

  return createResourceWithEvents(namespace, apiServer)
}
