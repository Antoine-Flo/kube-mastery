// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL AUTOCOMPLETE PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
// Provider d'autocomplete pour les commandes kubectl
// Gère les actions, types de ressources et noms de ressources

import { AutocompleteProvider } from '../../terminal/autocomplete/AutocompleteProvider'
import type {
  AutocompleteClusterState,
  AutocompleteContext,
  CompletionResult
} from '../../terminal/autocomplete/types'

// Actions kubectl
const KUBECTL_ACTIONS = [
  'get',
  'diff',
  'explain',
  'describe',
  'delete',
  'apply',
  'create',
  'logs',
  'exec',
  'label',
  'annotate',
  'version',
  'cluster-info',
  'api-versions',
  'api-resources',
  'scale',
  'run',
  'expose',
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

const CANONICAL_RESOURCE_TYPES = [
  'pods',
  'configmaps',
  'secrets',
  'nodes',
  'replicasets',
  'daemonsets',
  'deployments'
] as const

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
 * v1 policy: only return a completion when prefix has a single match.
 * Ambiguous or empty-match prefixes return no suggestions.
 */
const completeOnlyWhenUnique = (
  items: string[],
  prefix: string,
  suffix: string
): CompletionResult[] => {
  const matches = filterMatches(items, prefix)
  if (matches.length !== 1) {
    return []
  }
  return [{ text: matches[0], suffix }]
}

/**
 * Get resource names from cluster state
 */
const getResourceNames = (
  resourceType: string,
  currentToken: string,
  context: AutocompleteContext
): CompletionResult[] => {
  if (!context.clusterState || typeof context.clusterState !== 'object') {
    return []
  }

  // Map resource types to their getter functions
  const resourceGetters: Record<
    string,
    (state: AutocompleteClusterState) => unknown[]
  > = {
    pods: (state) => (state.getPods ? state.getPods() : []),
    configmaps: (state) => (state.getConfigMaps ? state.getConfigMaps() : []),
    secrets: (state) => (state.getSecrets ? state.getSecrets() : []),
    nodes: (state) => (state.getNodes ? state.getNodes() : []),
    replicasets: (state) =>
      state.getReplicaSets ? state.getReplicaSets() : [],
    daemonsets: (state) => (state.getDaemonSets ? state.getDaemonSets() : []),
    deployments: (state) => (state.getDeployments ? state.getDeployments() : [])
  }

  const getter = resourceGetters[resourceType]
  if (!getter) {
    return []
  }

  const names = getter(context.clusterState).map(
    (resource) => (resource as { metadata?: { name?: unknown } }).metadata?.name
  ) as string[]

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
    const isActionPosition =
      tokens.length === 1 ||
      (tokens.length === 2 && currentToken !== '' && tokens[1] === currentToken)
    if (isActionPosition) {
      return completeOnlyWhenUnique([...KUBECTL_ACTIONS], currentToken, ' ')
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
      const isResourceTypePosition =
        tokens.length === 2 ||
        (tokens.length === 3 &&
          currentToken !== '' &&
          tokens[2] === currentToken)
      if (isResourceTypePosition) {
        return completeOnlyWhenUnique(
          [...CANONICAL_RESOURCE_TYPES],
          currentToken,
          ' '
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
