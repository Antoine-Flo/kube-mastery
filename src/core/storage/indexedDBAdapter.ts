// ═══════════════════════════════════════════════════════════════════════════
// INDEXEDDB ADAPTER
// ═══════════════════════════════════════════════════════════════════════════
// Adapter for storing sandbox environments in IndexedDB.
// Stores objects directly without JSON serialization (IndexedDB handles it).

import type { ClusterStateData } from '../cluster/ClusterState'
import type { FileSystemState } from '../filesystem/FileSystem'
import type { Result } from '../shared/result'
import { error, success } from '../shared/result'
import { CONFIG } from '../../config'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface SandboxEnvironment {
  filesystem_state: FileSystemState
  cluster_state: ClusterStateData
  updated_at: string
}

// ═══════════════════════════════════════════════════════════════════════════
// INDEXEDDB ADAPTER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Open IndexedDB database
 */
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      CONFIG.storage.indexedDb.name,
      CONFIG.storage.indexedDb.version
    )

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message}`))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(CONFIG.storage.indexedDb.storeName)) {
        db.createObjectStore(CONFIG.storage.indexedDb.storeName, {
          keyPath: 'userId'
        })
      }
    }
  })
}

/**
 * Save sandbox environment to IndexedDB
 */
export const saveSandboxEnvironment = async (
  userId: string,
  filesystemState: FileSystemState,
  clusterState: ClusterStateData
): Promise<Result<void>> => {
  try {
    const db = await openDatabase()
    const transaction = db.transaction(
      [CONFIG.storage.indexedDb.storeName],
      'readwrite'
    )
    const store = transaction.objectStore(CONFIG.storage.indexedDb.storeName)

    const environment: SandboxEnvironment & { userId: string } = {
      userId,
      filesystem_state: filesystemState,
      cluster_state: clusterState,
      updated_at: new Date().toISOString()
    }

    return new Promise((resolve) => {
      const request = store.put(environment)

      request.onsuccess = () => {
        resolve(success(undefined))
      }

      request.onerror = () => {
        resolve(error(`Failed to save environment: ${request.error?.message}`))
      }
    })
  } catch (err) {
    return error(`Failed to save environment: ${(err as Error).message}`)
  }
}
