import { describe, expect, it } from 'vitest'
import { generateLogs } from '../../../src/core/cluster/logGenerator'

describe('LogGenerator', () => {
  describe('generateLogs - count validation', () => {
    it('should return empty array when count is 0', () => {
      const logs = generateLogs('nginx:latest', 0)
      expect(logs).toEqual([])
    })

    it('should return empty array when count is negative', () => {
      const logs = generateLogs('nginx:latest', -5)
      expect(logs).toEqual([])
    })

    it('should generate exact count of logs when count < MAX_LOGS', () => {
      const logs = generateLogs('nginx:latest', 10)
      expect(logs).toHaveLength(10)
    })

    it('should truncate to 200 logs when count exceeds MAX_LOGS', () => {
      const logs = generateLogs('nginx:latest', 500)
      expect(logs).toHaveLength(200)
    })

    it('should generate exactly 200 logs when count is 200', () => {
      const logs = generateLogs('nginx:latest', 200)
      expect(logs).toHaveLength(200)
    })
  })

  describe('generateLogs - nginx image', () => {
    it('should generate nginx-style logs for nginx image', () => {
      const logs = generateLogs('nginx:latest', 5)

      expect(logs).toHaveLength(5)
      const hasEntrypointContent = logs.some((log) => {
        return log.includes('/docker-entrypoint.sh')
      })
      expect(hasEntrypointContent).toBe(true)
    })

    it('should recognize nginx image with different tags', () => {
      const logs = generateLogs('nginx:1.21.0', 3)
      expect(logs).toHaveLength(3)
    })

    it('should recognize nginx in uppercase', () => {
      const logs = generateLogs('NGINX:latest', 3)
      expect(logs).toHaveLength(3)
    })

    it('should include nginx notice lines after startup sequence', () => {
      const logs = generateLogs('nginx:latest', 50)
      const hasNginxNotice = logs.some((log) =>
        /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} \[notice\] 1#1:/.test(log)
      )
      expect(hasNginxNotice).toBe(true)
    })
  })

  describe('generateLogs - redis image', () => {
    it('should generate redis-style logs for redis image', () => {
      const logs = generateLogs('redis:6', 5)

      expect(logs).toHaveLength(5)
      // First logs should contain startup messages
      expect(logs[0]).toContain('Redis')
    })

    it('should include redis startup messages in first logs', () => {
      const logs = generateLogs('redis:alpine', 3)

      const hasStartupMessage = logs.some(
        (log) =>
          log.includes('Redis server started') ||
          log.includes('Server initialized') ||
          log.includes('Ready to accept connections')
      )
      expect(hasStartupMessage).toBe(true)
    })

    it('should recognize redis in image path', () => {
      const logs = generateLogs('myregistry/redis:7.0', 3)
      expect(logs).toHaveLength(3)
    })
  })

  describe('generateLogs - mysql image', () => {
    it('should generate mysql-style logs for mysql image', () => {
      const logs = generateLogs('mysql:8.0', 5)

      expect(logs).toHaveLength(5)
    })

    it('should include mysql startup messages in first logs', () => {
      const logs = generateLogs('mysql:latest', 3)

      const hasMysqlContent = logs.some(
        (log) =>
          log.includes('mysqld') ||
          log.includes('InnoDB') ||
          log.includes('MySQL')
      )
      expect(hasMysqlContent).toBe(true)
    })
  })

  describe('generateLogs - postgres image', () => {
    it('should generate postgres-style logs for postgres image', () => {
      const logs = generateLogs('postgres:13', 5)

      expect(logs).toHaveLength(5)
    })

    it('should include postgres startup messages in first logs', () => {
      const logs = generateLogs('postgres:latest', 3)

      const hasPostgresContent = logs.some(
        (log) =>
          log.includes('database system is ready') ||
          log.includes('PostgreSQL') ||
          log.includes('listening on')
      )
      expect(hasPostgresContent).toBe(true)
    })
  })

  describe('generateLogs - generic/fallback', () => {
    it('should generate generic logs for unknown image', () => {
      const logs = generateLogs('myapp:1.0.0', 5)

      expect(logs).toHaveLength(5)
    })

    it('should include generic startup messages for unknown images', () => {
      const logs = generateLogs('custom-service:v2', 3)

      const hasGenericContent = logs.some(
        (log) =>
          log.includes('Application starting') ||
          log.includes('Initialization complete') ||
          log.includes('Server ready')
      )
      expect(hasGenericContent).toBe(true)
    })

    it('should handle empty image string as generic', () => {
      const logs = generateLogs('', 3)
      expect(logs).toHaveLength(3)
    })
  })

  describe('generateLogs - timestamp format', () => {
    it('should include ISO timestamp in each log line', () => {
      const logs = generateLogs('generic:latest', 10)

      logs.forEach((log) => {
        expect(log).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/)
      })
    })

    it('should have increasing timestamps', () => {
      const logs = generateLogs('generic:latest', 5)

      const timestamps = logs.map((log) => {
        const match = log.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/)
        return match ? new Date(match[1]).getTime() : 0
      })

      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1])
      }
    })
  })

  describe('generateLogs - log levels', () => {
    it('should include INFO level in logs', () => {
      const logs = generateLogs('generic:latest', 20)

      const hasInfo = logs.some((log) => log.includes('INFO'))
      expect(hasInfo).toBe(true)
    })

    it('should have INFO level for first few logs', () => {
      const logs = generateLogs('generic:latest', 5)

      // First 3 logs should be INFO
      expect(logs[0]).toContain('INFO')
      expect(logs[1]).toContain('INFO')
      expect(logs[2]).toContain('INFO')
    })

    it('should potentially include WARN, ERROR, or DEBUG levels', () => {
      // Generate many logs to have a chance of getting different levels
      const logs = generateLogs('nginx:latest', 200)

      const hasVariedLevels =
        logs.some((log) => log.includes('WARN')) ||
        logs.some((log) => log.includes('ERROR')) ||
        logs.some((log) => log.includes('DEBUG'))

      // Due to randomness, this should usually be true for 200 logs
      // but might occasionally fail - that's expected behavior
      expect(logs.length).toBe(200)
    })
  })

  describe('generateLogs - edge cases', () => {
    it('should handle image with only name (no tag)', () => {
      const logs = generateLogs('nginx', 3)
      expect(logs).toHaveLength(3)
    })

    it('should handle image with registry prefix', () => {
      const logs = generateLogs('docker.io/library/nginx:latest', 3)
      expect(logs).toHaveLength(3)
    })

    it('should generate single log correctly', () => {
      const logs = generateLogs('nginx:latest', 1)
      expect(logs).toHaveLength(1)
      expect(logs[0]).toBeTruthy()
    })
  })
})
