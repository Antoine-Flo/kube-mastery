// ═══════════════════════════════════════════════════════════════════════════
// FILESYSTEM EVENT TYPES
// ═══════════════════════════════════════════════════════════════════════════
// Type definitions for filesystem events.
// Events represent state changes (CRUD operations) on files and directories.

import type { BaseEvent } from '../../events/types'
import type { FileNode } from '../models/File'
import type { DirectoryNode } from '../models/Directory'

// ─── File Events ──────────────────────────────────────────────────────────

export interface FileCreatedEvent extends BaseEvent {
  type: 'FileCreated'
  payload: {
    file: FileNode
    path: string
  }
}

export interface FileModifiedEvent extends BaseEvent {
  type: 'FileModified'
  payload: {
    path: string
    file: FileNode
    previousFile: FileNode
  }
}

export interface FileDeletedEvent extends BaseEvent {
  type: 'FileDeleted'
  payload: {
    path: string
    deletedFile: FileNode
  }
}

// ─── Directory Events ─────────────────────────────────────────────────────

export interface DirectoryCreatedEvent extends BaseEvent {
  type: 'DirectoryCreated'
  payload: {
    directory: DirectoryNode
    path: string
  }
}

export interface DirectoryDeletedEvent extends BaseEvent {
  type: 'DirectoryDeleted'
  payload: {
    path: string
    deletedDirectory: DirectoryNode
  }
}

// ─── Navigation Events ─────────────────────────────────────────────────────

export interface DirectoryChangedEvent extends BaseEvent {
  type: 'DirectoryChanged'
  payload: {
    previousPath: string
    currentPath: string
  }
}

// ─── Event Union Type ────────────────────────────────────────────────────

export type FileSystemEvent =
  | FileCreatedEvent
  | FileModifiedEvent
  | FileDeletedEvent
  | DirectoryCreatedEvent
  | DirectoryDeletedEvent
  | DirectoryChangedEvent

// ─── Event Factory Helpers ────────────────────────────────────────────────

const createEventMetadata = (source?: string): BaseEvent['metadata'] => ({
  source: source || 'filesystem',
  correlationId: crypto.randomUUID()
})

const createEventTimestamp = (): string => new Date().toISOString()

// ─── Event Factory Functions ──────────────────────────────────────────────

/**
 * Create FileCreated event
 */
export const createFileCreatedEvent = (
  file: FileNode,
  path: string,
  source?: string
): FileCreatedEvent => ({
  type: 'FileCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { file, path }
})

/**
 * Create FileModified event
 */
export const createFileModifiedEvent = (
  path: string,
  file: FileNode,
  previousFile: FileNode,
  source?: string
): FileModifiedEvent => ({
  type: 'FileModified',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { path, file, previousFile }
})

/**
 * Create FileDeleted event
 */
export const createFileDeletedEvent = (
  path: string,
  deletedFile: FileNode,
  source?: string
): FileDeletedEvent => ({
  type: 'FileDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { path, deletedFile }
})

/**
 * Create DirectoryCreated event
 */
export const createDirectoryCreatedEvent = (
  directory: DirectoryNode,
  path: string,
  source?: string
): DirectoryCreatedEvent => ({
  type: 'DirectoryCreated',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { directory, path }
})

/**
 * Create DirectoryDeleted event
 */
export const createDirectoryDeletedEvent = (
  path: string,
  deletedDirectory: DirectoryNode,
  source?: string
): DirectoryDeletedEvent => ({
  type: 'DirectoryDeleted',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { path, deletedDirectory }
})

/**
 * Create DirectoryChanged event
 */
export const createDirectoryChangedEvent = (
  previousPath: string,
  currentPath: string,
  source?: string
): DirectoryChangedEvent => ({
  type: 'DirectoryChanged',
  timestamp: createEventTimestamp(),
  metadata: createEventMetadata(source),
  payload: { previousPath, currentPath }
})
