// ═══════════════════════════════════════════════════════════════════════════
// LOG GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
// Generates realistic container logs based on image type
// Supports: nginx, redis, mysql, postgres, and generic applications

const MAX_LOGS = 200

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

// ─── Helper Functions ─────────────────────────────────────────────────────

const randomChoice = <T>(items: T[]): T => {
    return items[Math.floor(Math.random() * items.length)]
}

const randomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

const getImageType = (image: string): string => {
    const imageLower = image.toLowerCase().split(':')[0]
    if (imageLower.includes('nginx')) {
        return 'nginx'
    }
    if (imageLower.includes('redis')) {
        return 'redis'
    }
    if (imageLower.includes('mysql')) {
        return 'mysql'
    }
    if (imageLower.includes('postgres')) {
        return 'postgres'
    }
    return 'generic'
}

const getLogLevel = (index: number): LogLevel => {
    // More INFO at the start, occasional WARN/ERROR later
    if (index < 3) {
        return 'INFO'
    }

    const rand = Math.random()
    if (rand < 0.75) {
        return 'INFO'
    }
    if (rand < 0.90) {
        return 'WARN'
    }
    if (rand < 0.97) {
        return 'DEBUG'
    }
    return 'ERROR'
}

const formatTimestamp = (baseTime: Date, offsetSeconds: number): string => {
    const time = new Date(baseTime.getTime() + offsetSeconds * 1000)
    return time.toISOString().substring(0, 19) + 'Z'
}

// ─── Log Generators by Image Type ─────────────────────────────────────────

const generateNginxLog = (timestamp: string, level: LogLevel): string => {
    const ips = ['192.168.1.100', '10.0.0.5', '172.16.0.42', '192.168.1.200']
    const methods = ['GET', 'POST', 'PUT', 'DELETE']
    const paths = ['/', '/api/users', '/api/products', '/health', '/static/app.js', '/index.html']
    const statuses = level === 'ERROR' ? ['500', '502', '503'] : level === 'WARN' ? ['404', '403'] : ['200', '201', '304']
    const userAgents = ['Mozilla/5.0', 'curl/7.68.0', 'Go-http-client/1.1']

    const ip = randomChoice(ips)
    const method = randomChoice(methods)
    const path = randomChoice(paths)
    const status = randomChoice(statuses)
    const bytes = randomInt(100, 5000)
    const userAgent = randomChoice(userAgents)

    return `${timestamp} ${level} ${ip} - - [${timestamp}] "${method} ${path} HTTP/1.1" ${status} ${bytes} "-" "${userAgent}"`
}

const generateRedisLog = (timestamp: string, level: LogLevel, index: number): string => {
    if (index < 3) {
        const messages = [
            'Redis server started, Redis version 6.2.6',
            'Server initialized',
            'Ready to accept connections on port 6379'
        ]
        return `${timestamp} INFO ${messages[index] || messages[0]}`
    }

    const messages = [
        'Accepted connection from 127.0.0.1:6379',
        'DB 0: 10 keys, 0 expires',
        'Background saving started by pid 42',
        'Background saving terminated with success',
        'Client connection established',
        'Replication connection established',
        '100 changes in 300 seconds. Saving...',
        'RDB: 0 MB of memory used by copy-on-write'
    ]

    if (level === 'WARN') {
        return `${timestamp} WARN Slow query detected: GET key took 120ms`
    }
    if (level === 'ERROR') {
        return `${timestamp} ERROR Connection timeout from client 192.168.1.50:45678`
    }

    return `${timestamp} ${level} ${randomChoice(messages)}`
}

