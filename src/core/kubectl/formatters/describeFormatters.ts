// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL DESCRIBE FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════
// Pure functions for formatting detailed kubectl describe output.
// Reproduces real kubectl describe style with proper indentation and sections.

import type { ConfigMap } from '../../cluster/ressources/ConfigMap'
import type {
  ContainerStatus,
  EnvVar,
  Pod,
  Probe,
  Volume,
  VolumeMount
} from '../../cluster/ressources/Pod'
import type { Secret } from '../../cluster/ressources/Secret'
import { blank, indent, kv, section } from './describeHelpers'

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Format labels/annotations as comma-separated key=value pairs
 */
const formatLabels = (labels?: Record<string, string>): string => {
  if (!labels || Object.keys(labels).length === 0) {
    return '<none>'
  }
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
}

/**
 * Simulate pod IP address
 * In real K8s this would be assigned by CNI plugin
 */
const simulatePodIP = (podName: string): string => {
  // Simple hash to generate consistent IP for same pod name
  let hash = 0
  for (let i = 0; i < podName.length; i++) {
    hash = (hash << 5) - hash + podName.charCodeAt(i)
    hash = hash & hash
  }
  const lastOctet = Math.abs(hash % 250) + 2
  return `172.17.0.${lastOctet}`
}

/**
 * Format probe configuration
 */
const formatProbe = (probe: Probe): string[] => {
  const lines: string[] = []

  if (probe.type === 'httpGet') {
    lines.push(`    http-get ${probe.path} on port ${probe.port}`)
  }

  if (probe.type === 'exec') {
    lines.push(`    exec [${probe.command.join(' ')}]`)
  }

  if (probe.type === 'tcpSocket') {
    lines.push(`    tcp-socket :${probe.port}`)
  }

  if (probe.initialDelaySeconds !== undefined) {
    lines.push(`    delay=${probe.initialDelaySeconds}s`)
  }

  if (probe.periodSeconds !== undefined) {
    lines.push(`    period=${probe.periodSeconds}s`)
  }

  return lines
}

/**
 * Format environment variable (mask secrets)
 */
const formatEnvVar = (env: EnvVar): string => {
  if (env.source.type === 'value') {
    return `    ${env.name}:  ${env.source.value}`
  }

  if (env.source.type === 'configMapKeyRef') {
    return `    ${env.name}:  <set to the key '${env.source.key}' in config map '${env.source.name}'>`
  }

  if (env.source.type === 'secretKeyRef') {
    return `    ${env.name}:  <set to the key '${env.source.key}' of secret '${env.source.name}'>`
  }

  return `    ${env.name}:  <unknown>`
}

/**
 * Format volume mount
 */
const formatVolumeMount = (mount: VolumeMount): string => {
  const readOnlyStr = mount.readOnly ? ' (ro)' : ' (rw)'
  return `    ${mount.name} from ${mount.name} (${mount.mountPath})${readOnlyStr}`
}

/**
 * Format volume source
 */
const formatVolumeSource = (volume: Volume): string => {
  if (!volume.source) {
    return `    Type:       Unknown`
  }

  if (volume.source.type === 'emptyDir') {
    return `    Type:       EmptyDir (a temporary directory that shares a pod's lifetime)`
  }

  if (volume.source.type === 'configMap') {
    return `    Type:       ConfigMap (a volume populated by a ConfigMap)\n    Name:       ${volume.source.name}\n    Optional:   false`
  }

  if (volume.source.type === 'secret') {
    return `    Type:       Secret (a volume populated by a Secret)\n    SecretName: ${volume.source.secretName}\n    Optional:   false`
  }

  return `    Type:       Unknown`
}

/**
 * Format secret type for display
 */
const formatSecretType = (secretType: Secret['type']): string => {
  if (secretType.type === 'Opaque') {
    return 'Opaque'
  }

  if (secretType.type === 'kubernetes.io/service-account-token') {
    return 'kubernetes.io/service-account-token'
  }

  if (secretType.type === 'kubernetes.io/dockerconfigjson') {
    return 'kubernetes.io/dockerconfigjson'
  }

  return 'Unknown'
}

