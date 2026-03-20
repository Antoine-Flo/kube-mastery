export type TabColumnAlign = 'left' | 'right'

export interface StatefulTabWriterOptions {
  spacing?: number
  align?: TabColumnAlign[]
  minColumnWidthsByHeader?: Record<string, number>
}

export interface ParsedTableOutput {
  header: string[]
  rows: string[][]
}

export interface StatefulTabWriter {
  ingestHeaderAndRows: (header: string[], rows: string[][]) => string[]
  formatDelta: (rows: string[][]) => string[]
  formatRows: (rows: string[][]) => string[]
  reset: () => void
}

const DEFAULT_SPACING = 3
const ROW_KEY_SEPARATOR = '\u0001'

const splitTableRowCells = (line: string): string[] => {
  return line.trim().split(/\s{2,}/)
}

const normalizeRow = (cells: string[]): string[] => {
  return cells.map((cell) => cell ?? '')
}

const buildRowKey = (cells: string[]): string => {
  return normalizeRow(cells).join(ROW_KEY_SEPARATOR)
}

const getColumnAlign = (
  align: TabColumnAlign[] | undefined,
  columnIndex: number
): TabColumnAlign => {
  return align?.[columnIndex] ?? 'left'
}

const padCell = (
  text: string,
  width: number,
  align: TabColumnAlign,
  isLastColumn: boolean
): string => {
  if (align === 'left' && isLastColumn) {
    return text
  }
  if (text.length >= width) {
    return text
  }
  const padding = ' '.repeat(width - text.length)
  if (align === 'right') {
    return `${padding}${text}`
  }
  return `${text}${padding}`
}

const formatCells = (
  cells: string[],
  widths: number[],
  spacing: number,
  align?: TabColumnAlign[]
): string => {
  const normalizedCells = normalizeRow(cells)
  const formattedCells = normalizedCells.map((cell, index) => {
    const width = widths[index] ?? cell.length
    const columnAlign = getColumnAlign(align, index)
    const isLastColumn = index === normalizedCells.length - 1
    return padCell(cell, width, columnAlign, isLastColumn)
  })
  return formattedCells.join(' '.repeat(spacing))
}

const growWidths = (
  currentWidths: number[],
  header: string[],
  rows: string[][],
  minColumnWidthsByHeader: Record<string, number>
): number[] => {
  const maxColumnCount = Math.max(
    currentWidths.length,
    header.length,
    ...rows.map((row) => row.length)
  )

  const nextWidths = Array.from(
    { length: maxColumnCount },
    (_, columnIndex) => {
      let maxWidth = currentWidths[columnIndex] ?? 0
      const headerCell = header[columnIndex] ?? ''
      if (headerCell.length > maxWidth) {
        maxWidth = headerCell.length
      }
      for (const row of rows) {
        const cell = row[columnIndex] ?? ''
        if (cell.length > maxWidth) {
          maxWidth = cell.length
        }
      }
      const minWidth = minColumnWidthsByHeader[headerCell] ?? 0
      if (minWidth > maxWidth) {
        maxWidth = minWidth
      }
      return maxWidth
    }
  )

  return nextWidths
}

export const tryParseTableOutput = (
  output: string
): ParsedTableOutput | null => {
  const lines = output.split('\n').filter((line) => line.length > 0)
  if (lines.length === 0) {
    return null
  }

  const header = splitTableRowCells(lines[0])
  if (header.length <= 1) {
    return null
  }

  const rows = lines.slice(1).map((line) => splitTableRowCells(line))
  return {
    header,
    rows
  }
}

export const createStatefulTabWriter = (
  options: StatefulTabWriterOptions = {}
): StatefulTabWriter => {
  const spacing = options.spacing ?? DEFAULT_SPACING
  const align = options.align
  const minColumnWidthsByHeader = options.minColumnWidthsByHeader ?? {}

  let currentHeader: string[] = []
  let currentWidths: number[] = []
  let previousRowKeys = new Set<string>()

  const ingestHeaderAndRows = (
    header: string[],
    rows: string[][]
  ): string[] => {
    currentHeader = [...header]
    currentWidths = growWidths(
      currentWidths,
      currentHeader,
      rows,
      minColumnWidthsByHeader
    )
    previousRowKeys = new Set(rows.map((row) => buildRowKey(row)))

    const formattedHeader = formatCells(
      currentHeader,
      currentWidths,
      spacing,
      align
    )
    const formattedRows = rows.map((row) =>
      formatCells(row, currentWidths, spacing, align)
    )
    return [formattedHeader, ...formattedRows]
  }

  const formatRows = (rows: string[][]): string[] => {
    if (currentHeader.length === 0) {
      return []
    }
    currentWidths = growWidths(
      currentWidths,
      currentHeader,
      rows,
      minColumnWidthsByHeader
    )
    return rows.map((row) => formatCells(row, currentWidths, spacing, align))
  }

  const formatDelta = (rows: string[][]): string[] => {
    if (currentHeader.length === 0) {
      return []
    }
    currentWidths = growWidths(
      currentWidths,
      currentHeader,
      rows,
      minColumnWidthsByHeader
    )
    const currentRowKeys = new Set(rows.map((row) => buildRowKey(row)))
    const deltaRows = rows
      .filter((row) => !previousRowKeys.has(buildRowKey(row)))
      .map((row) => formatCells(row, currentWidths, spacing, align))
    previousRowKeys = currentRowKeys
    return deltaRows
  }

  const reset = (): void => {
    currentHeader = []
    currentWidths = []
    previousRowKeys = new Set<string>()
  }

  return {
    ingestHeaderAndRows,
    formatDelta,
    formatRows,
    reset
  }
}
