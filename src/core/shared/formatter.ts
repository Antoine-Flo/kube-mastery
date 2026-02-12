// ═══════════════════════════════════════════════════════════════════════════
// SHARED FORMATTERS - SHELL-LIKE OUTPUT
// ═══════════════════════════════════════════════════════════════════════════
// Pure functions for formatting command output in Unix/kubectl style.
// Reproduces real shell behavior: ls, kubectl get, kubectl describe, etc.

// ─── Types ───────────────────────────────────────────────────────────────

interface TableOptions {
  align?: ('left' | 'right')[] // Per-column alignment (no center, like real shells)
  spacing?: number // Spaces between columns (default: 2 like kubectl)
  uppercase?: boolean // Uppercase headers (default: true for kubectl)
}

interface ColumnOptions {
  terminalWidth?: number // Terminal width (default: 80)
  spacing?: number // Spaces between columns (default: 2)
  sort?: boolean // Alphabetical sort (default: true)
}

export interface FileEntry {
  type: 'file' | 'directory'
  name: string
  size: number // bytes
  modified: string // ISO timestamp
}

interface KeyValueOptions {
  indent?: number // Indentation (default: 2)
  separator?: string // Separator (default: ':  ' with 2 spaces)
  maxKeyWidth?: number // Max key width for alignment
}

// ─── String Comparison ───────────────────────────────────────────────────

/**
 * Alphabetical string comparison using localeCompare for reliable sorting
 * @param a - First string
 * @param b - Second string
 * @returns Negative if a < b, positive if a > b, zero if equal
 *
 * @example
 * ['zebra', 'apple', 'Banana'].sort(compareStrings)
 * // => ['apple', 'Banana', 'zebra']
 */
const compareStrings = (a: string, b: string): number => {
  return a.localeCompare(b)
}

// ─── Helpers - Unix-like Formatting ──────────────────────────────────────

/**
 * Format age like kubectl (2m, 5h, 3d)
 * Pure function
 *
 * @param timestamp - ISO timestamp string
 * @returns Age string in kubectl format
 *
 * @example
 * formatAge('2025-10-16T10:00:00Z')  // If now is 10:05:00 => '5m'
 * formatAge('2025-10-15T10:00:00Z')  // If now is next day => '1d'
 */
export const formatAge = (timestamp: string): string => {
  const now = new Date()
  const created = new Date(timestamp)
  const diffMs = now.getTime() - created.getTime()
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 1) {
    return '0s'
  }
  if (diffSecs < 60) {
    return `${diffSecs}s`
  }

  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) {
    return `${diffMins}m`
  }

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) {
    return `${diffHours}h`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

/**
 * Format date like ls (Jan 15 10:30 or Jan 15 2024)
 * Recent files (<6 months): show time
 * Old files (>6 months): show year
 * Pure function
 *
 * @param timestamp - ISO timestamp string
 * @returns Date string in ls format
 *
 * @example
 * formatDate('2025-01-15T10:30:00Z')  // 'Jan 15 10:30' if within 6 months
 * formatDate('2024-01-15T10:30:00Z')  // 'Jan 15  2024' if older
 */
const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ]
  const month = months[date.getUTCMonth()]
  const day = date.getUTCDate().toString().padStart(2, ' ')

  if (date > sixMonthsAgo) {
    // Recent: show time (HH:MM) in UTC
    const hours = date.getUTCHours().toString().padStart(2, '0')
    const minutes = date.getUTCMinutes().toString().padStart(2, '0')
    return `${month} ${day} ${hours}:${minutes}`
  }

  // Old: show year
  const year = date.getUTCFullYear()
  return `${month} ${day}  ${year}`
}

/**
 * Format permissions like ls (simplified for simulation)
 * Pure function
 *
 * @param type - File type ('file' or 'directory')
 * @returns Permission string (simplified: 'd---' or '----')
 *
 * @example
 * formatPermissions('directory')  // 'd---'
 * formatPermissions('file')       // '----'
 */
const formatPermissions = (type: 'file' | 'directory'): string => {
  return type === 'directory' ? 'd---' : '----'
}

/**
 * Calculate optimal column widths for table
 * Pure function
 *
 * @param rows - 2D array of cell values (includes headers)
 * @returns Array of column widths
 *
 * @example
 * calculateColumnWidths([['Name', 'Age'], ['Alice', '30'], ['Bob', '25']])
 * // => [5, 3]  (max width of each column)
 */
const calculateColumnWidths = (rows: string[][]): number[] => {
  if (rows.length === 0) {
    return []
  }

  const colCount = Math.max(...rows.map((row) => row.length))
  const widths: number[] = new Array(colCount).fill(0)

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cellLength = row[i].length
      if (cellLength > widths[i]) {
        widths[i] = cellLength
      }
    }
  }

  return widths
}