// ─── Container Formatter ─────────────────────────────────────────────────

/**
 * Format a single container (works for both init and regular containers)
 */
const formatContainer = (
  container: Pod['spec']['containers'][0],
  lines: string[],
  containerStatus?: ContainerStatus
): void => {
  // Container name
  lines.push(indent(`${container.name}:`, 1))

  // Container state (for init containers)
  if (containerStatus?.state) {
    lines.push(indent(kv('State', containerStatus.state), 2))
  }

  lines.push(indent(kv('Image', container.image), 2))

  // Command and args
  if (container.command && container.command.length > 0) {
    lines.push(indent('Command:', 2))
    container.command.forEach((cmd) => lines.push(indent(cmd, 3)))
  }

  if (container.args && container.args.length > 0) {
    lines.push(indent('Args:', 2))
    container.args.forEach((arg) => lines.push(indent(arg, 3)))
  }

  // Ports
  if (container.ports && container.ports.length > 0) {
    const portsStr = container.ports
      .map((p) => `${p.containerPort}/${p.protocol || 'TCP'}`)
      .join(', ')
    lines.push(indent(kv('Ports', portsStr), 2))
  }

  // Resources
  if (container.resources) {
    if (container.resources.requests) {
      const requests = container.resources.requests
      const requestParts: string[] = []
      if (requests.cpu) {
        requestParts.push(`cpu: ${requests.cpu}`)
      }
      if (requests.memory) {
        requestParts.push(`memory: ${requests.memory}`)
      }
      if (requestParts.length > 0) {
        lines.push(indent('Requests:', 2))
        requestParts.forEach((part) => lines.push(indent(part, 3)))
      }
    }
    if (container.resources.limits) {
      const limits = container.resources.limits
      const limitParts: string[] = []
      if (limits.cpu) {
        limitParts.push(`cpu: ${limits.cpu}`)
      }
      if (limits.memory) {
        limitParts.push(`memory: ${limits.memory}`)
      }
      if (limitParts.length > 0) {
        lines.push(indent('Limits:', 2))
        limitParts.forEach((part) => lines.push(indent(part, 3)))
      }
    }
  }

  // Probes
  if (container.livenessProbe) {
    lines.push(indent('Liveness:', 2))
    formatProbe(container.livenessProbe).forEach((line) =>
      lines.push(indent(line, 2))
    )
  }

  if (container.readinessProbe) {
    lines.push(indent('Readiness:', 2))
    formatProbe(container.readinessProbe).forEach((line) =>
      lines.push(indent(line, 2))
    )
  }

  if (container.startupProbe) {
    lines.push(indent('Startup:', 2))
    formatProbe(container.startupProbe).forEach((line) =>
      lines.push(indent(line, 2))
    )
  }

  // Environment variables
  if (container.env && container.env.length > 0) {
    lines.push(indent('Environment:', 2))
    container.env.forEach((envVar) => {
      lines.push(indent(formatEnvVar(envVar), 2))
    })
  }

  // Volume mounts
  if (container.volumeMounts && container.volumeMounts.length > 0) {
    lines.push(indent('Mounts:', 2))
    container.volumeMounts.forEach((mount) => {
      lines.push(indent(formatVolumeMount(mount), 2))
    })
  }
}

// ─── Main Formatters ─────────────────────────────────────────────────────

/**
 * Format detailed pod description
 */
