import { describe, expect, it, vi } from 'vitest'
import { error, success } from '../../../../../src/core/shared/result'
import { createNanoHandler } from '../../../../../src/core/shell/commands/handlers/editor/nano'
import { createFile as createFileNode } from '../../../../../src/core/filesystem/models'
import { createMockFileSystem } from '../../../helpers/mockFileSystem'

describe('Editor Handler (nano)', () => {
  it('should open editor for existing file', () => {
    const openCallback = vi.fn()
    const editorModal = {
      open: openCallback
    }
    const fileSystem = createMockFileSystem({
      readFile: (filename: string) => {
        expect(filename).toBe('test.yaml')
        return success('existing content')
      }
    })
    const handler = createNanoHandler(fileSystem, editorModal)
    const result = handler.execute(['test.yaml'], {})

    expect(result.ok).toBe(true)
    expect(openCallback).toHaveBeenCalledWith(
      'test.yaml',
      'existing content',
      expect.any(Function)
    )
  })

  it('should open editor for new file', () => {
    const openCallback = vi.fn()
    const editorModal = {
      open: openCallback
    }
    const createFileMock = vi.fn(() =>
      success(createFileNode('new.yaml', '/home/kube/new.yaml'))
    )
    const writeFileMock = vi.fn(() => success(undefined))
    const fileSystem = createMockFileSystem({
      readFile: () => error('File not found'),
      createFile: createFileMock,
      writeFile: writeFileMock
    })
    const handler = createNanoHandler(fileSystem, editorModal)
    const result = handler.execute(['new.yaml'], {})

    expect(result.ok).toBe(true)
    expect(openCallback).toHaveBeenCalledWith(
      'new.yaml',
      '',
      expect.any(Function)
    )

    // Test save callback creates file
    const saveCallback = openCallback.mock.calls[0][2]
    saveCallback('new content')
    expect(createFileMock).toHaveBeenCalledWith('new.yaml')
    expect(writeFileMock).toHaveBeenCalledWith('new.yaml', 'new content')
  })

  it('should return error when missing operand', () => {
    const editorModal = {
      open: vi.fn()
    }
    const fileSystem = createMockFileSystem()
    const handler = createNanoHandler(fileSystem, editorModal)
    const result = handler.execute([], {})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('missing file operand')
    }
  })

  it('should return error when editor not available', () => {
    const fileSystem = createMockFileSystem()
    const handler = createNanoHandler(fileSystem, undefined)
    const result = handler.execute(['test.yaml'], {})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Editor not available')
    }
  })

  it('should handle save callback for existing file', () => {
    const openCallback = vi.fn()
    const editorModal = {
      open: openCallback
    }
    const writeFileMock = vi.fn(() => success(undefined))
    const fileSystem = createMockFileSystem({
      readFile: () => success('old content'),
      writeFile: writeFileMock
    })
    const handler = createNanoHandler(fileSystem, editorModal)
    handler.execute(['test.yaml'], {})

    const saveCallback = openCallback.mock.calls[0][2]
    saveCallback('updated content')
    expect(writeFileMock).toHaveBeenCalledWith('test.yaml', 'updated content')
  })
})
