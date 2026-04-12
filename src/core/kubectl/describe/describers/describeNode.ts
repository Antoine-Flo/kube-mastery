import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { Node } from '../../../cluster/ressources/Node'
import { getNodeRoles } from '../../../cluster/ressources/Node'
import { tabbedStringSync } from '../../printers/describeTabWriter'
import {
  formatDescribeDate,
  formatMapMultiLine,
  formatNodeAddresses,
  formatNodeConditions,
  formatNodePodResources,
  formatNodeResourceList,
  formatNodeSystemInfo,
  formatNodeTaints,
  getNonTerminatedPodsOnNode
} from '../internal/helpers'

const KUBE_NODE_LEASE_NAMESPACE = 'kube-node-lease'

const formatNodeLeaseSection = (
  nodeName: string,
  state?: ClusterStateData
): string => {
  const lease = state?.leases?.items.find((item) => {
    return (
      item.metadata.namespace === KUBE_NODE_LEASE_NAMESPACE &&
      item.metadata.name === nodeName
    )
  })
  const holderIdentity =
    lease?.spec.holderIdentity != null && lease.spec.holderIdentity.length > 0
      ? lease.spec.holderIdentity
      : '<unset>'
  const acquireTime =
    lease?.spec.acquireTime != null && lease.spec.acquireTime.length > 0
      ? formatDescribeDate(lease.spec.acquireTime)
      : '<unset>'
  const renewTime =
    lease?.spec.renewTime != null && lease.spec.renewTime.length > 0
      ? formatDescribeDate(lease.spec.renewTime)
      : '<unset>'
  return tabbedStringSync((sink) => {
    sink.write('Lease:\n')
    sink.write(`  HolderIdentity:\t${holderIdentity}\n`)
    sink.write(`  AcquireTime:\t${acquireTime}\n`)
    sink.write(`  RenewTime:\t${renewTime}\n`)
  })
}

export const describeNode = (node: Node, state?: ClusterStateData): string => {
  const lines: string[] = []
  lines.push(`Name:               ${node.metadata.name}`)
  lines.push(`Roles:              ${getNodeRoles(node)}`)
  lines.push(...formatMapMultiLine('Labels', node.metadata.labels))
  lines.push(
    ...formatMapMultiLine('Annotations', node.metadata.annotations, 'colon')
  )
  lines.push(
    `CreationTimestamp:  ${formatDescribeDate(node.metadata.creationTimestamp)}`
  )
  lines.push(`Taints:             ${formatNodeTaints(node.spec.taints)}`)
  lines.push(
    `Unschedulable:      ${node.spec.unschedulable === true ? 'true' : 'false'}`
  )
  const leaseSection = formatNodeLeaseSection(
    node.metadata.name,
    state
  ).trimEnd()
  for (const line of leaseSection.split('\n')) {
    lines.push(line)
  }
  lines.push(...formatNodeConditions(node.status.conditions))
  lines.push(...formatNodeAddresses(node.status.addresses))
  lines.push(...formatNodeResourceList('Capacity', node.status.capacity))
  lines.push(...formatNodeResourceList('Allocatable', node.status.allocatable))
  lines.push(...formatNodeSystemInfo(node))
  if (node.spec.podCIDR && node.spec.podCIDR.length > 0) {
    lines.push(`PodCIDR:                      ${node.spec.podCIDR}`)
  }
  if (node.spec.podCIDRs && node.spec.podCIDRs.length > 0) {
    lines.push(`PodCIDRs:                     ${node.spec.podCIDRs.join(',')}`)
  }
  if (node.spec.providerID && node.spec.providerID.length > 0) {
    lines.push(`ProviderID:                   ${node.spec.providerID}`)
  }
  const pods = getNonTerminatedPodsOnNode(node.metadata.name, state)
  lines.push(...formatNodePodResources(node, pods))
  lines.push('Events:              <none>')
  return lines.join('\n')
}
