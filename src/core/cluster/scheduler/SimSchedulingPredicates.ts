import type { Node, NodeTaint } from '../ressources/Node'
import { getNodeStatus } from '../ressources/Node'
import type {
  Pod,
  PodNodeSelectorRequirement,
  PodNodeSelectorTerm,
  PodToleration
} from '../ressources/Pod'

const doesTolerationMatchTaint = (
  toleration: PodToleration,
  taint: NodeTaint
): boolean => {
  if (toleration.effect && toleration.effect !== taint.effect) {
    return false
  }
  if (toleration.operator === 'Exists') {
    if (toleration.key == null) {
      return true
    }
    return toleration.key === taint.key
  }
  const keyMatches = toleration.key === taint.key
  const valueMatches = toleration.value === taint.value
  return keyMatches && valueMatches
}

const toleratesTaint = (pod: Pod, taint: NodeTaint): boolean => {
  if (taint.effect !== 'NoSchedule' && taint.effect !== 'NoExecute') {
    return true
  }
  const tolerations = pod.spec.tolerations ?? []
  return tolerations.some((toleration) => {
    return doesTolerationMatchTaint(toleration, taint)
  })
}

const matchesNodeSelector = (pod: Pod, node: Node): boolean => {
  const selector = pod.spec.nodeSelector
  if (selector == null) {
    return true
  }
  const labels = node.metadata.labels ?? {}
  for (const [key, value] of Object.entries(selector)) {
    if (labels[key] !== value) {
      return false
    }
  }
  return true
}

const matchesRequirement = (
  labels: Record<string, string>,
  requirement: PodNodeSelectorRequirement
): boolean => {
  const actualValue = labels[requirement.key]
  const values = requirement.values ?? []
  if (requirement.operator === 'In') {
    if (actualValue == null) {
      return false
    }
    return values.includes(actualValue)
  }
  if (requirement.operator === 'NotIn') {
    if (actualValue == null) {
      return true
    }
    return !values.includes(actualValue)
  }
  if (requirement.operator === 'Exists') {
    return actualValue != null
  }
  if (requirement.operator === 'DoesNotExist') {
    return actualValue == null
  }
  return false
}

const matchesNodeSelectorTerm = (
  labels: Record<string, string>,
  term: PodNodeSelectorTerm
): boolean => {
  const expressions = term.matchExpressions ?? []
  if (expressions.length === 0) {
    return false
  }
  return expressions.every((requirement) => {
    return matchesRequirement(labels, requirement)
  })
}

const matchesRequiredNodeAffinity = (pod: Pod, node: Node): boolean => {
  const required =
    pod.spec.affinity?.nodeAffinity
      ?.requiredDuringSchedulingIgnoredDuringExecution
  if (required == null) {
    return true
  }
  const labels = node.metadata.labels ?? {}
  return required.nodeSelectorTerms.some((term) => {
    return matchesNodeSelectorTerm(labels, term)
  })
}

export const isNodeBaseSchedulable = (node: Node): boolean => {
  if (getNodeStatus(node) !== 'Ready') {
    return false
  }
  if (node.spec.unschedulable) {
    return false
  }
  return true
}

export const isNodeEligibleForPod = (pod: Pod, node: Node): boolean => {
  if (!isNodeBaseSchedulable(node)) {
    return false
  }
  if (!matchesNodeSelector(pod, node)) {
    return false
  }
  if (!matchesRequiredNodeAffinity(pod, node)) {
    return false
  }
  const taints = node.spec.taints ?? []
  for (const taint of taints) {
    if (!toleratesTaint(pod, taint)) {
      return false
    }
  }
  return true
}
