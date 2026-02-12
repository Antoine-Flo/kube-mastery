// ═══════════════════════════════════════════════════════════════════════════
// FILE WRITER
// ═══════════════════════════════════════════════════════════════════════════
// Write golden files to disk

import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Result } from '../utils/types'
import { error, success } from '../utils/types'
import type { GoldenTestCategory } from '../config/golden-tests'

/**
 * Get the golden files base directory path
 */
const getGoldenFilesBaseDir = (): string => {
  const projectRoot = process.cwd()
  return join(projectRoot, 'refs', 'golden-files')
}

/**
 * Get the golden files directory path for a specific category
 */
const getGoldenFilesDir = (category: GoldenTestCategory): string => {
  const baseDir = getGoldenFilesBaseDir()
  return join(baseDir, category)
}

/**
 * Write a golden file organized by category
 */
export const writeGoldenFile = (
  name: string,
  content: string,
  category: GoldenTestCategory
): Result<void, string> => {
  try {
    const goldenDir = getGoldenFilesDir(category)
    mkdirSync(goldenDir, { recursive: true })

    const filePath = join(goldenDir, `${name}.txt`)
    writeFileSync(filePath, content, 'utf-8')

    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to write golden file ${name}: ${message}`)
  }
}
