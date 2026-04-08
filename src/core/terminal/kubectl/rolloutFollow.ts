import type { ParsedCommand } from '../../kubectl/commands/types'

export const isRolloutStatusFollowEnabled = (
  parsedCommand: ParsedCommand
): boolean => {
  if (parsedCommand.action !== 'rollout') {
    return false
  }
  if (parsedCommand.rolloutSubcommand !== 'status') {
    return false
  }
  return parsedCommand.rolloutWatch !== false
}

export const isRolloutStatusSuccessOutput = (output: string): boolean => {
  return output.includes('successfully rolled out')
}

export type RolloutProgressSnapshot = {
  deploymentName: string
  current: number
  desired: number
  mode: 'available' | 'updated'
}

export const parseRolloutProgress = (
  output: string
): RolloutProgressSnapshot | undefined => {
  const availableMatch = output.match(
    /^Waiting for deployment "([^"]+)" rollout to finish: (\d+) of (\d+) updated replicas are available\.\.\.$/
  )
  if (availableMatch != null) {
    const current = Number.parseInt(availableMatch[2], 10)
    const desired = Number.parseInt(availableMatch[3], 10)
    if (!Number.isFinite(current) || !Number.isFinite(desired)) {
      return undefined
    }
    return {
      deploymentName: availableMatch[1],
      current,
      desired,
      mode: 'available'
    }
  }
  const updatedMatch = output.match(
    /^Waiting for deployment "([^"]+)" rollout to finish: (\d+) out of (\d+) new replicas have been updated\.\.\.$/
  )
  if (updatedMatch == null) {
    return undefined
  }
  const current = Number.parseInt(updatedMatch[2], 10)
  const desired = Number.parseInt(updatedMatch[3], 10)
  if (!Number.isFinite(current) || !Number.isFinite(desired)) {
    return undefined
  }
  return {
    deploymentName: updatedMatch[1],
    current,
    desired,
    mode: 'updated'
  }
}

export const buildRolloutProgressLine = (
  deploymentName: string,
  current: number,
  desired: number,
  mode: 'available' | 'updated'
): string => {
  if (mode === 'updated') {
    return `Waiting for deployment "${deploymentName}" rollout to finish: ${current} out of ${desired} new replicas have been updated...`
  }
  return `Waiting for deployment "${deploymentName}" rollout to finish: ${current} of ${desired} updated replicas are available...`
}

export const expandRolloutStatusOutput = (
  previousOutput: string,
  nextOutput: string
): string[] => {
  const previous = parseRolloutProgress(previousOutput)
  if (previous == null) {
    return [nextOutput]
  }

  const next = parseRolloutProgress(nextOutput)
  if (next != null) {
    if (
      next.deploymentName !== previous.deploymentName ||
      next.mode !== previous.mode ||
      next.desired !== previous.desired ||
      next.current <= previous.current + 1
    ) {
      return [nextOutput]
    }
    const expanded: string[] = []
    for (let value = previous.current + 1; value <= next.current; value++) {
      expanded.push(
        buildRolloutProgressLine(
          next.deploymentName,
          value,
          next.desired,
          next.mode
        )
      )
    }
    return expanded
  }

  if (!isRolloutStatusSuccessOutput(nextOutput)) {
    return [nextOutput]
  }
  if (previous.current >= previous.desired) {
    return [nextOutput]
  }
  const expanded: string[] = []
  for (let value = previous.current + 1; value < previous.desired; value++) {
    expanded.push(
      buildRolloutProgressLine(
        previous.deploymentName,
        value,
        previous.desired,
        previous.mode
      )
    )
  }
  expanded.push(nextOutput)
  return expanded
}
