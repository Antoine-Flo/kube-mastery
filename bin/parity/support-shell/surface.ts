export type ParityLane = 'kubectl-runtime' | 'support-shell'

export const detectParityLane = (command: string): ParityLane => {
  if (command.trim().startsWith('kubectl ')) {
    return 'kubectl-runtime'
  }
  return 'support-shell'
}

export const isExcludedFromStrictParity = (lane: ParityLane): boolean => {
  return lane === 'support-shell'
}

export const buildParityNote = (
  lane: ParityLane,
  matched: boolean,
  sameExitCode: boolean,
  sameStdout: boolean,
  sameStderr: boolean
): string => {
  if (lane === 'support-shell') {
    return `excluded(support-shell,exit:${sameExitCode ? 'ok' : 'ko'},stdout:${sameStdout ? 'ok' : 'ko'},stderr:${sameStderr ? 'ok' : 'ko'})`
  }
  if (matched) {
    return 'match'
  }
  return `diff(exit:${sameExitCode ? 'ok' : 'ko'},stdout:${sameStdout ? 'ok' : 'ko'},stderr:${sameStderr ? 'ok' : 'ko'})`
}
