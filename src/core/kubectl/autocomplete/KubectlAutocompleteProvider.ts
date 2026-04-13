// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL AUTOCOMPLETE PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
// Provider d'autocomplete pour les commandes kubectl
// Gère les actions, types de ressources et noms de ressources

import { AutocompleteProvider } from '../../terminal/autocomplete/AutocompleteProvider'
import {
  KUBECTL_RESOURCES,
  RESOURCE_ALIAS_MAP,
  type KubectlResource
} from '../commands/resourceCatalog'
import type {
  KubectlCommandSpec,
  KubectlCompletionResourceNames,
  KubectlCompletionResourceTypes
} from '../cli/model'
import { completeKubectlFromSpec } from '../cli/runtime/completion'
import { resolveKubectlCommand } from '../cli/runtime/resolve'
import { KUBECTL_ROOT_COMMAND_SPEC } from '../cli/registry/root'
import type {
  AutocompleteClusterState,
  AutocompleteContext,
  CompletionResult
} from '../../terminal/autocomplete/types'

const KUBECTL_ACTIONS = KUBECTL_ROOT_COMMAND_SPEC.subcommands.map((command) => {
  return command.path[command.path.length - 1]
})
const PSEUDO_RESOURCE_SET = new Set<KubectlResource>(['all'])

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

const mapSuggestions = (items: string[], suffix: string): CompletionResult[] => {
  return items.map((item) => ({
    text: item,
    suffix
  }))
}

const getResourceTypeSuggestions = (
  currentToken: string,
  allowlist?: readonly KubectlResource[]
): CompletionResult[] => {
  const allowedKinds = allowlist
    ? [...allowlist]
    : (Object.keys(KUBECTL_RESOURCES) as KubectlResource[])
  const canonicalMatches = new Set<string>()
  for (const kind of allowedKinds) {
    const aliases = KUBECTL_RESOURCES[kind]
    const hasMatch = aliases.some((alias) => alias.startsWith(currentToken))
    if (hasMatch) {
      canonicalMatches.add(kind)
    }
  }
  return mapSuggestions(
    [...canonicalMatches].sort((left, right) => left.localeCompare(right)),
    ' '
  )
}

const getResourceTypesFromCompletion = (
  resourceTypesCompletion: KubectlCompletionResourceTypes | undefined
): readonly KubectlResource[] => {
  if (resourceTypesCompletion == null) {
    return []
  }

  if (resourceTypesCompletion.mode === 'none') {
    return []
  }
  if (resourceTypesCompletion.mode === 'allowlist') {
    return resourceTypesCompletion.resources.filter((kind) => {
      return Object.hasOwn(KUBECTL_RESOURCES, kind)
    }) as KubectlResource[]
  }
  if (resourceTypesCompletion.mode === 'all') {
    const includePseudoResources =
      resourceTypesCompletion.includePseudoResources === true
    return Object.keys(KUBECTL_RESOURCES).filter((kind) => {
      if (includePseudoResources) {
        return true
      }
      return !PSEUDO_RESOURCE_SET.has(kind as KubectlResource)
    }) as KubectlResource[]
  }
  return []
}

const isTypePosition = (
  tokens: string[],
  currentToken: string,
  consumedTokens: number
): boolean => {
  return (
    tokens.length === consumedTokens ||
    (tokens.length === consumedTokens + 1 &&
      currentToken !== '' &&
      tokens[tokens.length - 1] === currentToken)
  )
}

const resolveNamesSource = (
  command: KubectlCommandSpec
): KubectlCompletionResourceNames => {
  const completion = command.completion
  if (completion?.resourceNames != null) {
    return completion.resourceNames
  }
  return { mode: 'none' }
}

const getSubcommandSuggestions = (
  command: KubectlCommandSpec,
  currentToken: string
): CompletionResult[] => {
  const subcommands = command.subcommands
    .map((subcommand) => {
      return subcommand.path[subcommand.path.length - 1]
    })
    .filter((name) => name.startsWith(currentToken))
    .sort((left, right) => left.localeCompare(right))
  return mapSuggestions(subcommands, ' ')
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
      return mapSuggestions(
        filterMatches([...KUBECTL_ACTIONS], currentToken).sort((left, right) =>
          left.localeCompare(right)
        ),
        ' '
      )
    }

    const action = tokens[1]
    const resolved = resolveKubectlCommand(KUBECTL_ROOT_COMMAND_SPEC, tokens)
    if (resolved != null && resolved.command.subcommands.length > 0) {
      const isSubcommandPosition = isTypePosition(
        tokens,
        currentToken,
        resolved.consumedTokens
      )
      if (isSubcommandPosition) {
        return getSubcommandSuggestions(resolved.command, currentToken)
      }
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

    if (action === 'run') {
      return []
    }

    if (resolved == null) {
      return []
    }

    const command = resolved.command
    const resourceTypes = getResourceTypesFromCompletion(command.completion?.resourceTypes)
    const hasResourceTypeCompletion = resourceTypes.length > 0
    if (hasResourceTypeCompletion) {
      const shouldCompleteType = isTypePosition(
        tokens,
        currentToken,
        resolved.consumedTokens
      )
      if (shouldCompleteType) {
        return getResourceTypeSuggestions(currentToken, resourceTypes)
      }
    }

    const namesSource = resolveNamesSource(command)
    if (namesSource.mode === 'none') {
      return []
    }
    if (namesSource.mode === 'pods') {
      return getResourceNames('pods', currentToken, context)
    }
    if (namesSource.mode === 'nodes') {
      return getResourceNames('nodes', currentToken, context)
    }
    if (namesSource.mode !== 'fromResourceType') {
      return []
    }

    if (!hasResourceTypeCompletion || tokens.length <= resolved.consumedTokens) {
      return []
    }
    const resourceToken = tokens[resolved.consumedTokens]
    if (resourceToken == null) {
      return []
    }
    const resourceType = RESOURCE_ALIAS_MAP[resourceToken] || resourceToken

    return getResourceNames(resourceType, currentToken, context)
  }
}
