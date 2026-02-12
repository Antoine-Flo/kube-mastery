import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger, type Logger } from '../../../src/logger/Logger'

describe('Logger', () => {
  let logger: Logger

  beforeEach(() => {
    logger = createLogger()
  })

  describe('log methods', () => {
    it('should log info messages', () => {
      logger.info('COMMAND', 'Test info message')

      const entries = logger.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].level).toBe('info')
      expect(entries[0].category).toBe('COMMAND')
      expect(entries[0].message).toBe('Test info message')
    })

    it('should log warn messages', () => {
      logger.warn('EXECUTOR', 'Warning message')

      const entries = logger.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].level).toBe('warn')
      expect(entries[0].category).toBe('EXECUTOR')
    })

    it('should log error messages', () => {
      logger.error('FILESYSTEM', 'Error occurred')

      const entries = logger.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].level).toBe('error')
      expect(entries[0].category).toBe('FILESYSTEM')
    })

    it('should log debug messages', () => {
      logger.debug('CLUSTER', 'Debug info')

      const entries = logger.getEntries()
      expect(entries).toHaveLength(1)
      expect(entries[0].level).toBe('debug')
      expect(entries[0].category).toBe('CLUSTER')
    })

    it('should include timestamp in entries', () => {
      logger.info('COMMAND', 'Test')

      const entries = logger.getEntries()
      expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('getEntries', () => {
    beforeEach(() => {
      logger.info('COMMAND', 'Shell info')
      logger.warn('EXECUTOR', 'Kubectl warning')
      logger.error('COMMAND', 'Shell error')
      logger.debug('CLUSTER', 'Cluster debug')
    })

    it('should return all entries without filter', () => {
      const entries = logger.getEntries()
      expect(entries).toHaveLength(4)
    })

    it('should filter by level', () => {
      const entries = logger.getEntries({ level: 'warn' })
      expect(entries).toHaveLength(1)
      expect(entries[0].level).toBe('warn')
    })

    it('should filter by category', () => {
      const entries = logger.getEntries({ category: 'COMMAND' })
      expect(entries).toHaveLength(2)
      entries.forEach((e) => expect(e.category).toBe('COMMAND'))
    })

    it('should filter by both level and category', () => {
      const entries = logger.getEntries({ level: 'info', category: 'COMMAND' })
      expect(entries).toHaveLength(1)
      expect(entries[0].level).toBe('info')
      expect(entries[0].category).toBe('COMMAND')
    })

    it('should return empty array when no matches', () => {
      const entries = logger.getEntries({
        level: 'error',
        category: 'EXECUTOR'
      })
      expect(entries).toHaveLength(0)
    })

    it('should return copy of entries (immutable)', () => {
      const entries1 = logger.getEntries()
      const entries2 = logger.getEntries()
      expect(entries1).not.toBe(entries2)
    })
  })

  describe('clear', () => {
    it('should clear all entries', () => {
      logger.info('COMMAND', 'Message 1')
      logger.warn('EXECUTOR', 'Message 2')
      expect(logger.getEntries()).toHaveLength(2)

      logger.clear()

      expect(logger.getEntries()).toHaveLength(0)
    })
  })

  describe('subscribe', () => {
    it('should notify observer on new log entry', () => {
      const observer = vi.fn()
      logger.subscribe(observer)

      logger.info('COMMAND', 'Test message')

      expect(observer).toHaveBeenCalledTimes(1)
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          category: 'COMMAND',
          message: 'Test message'
        })
      )
    })

    it('should notify multiple observers', () => {
      const observer1 = vi.fn()
      const observer2 = vi.fn()

      logger.subscribe(observer1)
      logger.subscribe(observer2)

      logger.warn('EXECUTOR', 'Warning')

      expect(observer1).toHaveBeenCalled()
      expect(observer2).toHaveBeenCalled()
    })

    it('should stop notifying after unsubscribe', () => {
      const observer = vi.fn()
      const unsubscribe = logger.subscribe(observer)

      logger.info('COMMAND', 'First')
      expect(observer).toHaveBeenCalledTimes(1)

      unsubscribe()

      logger.info('COMMAND', 'Second')
      expect(observer).toHaveBeenCalledTimes(1)
    })
  })

  describe('FIFO rotation', () => {
    it('should respect maxEntries limit', () => {
      const smallLogger = createLogger({ maxEntries: 3 })

      smallLogger.info('COMMAND', 'Message 1')
      smallLogger.info('COMMAND', 'Message 2')
      smallLogger.info('COMMAND', 'Message 3')
      smallLogger.info('COMMAND', 'Message 4')

      const entries = smallLogger.getEntries()
      expect(entries).toHaveLength(3)
      expect(entries[0].message).toBe('Message 2')
      expect(entries[2].message).toBe('Message 4')
    })

    it('should use default maxEntries of 500', () => {
      const defaultLogger = createLogger()

      for (let i = 0; i < 510; i++) {
        defaultLogger.info('COMMAND', `Message ${i}`)
      }

      expect(defaultLogger.getEntries()).toHaveLength(500)
    })
  })

  describe('console mirroring', () => {
    it('should mirror to console when enabled', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})

      const mirrorLogger = createLogger({ mirrorToConsole: true })
      mirrorLogger.info('EXECUTOR', 'Console test')

      expect(consoleLogSpy).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EXECUTOR]')
      )

      consoleLogSpy.mockRestore()
    })

    it('should use correct console method for each level', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      const mirrorLogger = createLogger({ mirrorToConsole: true })

      mirrorLogger.warn('EXECUTOR', 'Warn test')
      expect(warnSpy).toHaveBeenCalled()

      mirrorLogger.error('EXECUTOR', 'Error test')
      expect(errorSpy).toHaveBeenCalled()

      mirrorLogger.debug('EXECUTOR', 'Debug test')
      expect(debugSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
      errorSpy.mockRestore()
      debugSpy.mockRestore()
    })

    it('should not mirror to console by default', () => {
      const consoleLogSpy = vi
        .spyOn(console, 'log')
        .mockImplementation(() => {})

      const normalLogger = createLogger()
      normalLogger.info('COMMAND', 'No mirror')

      expect(consoleLogSpy).not.toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })
  })
})
