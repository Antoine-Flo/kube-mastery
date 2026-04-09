/**
 * Bundled behind a dynamic import from the lesson layout script so the initial
 * layout chunk does not pull the full emulator + seeds into the critical path.
 */
import {
  createEmulatedEnvironment,
  destroyEmulatedEnvironment
} from '../../core/emulatedEnvironment/EmulatedEnvironmentManager'
import { getSeed } from '../../courses/seeds/getSeed'
import { createFilesystemFromConfig } from '../../core/filesystem/debianFileSystem'
import type { EmulatedEnvironment } from '../../core/emulatedEnvironment/EmulatedEnvironment'

export { destroyEmulatedEnvironment }

export function createLessonEmulatedEnvironment(
  seedName: string
): EmulatedEnvironment {
  const seed = getSeed(seedName)
  return createEmulatedEnvironment({
    filesystemState: createFilesystemFromConfig(seed.fsConfig ?? {})
  })
}
