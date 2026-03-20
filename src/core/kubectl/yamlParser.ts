// ═══════════════════════════════════════════════════════════════════════════
// YAML PARSER & VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════
// Parse and validate YAML manifests for Kubernetes resources.
// Uses Zod schemas defined in resource models for validation.

import { parse } from 'yaml'
import type { ConfigMap } from '../cluster/ressources/ConfigMap'
import { parseConfigMapManifest } from '../cluster/ressources/ConfigMap'
import type { DaemonSet } from '../cluster/ressources/DaemonSet'
import { parseDaemonSetManifest } from '../cluster/ressources/DaemonSet'
import type { Deployment } from '../cluster/ressources/Deployment'
import { parseDeploymentManifest } from '../cluster/ressources/Deployment'
import type { Ingress } from '../cluster/ressources/Ingress'
import { parseIngressManifest } from '../cluster/ressources/Ingress'
import type { Lease } from '../cluster/ressources/Lease'
import { parseLeaseManifest } from '../cluster/ressources/Lease'
import type { Node } from '../cluster/ressources/Node'
import { parseNodeManifest } from '../cluster/ressources/Node'
import type { PersistentVolume } from '../cluster/ressources/PersistentVolume'
import { parsePersistentVolumeManifest } from '../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../cluster/ressources/PersistentVolumeClaim'
import { parsePersistentVolumeClaimManifest } from '../cluster/ressources/PersistentVolumeClaim'
import type { Pod } from '../cluster/ressources/Pod'
import { parsePodManifest } from '../cluster/ressources/Pod'
import type { ReplicaSet } from '../cluster/ressources/ReplicaSet'
import { parseReplicaSetManifest } from '../cluster/ressources/ReplicaSet'
import type { Secret } from '../cluster/ressources/Secret'
import { parseSecretManifest } from '../cluster/ressources/Secret'
import type { Service } from '../cluster/ressources/Service'
import { parseServiceManifest } from '../cluster/ressources/Service'
import type { StatefulSet } from '../cluster/ressources/StatefulSet'
import { parseStatefulSetManifest } from '../cluster/ressources/StatefulSet'
import type { ResourceKind } from '../cluster/ClusterState'
import type { Result } from '../shared/result'
import { error, success } from '../shared/result'
import {
  isSupportedResourceKind,
  SUPPORTED_RESOURCE_KINDS
} from './commands/resourceSchema'

// ─── Types ───────────────────────────────────────────────────────────────

type ParsedResource =
  | Pod
  | ConfigMap
  | Secret
  | Node
  | PersistentVolume
  | PersistentVolumeClaim
  | ReplicaSet
  | Deployment
  | DaemonSet
  | StatefulSet
  | Service
  | Ingress
  | Lease

type YamlSupportedKind = Exclude<ResourceKind, 'Namespace'>

const YAML_SUPPORTED_RESOURCE_KINDS = SUPPORTED_RESOURCE_KINDS.filter((kind) => {
  return kind !== 'Namespace'
}) as YamlSupportedKind[]

// ─── YAML Parsing ────────────────────────────────────────────────────────

/**
 * Parse YAML string with error handling
 */
const parseYaml = (yamlContent: string): Result<unknown> => {
  try {
    const parsed = parse(yamlContent)
    if (!parsed || typeof parsed !== 'object') {
      return error('YAML content is empty or invalid')
    }
    return success(parsed)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown YAML parse error'
    return error(`YAML parse error: ${message}`)
  }
}

/**
 * Check if kind is supported
 */
const isSupportedKind = (kind: string): kind is YamlSupportedKind => {
  if (!isSupportedResourceKind(kind)) {
    return false
  }
  return YAML_SUPPORTED_RESOURCE_KINDS.includes(kind as YamlSupportedKind)
}

/**
 * Manifest parser lookup table (object lookup pattern)
 */
const MANIFEST_PARSERS: Record<
  YamlSupportedKind,
  (obj: any) => Result<ParsedResource>
> = {
  Pod: parsePodManifest,
  ConfigMap: parseConfigMapManifest,
  Secret: parseSecretManifest,
  Node: parseNodeManifest,
  PersistentVolume: parsePersistentVolumeManifest,
  PersistentVolumeClaim: parsePersistentVolumeClaimManifest,
  ReplicaSet: parseReplicaSetManifest,
  Deployment: parseDeploymentManifest,
  DaemonSet: parseDaemonSetManifest,
  StatefulSet: parseStatefulSetManifest,
  Service: parseServiceManifest,
  Ingress: parseIngressManifest,
  Lease: parseLeaseManifest
}

/**
 * Route validation to resource-specific parser
 */
const validateResource = (obj: any): Result<ParsedResource> => {
  // Basic structure validation
  if (!obj.kind || typeof obj.kind !== 'string') {
    return error('Missing or invalid kind')
  }

  if (!isSupportedKind(obj.kind)) {
    const supportedKinds = YAML_SUPPORTED_RESOURCE_KINDS.join(', ')
    return error(
      `Unsupported resource kind: ${obj.kind} (supported: ${supportedKinds})`
    )
  }

  const parser = MANIFEST_PARSERS[obj.kind as YamlSupportedKind]
  return parser(obj)
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Parse and validate YAML manifest
 *
 * @param yamlContent - YAML string to parse
 * @returns Result with validated resource or error message
 */
export const parseKubernetesYaml = (
  yamlContent: string
): Result<ParsedResource> => {
  const parseResult = parseYaml(yamlContent)
  if (!parseResult.ok) {
    return parseResult
  }

  return validateResource(parseResult.value)
}
