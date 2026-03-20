import type { ExecutionResult } from '../../../../../shared/result'
import { error } from '../../../../../shared/result'
import type { ParsedCommand } from '../../../types'
import type { PodDeleteOptions } from './types'

export const formatDeletedMessage = (
  kindRef: string,
  name: string,
  namespace: string,
  namespaced: boolean
): string => {
  if (!namespaced) {
    return `${kindRef} "${name}" deleted`
  }
  return `${kindRef} "${name}" deleted from ${namespace} namespace`
}

export const formatNotFoundMessage = (
  kindRefPlural: string,
  name: string
): ExecutionResult => {
  return error(
    `Error from server (NotFound): ${kindRefPlural} "${name}" not found`
  )
}

export const getPodDeleteOptions = (
  parsed: ParsedCommand
): PodDeleteOptions => {
  const options: PodDeleteOptions = {}
  if (parsed.deleteGracePeriodSeconds != null) {
    options.gracePeriodSeconds = parsed.deleteGracePeriodSeconds
  }
  if (parsed.deleteForce === true) {
    options.force = true
  }
  return options
}