/**
 * Pad cell to specified width with alignment
 * Pure function
 *
 * @param text - Cell text
 * @param width - Target width
 * @param align - Alignment ('left' or 'right')
 * @returns Padded string
 *
 * @example
 * padCell('foo', 5, 'left')   // 'foo  '
 * padCell('foo', 5, 'right')  // '  foo'
 */
const padCell = (
  text: string,
  width: number,
  align: 'left' | 'right'
): string => {
  if (text.length >= width) {
    return text
  }

  const padding = ' '.repeat(width - text.length)
  return align === 'right' ? padding + text : text + padding
}

// ─── Table Formatter - kubectl style ─────────────────────────────────────

/**
 * Format data as table (kubectl style)
 * Pure function
 *
 * Headers are uppercase by default, columns auto-sized, minimal spacing
 *
 * @param headers - Column headers
 * @param rows - Data rows (2D array)
 * @param options - Formatting options
 * @returns Formatted table string
 *
 * @example
 * formatTable(
 *   ['name', 'status', 'age'],
 *   [['nginx', 'Running', '5m'], ['redis', 'Running', '10m']]
 * )
 * // =>
 * // NAME   STATUS   AGE
 * // nginx  Running  5m
 * // redis  Running  10m
 */
export const formatTable = (
  headers: string[],
  rows: string[][],
  options: TableOptions = {}
): string => {
  const { spacing = 2, uppercase = true, align } = options

  if (headers.length === 0) {
    return ''
  }

  // Uppercase headers if requested
  const processedHeaders = uppercase
    ? headers.map((h) => h.toUpperCase())
    : headers

  // Combine headers and rows for width calculation
  const allRows = [processedHeaders, ...rows]
  const widths = calculateColumnWidths(allRows)

  // Auto-detect alignment: numbers right, text left
  const alignments =
    align ||
    headers.map((_, colIndex) => {
      // Check if all non-header values in this column are numbers
      const isNumericColumn = rows.every((row) => {
        const cell = row[colIndex] || ''
        return cell === '' || !isNaN(Number(cell))
      })
      return isNumericColumn ? 'right' : 'left'
    })

  // Format rows
  const formattedRows = allRows.map((row) => {
    const cells = row.map((cell, i) => {
      const width = widths[i] || 0
      const alignment = alignments[i] || 'left'
      // Don't pad last column if left-aligned (avoid trailing spaces)
      // DO pad last column if right-aligned (needed for alignment)
      const isLastColumn = i === widths.length - 1
      if (isLastColumn && alignment === 'left') {
        return cell
      }
      return padCell(cell, width, alignment)
    })
    return cells.join(' '.repeat(spacing))
  })

  return formattedRows.join('\n')
}

// ─── Column Formatter - ls style ─────────────────────────────────────────

/**
 * Format items as columns (ls style)
 * Pure function
 *
 * Items are sorted alphabetically and distributed horizontally
 *
 * @param items - List of items to format
 * @param options - Formatting options
 * @returns Formatted columns string
 *
 * @example
 * formatColumns(['file3', 'file1', 'file2'])
 * // => 'file1  file2  file3'
 */
export const formatColumns = (
  items: string[],
  options: ColumnOptions = {}
): string => {
  const { spacing = 2, sort = true, terminalWidth = 80 } = options

  if (items.length === 0) {
    return ''
  }

  // Sort alphabetically if requested
  const sortedItems = sort ? [...items].sort(compareStrings) : items

  // Try to fit everything on one line first
  const oneLine = sortedItems.join(' '.repeat(spacing))
  if (oneLine.length <= terminalWidth) {
    return oneLine
  }

  // If doesn't fit, just join with spacing (multi-line handled by terminal wrap)
  return sortedItems.join(' '.repeat(spacing))
}

// ─── Long Listing Formatter - ls -l style ────────────────────────────────

/**
 * Format files as long listing (ls -l style)
 * Pure function
 *
 * Shows permissions, size, date, name in Unix format
 *
 * @param entries - File entries to format
 * @returns Formatted long listing string
 *
 * @example
 * formatLongListing([
 *   { type: 'directory', name: 'src', size: 512, modified: '2025-01-15T10:30:00Z' },
 *   { type: 'file', name: 'README.md', size: 1234, modified: '2025-01-15T11:45:00Z' }
 * ])
 * // =>
 * // d---   512  Jan 15 10:30  src
 * // ---- 1234  Jan 15 11:45  README.md
 */
export const formatLongListing = (entries: FileEntry[]): string => {
  if (entries.length === 0) {
    return ''
  }

  // Calculate max size width for right alignment (use raw numbers)
  const maxSizeWidth = Math.max(...entries.map((e) => e.size.toString().length))

  const lines = entries.map((entry) => {
    const perms = formatPermissions(entry.type)
    const size = padCell(entry.size.toString(), maxSizeWidth, 'right')
    const date = formatDate(entry.modified)
    const name = entry.name

    return `${perms}  ${size}  ${date}  ${name}`
  })

  return lines.join('\n')
}
