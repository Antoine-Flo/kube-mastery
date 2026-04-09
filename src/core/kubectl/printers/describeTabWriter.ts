/**
 * TODO: Extend tab-separated metadata to remaining describers (service, endpoints,
 * deployment, PV/PVC, ingress, node header, lease standalone, etc.) and container
 * sub-blocks where upstream uses tabs (refs/k8s/kubectl/pkg/describe/describe.go).
 * Pod/ConfigMap/Secret and node Lease subsection already emit \\t key/value rows.
 *
 * Subset of Go text/tabwriter behavior used by kubectl describe tabbedString
 * (refs/k8s/kubectl/pkg/describe/describe.go tabbedString: Init(buf, 0, 8, 2, ' ', 0)).
 * Aligns rows that contain tab characters into fixed-width columns with padding.
 */

const COLUMN_PADDING = 2

const formatTabBlock = (rows: string[]): string[] => {
  if (rows.length === 0) {
    return []
  }
  const cellRows = rows.map((row) => {
    return row.split('\t')
  })
  const columnCount = Math.max(...cellRows.map((cells) => cells.length))
  const widths: number[] = new Array(columnCount).fill(0)
  for (const cells of cellRows) {
    for (let index = 0; index < cells.length; index++) {
      widths[index] = Math.max(widths[index], cells[index].length)
    }
  }
  return cellRows.map((cells) => {
    const parts: string[] = []
    for (let index = 0; index < columnCount; index++) {
      const cell = cells[index] ?? ''
      const width = widths[index]
      if (index === columnCount - 1) {
        parts.push(cell)
        continue
      }
      const padded = cell.padEnd(width)
      parts.push(padded)
      if (index < columnCount - 1) {
        parts.push(' '.repeat(COLUMN_PADDING))
      }
    }
    return parts.join('')
  })
}

export const applyDescribeTabWriter = (input: string): string => {
  const lines = input.split('\n')
  const result: string[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.includes('\t') === false) {
      result.push(line)
      index += 1
      continue
    }
    const block: string[] = []
    while (index < lines.length && lines[index].includes('\t')) {
      block.push(lines[index])
      index += 1
    }
    result.push(...formatTabBlock(block))
  }
  return result.join('\n')
}

export type TabWriterSink = {
  write: (chunk: string) => void
}

/**
 * Mirrors kubectl describe.tabbedString: collect writes, then run through tab writer.
 */
export const tabbedStringSync = (
  writeFn: (out: TabWriterSink) => void
): string => {
  const chunks: string[] = []
  writeFn({
    write: (chunk: string) => {
      chunks.push(chunk)
    }
  })
  return applyDescribeTabWriter(chunks.join(''))
}
