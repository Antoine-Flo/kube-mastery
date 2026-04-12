export const KUBECTL_STDERR_PREFIX = 'KUBECTL_STDERR:'

export type KubectlOutputEnvelope = {
  stderrNotice?: string
  payload: string
}

export const parseKubectlOutputEnvelope = (
  output: string
): KubectlOutputEnvelope => {
  if (!output.startsWith(KUBECTL_STDERR_PREFIX)) {
    return { payload: output }
  }

  const firstLineBreakIndex = output.indexOf('\n')
  if (firstLineBreakIndex === -1) {
    return { payload: output }
  }

  const encodedNotice = output.slice(
    KUBECTL_STDERR_PREFIX.length,
    firstLineBreakIndex
  )

  if (encodedNotice.length === 0) {
    return { payload: output }
  }

  let stderrNotice = ''

  try {
    stderrNotice = decodeURIComponent(encodedNotice)
  } catch {
    return { payload: output }
  }

  return {
    stderrNotice,
    payload: output.slice(firstLineBreakIndex + 1)
  }
}
