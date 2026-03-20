import { isPodTerminating, type Pod } from '../../../../../cluster/ressources/Pod'

const buildPodVirtualIP = (hashSource: string): string => {
  let hash = 0
  for (let index = 0; index < hashSource.length; index++) {
    hash = (hash << 5) - hash + hashSource.charCodeAt(index)
    hash = hash & hash
  }
  const thirdOctet = (Math.abs(hash) % 240) + 10
  const fourthOctet = (Math.abs(hash >> 4) % 240) + 10
  return `10.244.${thirdOctet}.${fourthOctet}`
}

export const getPodReady = (pod: Pod): string => {
  const statuses = pod.status.containerStatuses ?? []
  const regular = pod.spec.containers.length
  if (regular === 0) {
    return '0/0'
  }
  const ready = statuses.filter((containerStatus) => containerStatus.ready).length
  return `${ready}/${regular}`
}

const getPodRestarts = (pod: Pod): number => {
  const statuses = pod.status.containerStatuses ?? []
  return statuses.reduce((sum, containerStatus) => {
    return sum + (containerStatus.restartCount ?? 0)
  }, 0)
}

const formatRestartAge = (timestamp: string): string => {
  const nowMs = Date.now()
  const eventMs = new Date(timestamp).getTime()
  const diffMs = Math.max(0, nowMs - eventMs)
  const diffSecs = Math.max(0, Math.round(diffMs / 1000))
  if (diffSecs < 60) {
    return `${diffSecs}s`
  }
  const minutes = Math.floor(diffSecs / 60)
  const seconds = diffSecs % 60
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m${seconds}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d${remainingHours}h` : `${days}d`
}

const getPodLastRestartAt = (pod: Pod): string | undefined => {
  const statuses = pod.status.containerStatuses ?? []
  let latestMs = -1
  let latestTimestamp: string | undefined = undefined
  for (const status of statuses) {
    if ((status.restartCount ?? 0) <= 0 || status.lastRestartAt == null) {
      continue
    }
    const currentMs = new Date(status.lastRestartAt).getTime()
    if (Number.isNaN(currentMs)) {
      continue
    }
    if (currentMs > latestMs) {
      latestMs = currentMs
      latestTimestamp = status.lastRestartAt
    }
  }
  return latestTimestamp
}

export const getPodRestartsDisplay = (pod: Pod): string => {
  const totalRestarts = getPodRestarts(pod)
  if (totalRestarts <= 0) {
    return '0'
  }
  const lastRestartAt = getPodLastRestartAt(pod)
  if (lastRestartAt == null) {
    return String(totalRestarts)
  }
  return `${totalRestarts} (${formatRestartAge(lastRestartAt)} ago)`
}

export const getPodDisplayStatus = (pod: Pod): string => {
  if (isPodTerminating(pod)) {
    return 'Terminating'
  }
  const statuses = pod.status.containerStatuses ?? []
  const waitingStatus = statuses.find((status) => {
    return (
      status.stateDetails?.state === 'Waiting' &&
      status.stateDetails.reason != null
    )
  })
  if (waitingStatus?.stateDetails?.reason != null) {
    return waitingStatus.stateDetails.reason
  }
  const terminatedStatus = statuses.find((status) => {
    return (
      status.stateDetails?.state === 'Terminated' &&
      status.stateDetails.reason != null
    )
  })
  if (terminatedStatus?.stateDetails?.reason != null) {
    return terminatedStatus.stateDetails.reason
  }
  if (pod.status.phase === 'Running') {
    return 'Running'
  }
  return pod.status.phase
}

export const getPodIP = (pod: Pod): string => {
  if (pod.status.podIP != null && pod.status.podIP.length > 0) {
    return pod.status.podIP
  }
  const statuses = pod.status.containerStatuses ?? []
  if (statuses.length === 0) {
    return '<none>'
  }
  return buildPodVirtualIP(`${pod.metadata.namespace}/${pod.metadata.name}`)
}

export const getUniquePodIPMap = (pods: Pod[]): Map<string, string> => {
  const ipMap = new Map<string, string>()
  const usedIPs = new Set<string>()
  for (const pod of pods) {
    const key = `${pod.metadata.namespace}/${pod.metadata.name}`
    if (pod.status.podIP != null && pod.status.podIP.length > 0) {
      ipMap.set(key, pod.status.podIP)
      usedIPs.add(pod.status.podIP)
      continue
    }
    const statuses = pod.status.containerStatuses ?? []
    if (statuses.length === 0) {
      ipMap.set(key, '<none>')
      continue
    }
    const seed = buildPodVirtualIP(key)
    const octets = seed.split('.')
    let thirdOctet = Number(octets[2])
    let fourthOctet = Number(octets[3])
    let candidate = seed
    let attempt = 0
    while (usedIPs.has(candidate)) {
      attempt = attempt + 1
      thirdOctet = ((thirdOctet + attempt) % 240) + 10
      fourthOctet = ((fourthOctet + attempt * 7) % 240) + 10
      candidate = `10.244.${thirdOctet}.${fourthOctet}`
    }
    usedIPs.add(candidate)
    ipMap.set(key, candidate)
  }
  return ipMap
}

export const getPodNodeName = (pod: Pod): string => {
  if (typeof pod.spec.nodeName === 'string' && pod.spec.nodeName.length > 0) {
    return pod.spec.nodeName
  }
  return '<none>'
}

export const formatLabelsForDisplay = (
  labels?: Record<string, string>
): string => {
  if (labels == null) {
    return '<none>'
  }
  const entries = Object.entries(labels)
  if (entries.length === 0) {
    return '<none>'
  }
  return entries
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
}
