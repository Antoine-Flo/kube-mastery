import type { PodLifecycleDescribeEvent } from '../../../api/PodLifecycleEventStore'
import type {
  ContainerRuntimeStateDetails,
  Pod,
} from '../../../cluster/ressources/Pod'
import { blank, section } from '../../formatters/describeHelpers'
import { tabbedStringSync } from '../../printers/describeTabWriter'
import {
  POD_DESCRIBE_METADATA_COLUMN_WIDTH,
  appendContainerStateBlock,
  buildKubeApiAccessVolumeName,
  formatContainer,
  formatDescribeDate,
  formatEnvVar,
  formatLabels,
  formatMapMultiLine,
  formatPodConditionLines,
  formatPodEvents,
  formatPodTolerations,
  formatProbeInline,
  formatStoredPodEvents,
  formatVolumeSource,
  formatStaticControlPlaneHeader,
  getDescribePodStatus,
  getPodControlledBy,
  resolveContainerLastStateDetails,
  resolveContainerStateDetails,
  sanitizeDescribeAnnotations,
  simulatePodIP,
} from '../internal/helpers'

export const describePod = (
  pod: Pod,
  podLifecycleEvents?: readonly PodLifecycleDescribeEvent[]
): string => {
  const lines: string[] = []
  const podIP = pod.status.podIP ?? simulatePodIP(pod.metadata.name)
  const nodeName = pod.spec.nodeName ?? '<none>'
  const nodeIP = simulatePodIP(nodeName)
  const header = formatStaticControlPlaneHeader(pod)
  const isStaticControlPlanePod = header.priorityClassName != null
  const hasNodeAssignment =
    pod.spec.nodeName != null && pod.spec.nodeName.length > 0
  const kubeApiAccessVolumeName = buildKubeApiAccessVolumeName(pod)

  // Basic metadata (tab-separated pairs, refs/k8s/kubectl/pkg/describe/describe.go describePod)
  lines.push(`Name:\t${pod.metadata.name}`)
  lines.push(`Namespace:\t${pod.metadata.namespace}`)
  lines.push(`Priority:\t${header.priority}`)
  if (header.priorityClassName != null) {
    lines.push(`Priority Class Name:\t${header.priorityClassName}`)
  }
  if (header.priorityClassName == null) {
    lines.push('Service Account:\tdefault')
  }
  lines.push(`Node:\t${nodeName}/${nodeIP}`)
  lines.push(
    `Start Time:\t${formatDescribeDate(pod.metadata.creationTimestamp)}`
  )
  lines.push(
    ...formatMapMultiLine(
      'Labels',
      pod.metadata.labels,
      'equals',
      POD_DESCRIBE_METADATA_COLUMN_WIDTH
    )
  )
  lines.push(
    ...formatMapMultiLine(
      'Annotations',
      sanitizeDescribeAnnotations(pod.metadata.annotations),
      'colon',
      POD_DESCRIBE_METADATA_COLUMN_WIDTH
    )
  )
  lines.push(`Status:\t${getDescribePodStatus(pod)}`)
  if (header.seccompProfile != null) {
    lines.push(`SeccompProfile:\t${header.seccompProfile}`)
  }
  lines.push(`IP:\t${podIP}`)
  lines.push('IPs:')
  lines.push(`  IP:\t${podIP}`)
  const controlledBy = getPodControlledBy(pod, header.controlledBy)
  if (controlledBy != null) {
    lines.push(`Controlled By:\t${controlledBy}`)
  }

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
  lines.push('Containers:')
  for (const container of pod.spec.containers) {
    const status = pod.status.containerStatuses?.find(
      (cs) => cs.name === container.name
    )
    lines.push(`  ${container.name}:`)
    lines.push(`    Container ID:  ${status?.containerID ?? '<none>'}`)
    lines.push(`    Image:         ${container.image}`)
    // Image ID: full path with digest (e.g. docker.io/library/busybox@sha256:...), like kind/kubectl
    const imageId = status?.imageID ?? '<none>'
    lines.push(`    Image ID:      ${imageId}`)
    if (container.ports != null && container.ports.length > 0) {
      const firstPort = container.ports[0]
      if (isStaticControlPlanePod) {
        lines.push(
          `    Port:          ${firstPort.containerPort}/${firstPort.protocol ?? 'TCP'} (probe-port)`
        )
        lines.push(
          `    Host Port:     ${firstPort.containerPort}/${firstPort.protocol ?? 'TCP'} (probe-port)`
        )
      } else {
        lines.push(
          `    Port:          ${firstPort.containerPort}/${firstPort.protocol ?? 'TCP'}`
        )
        lines.push(`    Host Port:     0/${firstPort.protocol ?? 'TCP'}`)
      }
    }
    if (container.command && container.command.length > 0) {
      lines.push('    Command:')
      container.command.forEach((commandPart) => {
        lines.push(`      ${commandPart}`)
      })
    }
    if (container.args && container.args.length > 0) {
      container.args.forEach((arg) => {
        lines.push(`      ${arg}`)
      })
    }
    const currentStateDetails =
      resolveContainerStateDetails(status) ??
      ({
        state: pod.status.phase === 'Running' ? 'Running' : 'Waiting'
      } as ContainerRuntimeStateDetails)
    appendContainerStateBlock(lines, 'State', currentStateDetails)
    const lastStateDetails = resolveContainerLastStateDetails(status)
    if (lastStateDetails != null) {
      appendContainerStateBlock(lines, 'Last State', lastStateDetails)
    }
    lines.push(
      `    Ready:          ${status?.ready === true ? 'True' : 'False'}`
    )
    lines.push(`    Restart Count:  ${status?.restartCount ?? 0}`)
    if (container.resources?.limits != null) {
      const entries = Object.entries(container.resources.limits)
      if (entries.length > 0) {
        lines.push('    Limits:')
        entries.forEach(([key, value]) => {
          lines.push(`      ${key}:        ${value}`)
        })
      }
    }
    if (container.resources?.requests != null) {
      const entries = Object.entries(container.resources.requests)
      if (entries.length > 0) {
        lines.push('    Requests:')
        entries.forEach(([key, value]) => {
          lines.push(`      ${key}:        ${value}`)
        })
      }
    }
    if (container.livenessProbe != null) {
      lines.push(formatProbeInline('Liveness', container.livenessProbe))
    }
    if (container.readinessProbe != null) {
      lines.push(formatProbeInline('Readiness', container.readinessProbe))
    }
    if (container.startupProbe != null) {
      lines.push(formatProbeInline('Startup', container.startupProbe))
    }
    if (container.env != null && container.env.length > 0) {
      lines.push('    Environment:  ')
      container.env.forEach((envVar) => {
        lines.push(`      ${formatEnvVar(envVar).trim()}`)
      })
    } else {
      lines.push('    Environment:  <none>')
    }
    if (container.volumeMounts != null && container.volumeMounts.length > 0) {
      lines.push('    Mounts:')
      container.volumeMounts.forEach((mount) => {
        lines.push(
          `      ${mount.mountPath} from ${mount.name} (${mount.readOnly === true ? 'ro' : 'rw'})`
        )
      })
    } else if (isStaticControlPlanePod === false && hasNodeAssignment) {
      lines.push('    Mounts:')
      lines.push(
        `      /var/run/secrets/kubernetes.io/serviceaccount from ${kubeApiAccessVolumeName} (ro)`
      )
    }
  }

  lines.push(...formatPodConditionLines(pod))
  // Volumes section
  if (pod.spec.volumes && pod.spec.volumes.length > 0) {
    lines.push('Volumes:')
    pod.spec.volumes.forEach((volume) => {
      lines.push(`  ${volume.name}:`)
      lines.push(formatVolumeSource(volume))
    })
  } else if (isStaticControlPlanePod === false && hasNodeAssignment) {
    lines.push('Volumes:')
    lines.push(`  ${kubeApiAccessVolumeName}:`)
    lines.push(
      '    Type:                    Projected (a volume that contains injected data from multiple sources)'
    )
    lines.push('    TokenExpirationSeconds:  3607')
    lines.push('    ConfigMapName:           kube-root-ca.crt')
    lines.push('    Optional:                false')
    lines.push('    DownwardAPI:             true')
  } else {
    lines.push('Volumes:  <none>')
  }
  lines.push(`QoS Class:\t${pod.status.qosClass ?? 'BestEffort'}`)
  lines.push(`Node-Selectors:\t${formatLabels(pod.spec.nodeSelector)}`)
  const effectiveTolerations =
    pod.spec.tolerations ??
    (isStaticControlPlanePod
      ? undefined
      : hasNodeAssignment
        ? [
            {
              key: 'node.kubernetes.io/not-ready',
              operator: 'Exists',
              effect: 'NoExecute',
              tolerationSeconds: 300
            },
            {
              key: 'node.kubernetes.io/unreachable',
              operator: 'Exists',
              effect: 'NoExecute',
              tolerationSeconds: 300
            }
          ]
        : undefined)
  lines.push(...formatPodTolerations(effectiveTolerations))
  if (isStaticControlPlanePod === false && hasNodeAssignment) {
    if (podLifecycleEvents != null && podLifecycleEvents.length > 0) {
      lines.push(...formatStoredPodEvents(podLifecycleEvents))
    } else {
      lines.push(...formatPodEvents(pod, nodeName))
    }
  } else {
    lines.push('Events:            <none>')
  }

  return tabbedStringSync((sink) => {
    for (const line of lines) {
      sink.write(`${line}\n`)
    }
  })
}
