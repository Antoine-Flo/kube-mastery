// ═══════════════════════════════════════════════════════════════════════════
// SEED REGISTRY
// ═══════════════════════════════════════════════════════════════════════════
// Resolves seed name (from chapter.json environment) to filesystem seed data.
// No barrel: direct imports per seed file.

import type { FsConfig } from '../../core/filesystem/debianFileSystem'
import {
  fsConfig as demoFsConfig
} from './demo'
import {
  fsConfig as introFsConfig
} from './intro'
import {
  fsConfig as minimalFsConfig
} from './minimal'

export interface SeedData {
  fsConfig: FsConfig
}

/**
 * Get seed data by name. Used for lesson pages (chapter.environment).
 * Unknown or empty → "minimal".
 */
export function getSeed(seedName: string): SeedData {
  const name = (seedName || '').trim().toLowerCase()
  if (name === 'empty' || name === '') {
    return { fsConfig: minimalFsConfig }
  }
  if (name === 'demo') {
    return { fsConfig: demoFsConfig }
  }
  if (name === 'intro') {
    return { fsConfig: introFsConfig }
  }
  return { fsConfig: minimalFsConfig }
}
