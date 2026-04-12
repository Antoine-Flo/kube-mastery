// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL AUTOCOMPLETE PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
// Provider d'autocomplete pour les commandes kubectl
// Gère les actions, types de ressources et noms de ressources

import { AutocompleteProvider } from '../../terminal/autocomplete/AutocompleteProvider'
import {
  RESOURCE_ALIAS_MAP,
  resolveUniqueKubectlResourceKind,
  resolveUniqueKubectlResourceKindAllowlist,
  type KubectlResource
} from '../commands/resourceCatalog'
import { completeKubectlFromSpec } from '../cli/runtime/completion'
import { KUBECTL_ROOT_COMMAND_SPEC } from '../cli/registry/root'
import type {
  AutocompleteClusterState,
  AutocompleteContext,
  CompletionResult
} from '../../terminal/autocomplete/types'

const KUBECTL_ROLLOUT_SUBCOMMANDS = [
  'status',
  'history',
  'restart',
  'undo'
] as const
const KUBECTL_ACTIONS = KUBECTL_ROOT_COMMAND_SPEC.subcommands.map((command) => {
  return command.path[command.path.length - 1]
})

/**
 * Cluster-backed name completion: only kinds where the terminal exposes a list API.
 * Resource *type* completion uses all keys from KUBECTL_RESOURCES (resourceCatalog).
 */
const RESOURCE_GETTERS: Partial<
  Record<KubectlResource, (state: AutocompleteClusterState) => unknown[]>
> = {
  pods: (state) => (state.getPods ? state.getPods() : []),
  configmaps: (state) => (state.getConfigMaps ? state.getConfigMaps() : []),
  secrets: (state) => (state.getSecrets ? state.getSecrets() : []),
  nodes: (state) => (state.getNodes ? state.getNodes() : []),
  replicasets: (state) => (state.getReplicaSets ? state.getReplicaSets() : []),
  daemonsets: (state) => (state.getDaemonSets ? state.getDaemonSets() : []),
  statefulsets: (state) =>
    state.getStatefulSets ? state.getStatefulSets() : [],
  deployments: (state) => (state.getDeployments ? state.getDeployments() : []),
  leases: (state) => (state.getLeases ? state.getLeases() : []),
  networkpolicies: (state) =>
    state.getNetworkPolicies ? state.getNetworkPolicies() : [],
  namespaces: (state) => (state.getNamespaces ? state.getNamespaces() : [])
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

  const getter = RESOURCE_GETTERS[resourceType as KubectlResource]
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
    if (action === 'rollout') {
      return tokens.length >= 2
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
    if ((action === 'logs' || action === 'exec') && tokens.length === 2) {
      return getResourceNames('pods', currentToken, context)
    }

    const canUseStaticRegistryCompletion =
      tokens.length > 2 || currentToken.startsWith('-')
    if (canUseStaticRegistryCompletion) {
      const staticLine = tokens.join(' ')
      const staticSuggestions = completeKubectlFromSpec(staticLine).map(
        (suggestion) => ({
          text: suggestion.text,
          suffix: suggestion.suffix
        })
      )
      if (staticSuggestions.length > 0) {
        // create uses spec subcommands (namespace, deployment, ...), not API plural kinds (namespaces).
        const isResourceResolutionStep =
          tokens.length >= 3 &&
          tokens[0] === 'kubectl' &&
          action !== 'logs' &&
          action !== 'exec' &&
          action !== 'run' &&
          action !== 'create'
        if (!isResourceResolutionStep) {
          return staticSuggestions
        }
      }
    }

    if (action === 'rollout') {
      if (tokens.length === 2) {
        return filterMatches(
          [...KUBECTL_ROLLOUT_SUBCOMMANDS],
          currentToken
        ).map((subcommand) => ({ text: subcommand, suffix: ' ' }))
      }
      if (
        tokens.length === 3 &&
        currentToken !== '' &&
        tokens[2] === currentToken
      ) {
        return filterMatches(
          [...KUBECTL_ROLLOUT_SUBCOMMANDS],
          currentToken
        ).map((subcommand) => ({ text: subcommand, suffix: ' ' }))
      }

      const rolloutSubcommand = tokens[2]
      if (!KUBECTL_ROLLOUT_SUBCOMMANDS.includes(rolloutSubcommand as never)) {
        return []
      }

      const rolloutResourceKinds: KubectlResource[] = [
        'deployments',
        'daemonsets',
        'statefulsets'
      ]
      const isResourceTypePosition =
        tokens.length === 3 ||
        (tokens.length === 4 &&
          currentToken !== '' &&
          tokens[3] === currentToken)
      if (isResourceTypePosition) {
        const kind = resolveUniqueKubectlResourceKindAllowlist(
          currentToken,
          rolloutResourceKinds
        )
        if (kind == null) {
          return []
        }
        return [{ text: kind, suffix: ' ' }]
      }

      if (tokens.length < 4) {
        return []
      }

      const resourceType = RESOURCE_ALIAS_MAP[tokens[3]] || tokens[3]
      return getResourceNames(resourceType, currentToken, context)
    }

    if (action === 'config') {
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
        const kind = resolveUniqueKubectlResourceKind(currentToken)
        if (kind == null) {
          return []
        }
        return [{ text: kind, suffix: ' ' }]
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
      resourceType = RESOURCE_ALIAS_MAP[resource] || resource
    }

    return getResourceNames(resourceType, currentToken, context)
  }
}
