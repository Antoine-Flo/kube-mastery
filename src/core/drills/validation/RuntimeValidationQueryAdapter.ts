import type { EmulatedEnvironment } from '../../emulatedEnvironment/EmulatedEnvironment'
import { createFileSystem } from '../../filesystem/FileSystem'
import type { ValidationQueryPort } from './ValidationQueryPort'

export function createRuntimeValidationQueryAdapter(
  env: EmulatedEnvironment
): ValidationQueryPort {
  const fileSystem = createFileSystem(env.fileSystemState)
  return {
    findClusterResource: (kind, name, namespace) => {
      return env.apiServer.findResource(kind, name, namespace)
    },
    listClusterResources: (kind, namespace) => {
      return env.apiServer.listResources(kind, namespace)
    },
    readFile: (path) => {
      return fileSystem.readFile(path)
    }
  }
}