const generateMysqlLog = (timestamp: string, level: LogLevel, index: number): string => {
    if (index < 3) {
        const messages = [
            'mysqld: ready for connections. Version: 8.0.27  port: 3306',
            'InnoDB: Buffer pool(s) load completed at ' + timestamp,
            'MySQL Community Server - GPL initialized'
        ]
        return `${timestamp} ${level} ${messages[index] || messages[0]}`
    }

    const messages = [
        'Connection received from 192.168.1.100:3306',
        'Query: SELECT * FROM users WHERE id = 42',
        'Query execution time: 0.05s',
        'InnoDB: page_cleaner: 1000 pages flushed',
        'Access granted for user root@localhost',
        'Binary log rotated',
        'Temporary table created for query'
    ]

    if (level === 'WARN') {
        return `${timestamp} WARN Query took longer than long_query_time: 2.5s`
    }
    if (level === 'ERROR') {
        return `${timestamp} ERROR Access denied for user 'app'@'192.168.1.50'`
    }

    return `${timestamp} ${level} ${randomChoice(messages)}`
}

const generatePostgresLog = (timestamp: string, level: LogLevel, index: number): string => {
    if (index < 3) {
        const messages = [
            'database system is ready to accept connections',
            'PostgreSQL 13.4 on x86_64-pc-linux-gnu, compiled by gcc',
            'listening on IPv4 address "0.0.0.0", port 5432'
        ]
        return `${timestamp} ${level} ${messages[index] || messages[0]}`
    }

    const messages = [
        'connection received: host=192.168.1.100 port=54321',
        'connection authorized: user=postgres database=myapp',
        'statement: SELECT version();',
        'checkpoint starting: time',
        'checkpoint complete: wrote 123 buffers',
        'autovacuum: processing database "postgres"',
        'duration: 0.142 ms'
    ]

    if (level === 'WARN') {
        return `${timestamp} WARN could not receive data from client: Connection reset by peer`
    }
    if (level === 'ERROR') {
        return `${timestamp} ERROR role "admin" does not exist`
    }

    return `${timestamp} ${level} ${randomChoice(messages)}`
}

const generateGenericLog = (timestamp: string, level: LogLevel, index: number): string => {
    if (index < 3) {
        const messages = [
            'Application starting...',
            'Initialization complete',
            'Server ready on port 8080'
        ]
        return `${timestamp} ${level} ${messages[index] || messages[0]}`
    }

    const messages = [
        'Processing request',
        'Database connection established',
        'Cache hit for key: user:123',
        'Background job completed successfully',
        'Health check passed',
        'Metrics updated',
        'Request handled in 45ms',
        'Connected to message queue'
    ]

    if (level === 'WARN') {
        return `${timestamp} WARN Retry attempt 2/3 for external API call`
    }
    if (level === 'ERROR') {
        return `${timestamp} ERROR Failed to connect to external service: timeout`
    }

    return `${timestamp} ${level} ${randomChoice(messages)}`
}

// ─── Main Generator ───────────────────────────────────────────────────────

/**
 * Generate realistic logs for a container based on its image type
 * @param containerImage - Image name (e.g., "nginx:latest", "redis:6")
 * @param count - Number of log lines to generate (max 200)
 * @returns Array of log lines with timestamps and realistic content
 */
export const generateLogs = (containerImage: string, count: number): string[] => {
    if (count <= 0) {
        return []
    }

    const actualCount = Math.min(count, MAX_LOGS)
    const imageType = getImageType(containerImage)
    const logs: string[] = []

    // Start time is a few minutes ago
    const baseTime = new Date(Date.now() - 10 * 60 * 1000)
    let currentOffset = 0

    // Log generator lookup table (object lookup pattern)
    const LOG_GENERATORS: Record<string, (ts: string, level: LogLevel, i: number) => string> = {
        nginx: generateNginxLog,
        redis: generateRedisLog,
        mysql: generateMysqlLog,
        postgres: generatePostgresLog
    }

    for (let i = 0; i < actualCount; i++) {
        currentOffset += randomInt(1, 5)
        const timestamp = formatTimestamp(baseTime, currentOffset)
        const level = getLogLevel(i)

        const generator = LOG_GENERATORS[imageType] || generateGenericLog
        const logLine = generator(timestamp, level, i)

        logs.push(logLine)
    }

    return logs
}

