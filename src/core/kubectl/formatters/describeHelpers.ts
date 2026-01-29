// ═══════════════════════════════════════════════════════════════════════════
// DESCRIBE FORMATTERS HELPERS
// ═══════════════════════════════════════════════════════════════════════════
// Pure helper functions and tagged template literals for kubectl describe formatting.
// Provides clean, concise API for formatting key-value pairs, sections, and indentation.

// ─── Key-Value Formatting ──────────────────────────────────────────────────

/**
 * Format key-value pair with consistent padding (kubectl style)
 * Keys are padded to 12 characters for alignment
 * Format: "Name:         value" (key + colon + spaces to reach 12 chars total)
 * Example: "Name:         nginx-pod" (Name: = 5 chars, needs 7 spaces to reach 12)
 */
export const kv = (key: string, value: string): string => {
    // If key already contains colon, use as-is, otherwise add it
    const keyWithColon = key.includes(':') ? key : `${key}:`
    // Pad to 12 characters total (key + colon + spaces)
    return `${keyWithColon.padEnd(12)}${value}`
}

// ─── Section Formatting ────────────────────────────────────────────────────

/**
 * Format a section with title and items (kubectl style)
 * Items are indented by 2 spaces
 */
export const section = (title: string, items: string[]): string[] => {
    if (items.length === 0) {
        return [`${title}:  <none>`]
    }
    return [
        `${title}:`,
        ...items.map(item => `  ${item}`)
    ]
}

// ─── Utility Functions ─────────────────────────────────────────────────────

/**
 * Return blank line
 */
export const blank = (): string => {
    return ''
}

/**
 * Indent text by specified level (each level = 2 spaces)
 */
export const indent = (text: string, level: number): string => {
    const spaces = ' '.repeat(level * 2)
    return `${spaces}${text}`
}
