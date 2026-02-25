// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL AUTOCOMPLETE PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
// Provider d'autocomplete pour les commandes kubectl
// Gère les actions, types de ressources et noms de ressources

import { AutocompleteProvider } from '../../terminal/autocomplete/AutocompleteProvider'
import type {
  AutocompleteContext,
  CompletionResult
} from '../../terminal/autocomplete/types'

// Actions kubectl
const KUBECTL_ACTIONS = [
  'get',
  'describe',
  'delete',
  'apply',
  'logs',
  'exec',
  'scale',
  'run',
  'config'
] as const

const KUBECTL_CONFIG_SUBCOMMANDS = [
  'get-contexts',
  'current-context',
  'view',
  'set-context'
] as const

// Resource type aliases (for kubectl completion)
const RESOURCE_ALIASES: Record<string, string> = {
  pods: 'pods',
  pod: 'pods',
  po: 'pods',
  configmaps: 'configmaps',
  configmap: 'configmaps',
  cm: 'configmaps',
  secrets: 'secrets',
  secret: 'secrets',
  nodes: 'nodes',
  node: 'nodes',
  no: 'nodes',
  replicasets: 'replicasets',
  replicaset: 'replicasets',
  rs: 'replicasets',
  daemonsets: 'daemonsets',
  daemonset: 'daemonsets',
  ds: 'daemonsets',
  deployments: 'deployments',
  deployment: 'deployments',
  deploy: 'deployments'
}

/**
 * Filter array to items that start with prefix (case-sensitive)
 */
const filterMatches = (items: string[], prefix: string): string[] => {
  if (!prefix) {
    return items
  }
  return items.filter((item) => item.startsWith(prefix))
}

/**
 * Get resource names from cluster state
 */
const getResourceNames = (
  resourceType: string,
  currentToken: string,
  context: AutocompleteContext
): CompletionResult[] => {
  // Type guard pour vérifier que clusterState a les méthodes nécessaires
  if (
    !context.clusterState ||
    typeof context.clusterState.getPods !== 'function'
  ) {
    return []
  }

  // Map resource types to their getter functions
  const resourceGetters: Record<
    string,
    (state: typeof context.clusterState) => string[]
  > = {
    pods: (state) => state.getPods().map((pod: any) => pod.metadata.name),
    configmaps: (state) =>
      state.getConfigMaps().map((cm: any) => cm.metadata.name),
    secrets: (state) =>
      state.getSecrets().map((secret: any) => secret.metadata.name),
    nodes: (state) => state.getNodes().map((node: any) => node.metadata.name),
    replicasets: (state) =>
      state.getReplicaSets().map((rs: any) => rs.metadata.name),
    daemonsets: (state) =>
      state.getDaemonSets().map((daemonSet: any) => daemonSet.metadata.name),
    deployments: (state) =>
      state.getDeployments().map((deploy: any) => deploy.metadata.name)
  }

  const getter = resourceGetters[resourceType]
  if (!getter) {
    return []
  }

  const names = getter(context.clusterState)
  return filterMatches(names, currentToken).map((name) => ({
    text: name,
    suffix: ' '
  }))
}

export class KubectlAutocompleteProvider extends AutocompleteProvider {
  priority(): number {
    return 20 // Priorité moyenne = après shell, avant filesystem
  }

  match(tokens: string[], _currentToken: string, line: string): boolean {
    // Match si on est sur kubectl
    if (tokens[0] !== 'kubectl') {
      return false
    }

    // Action kubectl (position 1)
    if (tokens.length === 1 || (tokens.length === 2 && !line.endsWith(' '))) {
      return true
    }

    const action = tokens[1]
    if (action === 'config') {
      if (tokens.length === 2 || (tokens.length === 3 && !line.endsWith(' '))) {
        return true
      }
      return false
    }

    // Type de ressource (position 2) - sauf pour logs/exec/run
    if (action === 'logs' || action === 'exec' || action === 'run') {
      // logs/exec/run prennent directement le nom du pod (position 2)
      return tokens.length >= 2
    }

    // Autres actions : type de ressource à la position 2
    if (tokens.length === 2 || (tokens.length === 3 && !line.endsWith(' '))) {
      return true
    }

    // Nom de ressource (position 3, ou position 2 pour logs/exec)
    return tokens.length >= 3
  }

  complete(
    tokens: string[],
    currentToken: string,
    context: AutocompleteContext
  ): CompletionResult[] {
    // Action kubectl (position 1)
    if (tokens.length === 1) {
      return filterMatches([...KUBECTL_ACTIONS], currentToken).map(
        (action) => ({ text: action, suffix: ' ' })
      )
    }

    const action = tokens[1]

    if (action === 'config') {
      if (tokens.length === 2) {
        return filterMatches([...KUBECTL_CONFIG_SUBCOMMANDS], currentToken).map(
          (subcommand) => ({ text: subcommand, suffix: ' ' })
        )
      }
      if (tokens[2] === 'set-context') {
        const setContextFlags = ['--current', '--namespace=']
        return filterMatches(setContextFlags, currentToken).map((flag) => ({
          text: flag,
          suffix: flag.endsWith('=') ? '' : ' '
        }))
      }
      if (tokens[2] === 'view') {
        return filterMatches(['--minify'], currentToken).map((flag) => ({
          text: flag,
          suffix: ' '
        }))
      }
      return []
    }

    // Type de ressource (position 2) - sauf pour logs/exec/run
    if (action !== 'logs' && action !== 'exec' && action !== 'run') {
      if (tokens.length === 2) {
        const allResourceTypes = Object.keys(RESOURCE_ALIASES)
        return filterMatches(allResourceTypes, currentToken).map(
          (resource) => ({ text: resource, suffix: ' ' })
        )
      }
    }

    if (action === 'run') {
      return []
    }

    // Nom de ressource
    let resourceType = 'pods'

    // For logs/exec, always use pods
    if (action === 'logs' || action === 'exec') {
      resourceType = 'pods'
    } else if (tokens.length >= 3) {
      // Map resource alias to canonical name
      const resource = tokens[2]
      resourceType = RESOURCE_ALIASES[resource] || resource
    }

    return getResourceNames(resourceType, currentToken, context)
  }
}