export const describePod = (pod: Pod): string => {
  const lines: string[] = []

  // Basic metadata
  lines.push(`Name:         ${pod.metadata.name}`)
  lines.push(`Namespace:    ${pod.metadata.namespace}`)
  lines.push(`Labels:       ${formatLabels(pod.metadata.labels)}`)
  lines.push(`Annotations:  ${formatLabels(pod.metadata.annotations)}`)
  lines.push(`Status:       ${pod.status.phase}`)
  lines.push(`IP:           ${simulatePodIP(pod.metadata.name)}`)
  lines.push(blank())

  // Init Containers section (if any)
  if (pod.spec.initContainers && pod.spec.initContainers.length > 0) {
    const initContainerLines: string[] = []
    for (const initContainer of pod.spec.initContainers) {
      const status = pod.status.containerStatuses?.find(
        (cs) => cs.name === initContainer.name
      )
      formatContainer(initContainer, initContainerLines, status)
    }
    lines.push(...section('Init Containers', initContainerLines))
    lines.push(blank())
  }

  // Containers section
  const containerLines: string[] = []
  for (const container of pod.spec.containers) {
    const status = pod.status.containerStatuses?.find(
      (cs) => cs.name === container.name
    )
    formatContainer(container, containerLines, status)
  }
  lines.push(...section('Containers', containerLines))
  lines.push(blank())

  // Volumes section
  if (pod.spec.volumes && pod.spec.volumes.length > 0) {
    const volumeLines: string[] = []
    pod.spec.volumes.forEach((volume) => {
      volumeLines.push(`${volume.name}:`)
      volumeLines.push(formatVolumeSource(volume))
    })
    lines.push(...section('Volumes', volumeLines))
  } else {
    lines.push('Volumes:  <none>')
  }

  lines.push(blank())

  // Conditions and Events (placeholders)
  lines.push('Conditions:')
  lines.push('  Type              Status')
  lines.push('  Initialized       True')
  lines.push('  Ready             True')
  lines.push('  ContainersReady   True')
  lines.push('  PodScheduled      True')
  lines.push('')
  lines.push('Events:  <none>')

  return lines.join('\n')
}

/**
 * Format detailed ConfigMap description
 */
export const describeConfigMap = (configMap: ConfigMap): string => {
  const lines: string[] = []

  // Basic metadata
  lines.push(`Name:         ${configMap.metadata.name}`)
  lines.push(`Namespace:    ${configMap.metadata.namespace}`)
  lines.push(`Labels:       ${formatLabels(configMap.metadata.labels)}`)
  lines.push(`Annotations:  ${formatLabels(configMap.metadata.annotations)}`)
  lines.push(blank())

  // Data section
  const dataCount = configMap.data ? Object.keys(configMap.data).length : 0
  const binaryDataCount = configMap.binaryData
    ? Object.keys(configMap.binaryData).length
    : 0

  lines.push('Data')
  lines.push('====')

  if (configMap.data && dataCount > 0) {
    Object.entries(configMap.data).forEach(([key, value]) => {
      lines.push(`${key}:`)
      lines.push('----')
      lines.push(value)
      lines.push('')
    })
  }

  if (configMap.binaryData && binaryDataCount > 0) {
    lines.push('')
    lines.push('BinaryData')
    lines.push('====')
    Object.entries(configMap.binaryData).forEach(([key, value]) => {
      const byteCount = value.length
      lines.push(`${key}: ${byteCount} bytes`)
    })
  }

  if (dataCount === 0 && binaryDataCount === 0) {
    lines.push('<no data>')
  }

  lines.push('')
  lines.push('Events:  <none>')

  return lines.join('\n')
}

/**
 * Format detailed Secret description
 */
export const describeSecret = (secret: Secret): string => {
  const lines: string[] = []

  // Basic metadata
  lines.push(`Name:         ${secret.metadata.name}`)
  lines.push(`Namespace:    ${secret.metadata.namespace}`)
  lines.push(`Labels:       ${formatLabels(secret.metadata.labels)}`)
  lines.push(`Annotations:  ${formatLabels(secret.metadata.annotations)}`)
  lines.push(blank())

  // Type (special format: "Type:  value" with 2 spaces)
  lines.push(`Type:  ${formatSecretType(secret.type)}`)
  lines.push(blank())

  // Data section (masked)
  lines.push('Data')
  lines.push('====')

  const dataKeys = Object.keys(secret.data)
  if (dataKeys.length > 0) {
    dataKeys.forEach((key) => {
      const value = secret.data[key]
      const byteCount = value.length
      lines.push(`${key}:  ${byteCount} bytes`)
    })
  } else {
    lines.push('<no data>')
  }

  lines.push('')
  lines.push('Events:  <none>')

  return lines.join('\n')
}
