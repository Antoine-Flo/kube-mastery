export const extractWatchLines = (
  output: string,
  stripTableHeader: boolean
): string[] => {
  const lines = output.split('\n').filter((line) => line.length > 0)
  if (!stripTableHeader) {
    return lines
  }
  if (lines.length <= 1) {
    return lines
  }
  const firstLine = lines[0].trim()
  if (!/^NAME(\s+|$)/.test(firstLine)) {
    return lines
  }
  return lines.slice(1)
}

export const buildWatchDeltaOutput = (
  previousOutput: string,
  nextOutput: string,
  stripTableHeader: boolean
): string => {
  if (nextOutput.length === 0) {
    return ''
  }
  if (previousOutput.length === 0) {
    const initialLines = extractWatchLines(nextOutput, stripTableHeader)
    return initialLines.join('\n')
  }

  const previousLines = extractWatchLines(previousOutput, stripTableHeader)
  const nextLines = extractWatchLines(nextOutput, stripTableHeader)
  if (nextLines.length === 0) {
    return ''
  }

  if (!stripTableHeader) {
    const previousRows = new Set(previousLines)
    const changedRows = nextLines.filter((row) => !previousRows.has(row))
    if (changedRows.length === 0) {
      return ''
    }
    return changedRows.join('\n')
  }

  const previousRows = new Set(previousLines)
  const changedRows = nextLines.filter((row) => !previousRows.has(row))
  if (changedRows.length === 0) {
    return ''
  }
  return changedRows.join('\n')
}
