// ═══════════════════════════════════════════════════════════════════════════
// LOG GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
// Generates deterministic logs with workload-specific profiles.

const MAX_LOGS = 200
const BASE_TIME_EPOCH = Date.parse('2026-02-28T16:00:00Z')

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
type WorkloadProfile =
  | 'control-plane-scheduler'
  | 'control-plane-apiserver'
  | 'control-plane-controller'
  | 'nginx'
  | 'redis'
  | 'mysql'
  | 'postgres'
  | 'generic'

export interface LogGenerationContext {
  podName?: string
  namespace?: string
  containerName?: string
}

type DeterministicRandom = () => number

const stringHash = (value: string): number => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const createDeterministicRandom = (seedValue: string): DeterministicRandom => {
  let seed = stringHash(seedValue) || 1
  return () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return (seed >>> 0) / 4294967296
  }
}

const randomChoice = <T>(rng: DeterministicRandom, items: T[]): T => {
  const index = Math.floor(rng() * items.length)
  return items[index]
}

const randomInt = (
  rng: DeterministicRandom,
  min: number,
  max: number
): number => {
  return Math.floor(rng() * (max - min + 1)) + min
}

const getProfile = (
  image: string,
  context?: LogGenerationContext
): WorkloadProfile => {
  const imageLower = image.toLowerCase()
  const podName = context?.podName?.toLowerCase() || ''
  if (podName.includes('kube-scheduler')) {
    return 'control-plane-scheduler'
  }
  if (podName.includes('kube-apiserver')) {
    return 'control-plane-apiserver'
  }
  if (podName.includes('kube-controller-manager')) {
    return 'control-plane-controller'
  }
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

const pad2 = (value: number): string => {
  return String(value).padStart(2, '0')
}

const pad6 = (value: number): string => {
  return String(value).padStart(6, '0')
}

const formatIsoTimestamp = (time: Date): string => {
  return time.toISOString().substring(0, 19) + 'Z'
}

const formatNginxTimestamp = (time: Date): string => {
  return [
    time.getUTCFullYear(),
    '/',
    pad2(time.getUTCMonth() + 1),
    '/',
    pad2(time.getUTCDate()),
    ' ',
    pad2(time.getUTCHours()),
    ':',
    pad2(time.getUTCMinutes()),
    ':',
    pad2(time.getUTCSeconds())
  ].join('')
}

const formatKubePrefix = (level: LogLevel, time: Date): string => {
  const month = pad2(time.getUTCMonth() + 1)
  const day = pad2(time.getUTCDate())
  const hh = pad2(time.getUTCHours())
  const mm = pad2(time.getUTCMinutes())
  const ss = pad2(time.getUTCSeconds())
  const micros = pad6(time.getUTCMilliseconds() * 1000)
  const code = level === 'ERROR' ? 'E' : level === 'WARN' ? 'W' : 'I'
  return `${code}${month}${day} ${hh}:${mm}:${ss}.${micros}       1`
}

const getLogLevel = (
  rng: DeterministicRandom,
  index: number,
  profile: WorkloadProfile
): LogLevel => {
  if (profile.startsWith('control-plane')) {
    if (index % 7 === 0) {
      return 'ERROR'
    }
    return 'INFO'
  }
  if (index < 5) {
    return 'INFO'
  }
  const value = rng()
  if (value < 0.78) {
    return 'INFO'
  }
  if (value < 0.9) {
    return 'WARN'
  }
  if (value < 0.97) {
    return 'DEBUG'
  }
  return 'ERROR'
}

const generateControlPlaneSchedulerLog = (
  level: LogLevel,
  time: Date,
  rng: DeterministicRandom
): string => {
  const prefix = formatKubePrefix(level, time)
  const errors = [
    `${prefix} reflector.go:204] "Failed to watch" err="failed to list *v1.Node: nodes is forbidden: User \\"system:kube-scheduler\\" cannot list resource \\"nodes\\" in API group \\"\\" at the cluster scope" logger="UnhandledError" reflector="k8s.io/client-go/informers/factory.go:161" type="*v1.Node"`,
    `${prefix} reflector.go:204] "Failed to watch" err="failed to list *v1.Pod: pods is forbidden: User \\"system:kube-scheduler\\" cannot list resource \\"pods\\" in API group \\"\\" at the cluster scope" logger="UnhandledError" reflector="k8s.io/client-go/informers/factory.go:161" type="*v1.Pod"`,
    `${prefix} reflector.go:204] "Failed to watch" err="failed to list *v1.Service: services is forbidden: User \\"system:kube-scheduler\\" cannot list resource \\"services\\" in API group \\"\\" at the cluster scope" logger="UnhandledError" reflector="k8s.io/client-go/informers/factory.go:161" type="*v1.Service"`
  ]
  const info = [
    `${prefix} shared_informer.go:377] "Caches are synced"`,
    `${prefix} leaderelection.go:258] "Attempting to acquire leader lease..." lock="kube-system/kube-scheduler"`,
    `${prefix} leaderelection.go:272] "Successfully acquired lease" lock="kube-system/kube-scheduler"`
  ]
  if (level === 'ERROR') {
    return randomChoice(rng, errors)
  }
  return randomChoice(rng, info)
}

const generateControlPlaneApiserverLog = (
  _level: LogLevel,
  time: Date,
  rng: DeterministicRandom
): string => {
  const prefix = formatKubePrefix('INFO', time)
  const entries = [
    `${prefix} cidrallocator.go:278] updated ClusterIP allocator for Service CIDR 10.96.0.0/16`,
    `${prefix} alloc.go:329] "allocated clusterIPs" service="default/api-service" clusterIPs={"IPv4":"10.96.${randomInt(rng, 40, 200)}.${randomInt(rng, 10, 250)}"}`,
    `${prefix} alloc.go:329] "allocated clusterIPs" service="default/frontend-service" clusterIPs={"IPv4":"10.96.${randomInt(rng, 40, 200)}.${randomInt(rng, 10, 250)}"}`
  ]
  return randomChoice(rng, entries)
}

const generateControlPlaneControllerLog = (
  level: LogLevel,
  time: Date,
  rng: DeterministicRandom
): string => {
  const prefix = formatKubePrefix(level, time)
  const errorEntries = [
    `${prefix} resource_quota_controller.go:460] "Error during resource discovery" err="failed to discover resources: the server has asked for the client to provide credentials" logger="UnhandledError"`,
    `${prefix} garbagecollector.go:794] "failed to discover preferred resources" error="the server has asked for the client to provide credentials"`
  ]
  const infoEntries = [
    `${prefix} topologycache.go:237] "Can't get CPU or zone information for node" node="conformance-worker"`,
    `${prefix} namespace_controller.go:187] "Namespace has been deleted" namespace="my-team"`,
    `${prefix} cleaner.go:189] "Cleaning CSR as it is more than approvedExpiration duration old and approved." csr="csr-${randomChoice(rng, ['ab1cd', 'xy9zt', 'k2dh9'])}" approvedExpiration="1h0m0s"`
  ]
  if (level === 'ERROR') {
    return randomChoice(rng, errorEntries)
  }
  return randomChoice(rng, infoEntries)
}

const generateNginxLog = (
  _level: LogLevel,
  time: Date,
  index: number,
  _rng: DeterministicRandom
): string => {
  const ts = formatNginxTimestamp(time)
  const startup = [
    '/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration',
    '/docker-entrypoint.sh: Looking for shell scripts in /docker-entrypoint.d/',
    '/docker-entrypoint.sh: Launching /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh',
    '10-listen-on-ipv6-by-default.sh: info: Getting the checksum of /etc/nginx/conf.d/default.conf',
    '10-listen-on-ipv6-by-default.sh: info: Enabled listen on IPv6 in /etc/nginx/conf.d/default.conf',
    '/docker-entrypoint.sh: Sourcing /docker-entrypoint.d/15-local-resolvers.envsh',
    '/docker-entrypoint.sh: Launching /docker-entrypoint.d/20-envsubst-on-templates.sh',
    '/docker-entrypoint.sh: Launching /docker-entrypoint.d/30-tune-worker-processes.sh',
    '/docker-entrypoint.sh: Configuration complete; ready for start up'
  ]
  if (index < startup.length) {
    return startup[index]
  }
  if (index < startup.length + 8) {
    const startupNotice = [
      'using the "epoll" event method',
      'nginx/1.25.5',
      'built by gcc 12.2.0 (Debian 12.2.0-14)',
      'OS: Linux 6.18.9-200.fc43.x86_64',
      'getrlimit(RLIMIT_NOFILE): 2147483584:2147483584',
      'start worker processes'
    ]
    const startupNoticeIndex = index - startup.length
    if (startupNoticeIndex < startupNotice.length) {
      return `${ts} [notice] 1#1: ${startupNotice[startupNoticeIndex]}`
    }
    return `${ts} [notice] 1#1: start worker process ${36 + startupNoticeIndex}`
  }
  const runtimeNotice = [
    'signal 17 (SIGCHLD) received from 55',
    'worker process 55 exited with code 0',
    'start worker process 60',
    'worker process 60 exited with code 0',
    'start worker process 61'
  ]
  const runtimeIndex = (index - (startup.length + 8)) % runtimeNotice.length
  return `${ts} [notice] 1#1: ${runtimeNotice[runtimeIndex]}`
}

const generateRedisLog = (
  level: LogLevel,
  time: Date,
  index: number,
  rng: DeterministicRandom
): string => {
  const ts = formatIsoTimestamp(time)
  if (index < 3) {
    const startup = [
      'Redis server started, Redis version 6.2.6',
      'Server initialized',
      'Ready to accept connections on port 6379'
    ]
    return `${ts} INFO ${startup[index]}`
  }
  const infoMessages = [
    'Accepted connection from 127.0.0.1:6379',
    'Background saving started by pid 42',
    'Background saving terminated with success',
    'RDB: 0 MB of memory used by copy-on-write',
    `DB 0: ${randomInt(rng, 5, 100)} keys, ${randomInt(rng, 0, 3)} expires`
  ]
  if (level === 'WARN') {
    return `${ts} WARN Slow query detected: GET key took ${randomInt(rng, 90, 220)}ms`
  }
  if (level === 'ERROR') {
    return `${ts} ERROR Connection timeout from client 192.168.1.50:45678`
  }
  return `${ts} ${level} ${randomChoice(rng, infoMessages)}`
}

const generateMysqlLog = (
  level: LogLevel,
  time: Date,
  index: number,
  rng: DeterministicRandom
): string => {
  const ts = formatIsoTimestamp(time)
  if (index < 3) {
    const startup = [
      'mysqld: ready for connections. Version: 8.0.27  port: 3306',
      `InnoDB: Buffer pool(s) load completed at ${ts}`,
      'MySQL Community Server - GPL initialized'
    ]
    return `${ts} INFO ${startup[index]}`
  }
  if (level === 'WARN') {
    return `${ts} WARN Query took longer than long_query_time: ${randomInt(rng, 2, 4)}.${randomInt(rng, 1, 9)}s`
  }
  if (level === 'ERROR') {
    return `${ts} ERROR Access denied for user 'app'@'192.168.1.50'`
  }
  const entries = [
    'Connection received from 192.168.1.100:3306',
    'Query: SELECT * FROM users WHERE id = 42',
    'Binary log rotated',
    'Temporary table created for query'
  ]
  return `${ts} ${level} ${randomChoice(rng, entries)}`
}

const generatePostgresLog = (
  level: LogLevel,
  time: Date,
  index: number,
  rng: DeterministicRandom
): string => {
  const ts = formatIsoTimestamp(time)
  if (index < 3) {
    const startup = [
      'database system is ready to accept connections',
      'PostgreSQL 13.4 on x86_64-pc-linux-gnu, compiled by gcc',
      'listening on IPv4 address "0.0.0.0", port 5432'
    ]
    return `${ts} INFO ${startup[index]}`
  }
  if (level === 'WARN') {
    return `${ts} WARN could not receive data from client: Connection reset by peer`
  }
  if (level === 'ERROR') {
    return `${ts} ERROR role "admin" does not exist`
  }
  const entries = [
    'statement: SELECT version();',
    'checkpoint starting: time',
    'checkpoint complete: wrote 123 buffers',
    'autovacuum: processing database "postgres"',
    `duration: 0.${randomInt(rng, 1, 999)} ms`
  ]
  return `${ts} ${level} ${randomChoice(rng, entries)}`
}

const generateGenericLog = (
  level: LogLevel,
  time: Date,
  index: number,
  rng: DeterministicRandom
): string => {
  const ts = formatIsoTimestamp(time)
  if (index < 3) {
    const startup = [
      'Application starting...',
      'Initialization complete',
      'Server ready on port 8080'
    ]
    return `${ts} INFO ${startup[index]}`
  }
  if (level === 'WARN') {
    return `${ts} WARN Retry attempt ${randomInt(rng, 1, 3)}/3 for external API call`
  }
  if (level === 'ERROR') {
    return `${ts} ERROR Failed to connect to external service: timeout`
  }
  const messages = [
    'Processing request',
    'Database connection established',
    'Cache hit for key: user:123',
    'Background job completed successfully',
    'Health check passed',
    'Metrics updated',
    `Request handled in ${randomInt(rng, 20, 120)}ms`,
    'Connected to message queue'
  ]
  return `${ts} ${level} ${randomChoice(rng, messages)}`
}

const generateLogLine = (
  profile: WorkloadProfile,
  level: LogLevel,
  time: Date,
  index: number,
  rng: DeterministicRandom
): string => {
  if (profile === 'control-plane-scheduler') {
    return generateControlPlaneSchedulerLog(level, time, rng)
  }
  if (profile === 'control-plane-apiserver') {
    return generateControlPlaneApiserverLog(level, time, rng)
  }
  if (profile === 'control-plane-controller') {
    return generateControlPlaneControllerLog(level, time, rng)
  }
  if (profile === 'nginx') {
    return generateNginxLog(level, time, index, rng)
  }
  if (profile === 'redis') {
    return generateRedisLog(level, time, index, rng)
  }
  if (profile === 'mysql') {
    return generateMysqlLog(level, time, index, rng)
  }
  if (profile === 'postgres') {
    return generatePostgresLog(level, time, index, rng)
  }
  return generateGenericLog(level, time, index, rng)
}

const resolveBaseTime = (seed: string): Date => {
  const seedOffsetSeconds = stringHash(seed) % 10800
  return new Date(BASE_TIME_EPOCH - seedOffsetSeconds * 1000)
}

/**
 * Generate realistic logs for a container based on image/profile context.
 * @param containerImage - Image name (e.g., "nginx:latest", "redis:6")
 * @param count - Number of log lines to generate (max 200)
 * @param context - Optional pod/container context used for profile + deterministic seed
 * @returns Array of log lines with realistic content
 */
export const generateLogs = (
  containerImage: string,
  count: number,
  context?: LogGenerationContext
): string[] => {
  if (count <= 0) {
    return []
  }
  const actualCount = Math.min(count, MAX_LOGS)
  const seed = [
    containerImage,
    context?.namespace ?? 'default',
    context?.podName ?? 'pod',
    context?.containerName ?? 'container'
  ].join('|')
  const rng = createDeterministicRandom(seed)
  const profile = getProfile(containerImage, context)
  const baseTime = resolveBaseTime(seed)
  const logs: string[] = []

  let currentOffsetSeconds = 0
  for (let index = 0; index < actualCount; index++) {
    currentOffsetSeconds += randomInt(rng, 1, 7)
    const lineTime = new Date(baseTime.getTime() + currentOffsetSeconds * 1000)
    const level = getLogLevel(rng, index, profile)
    logs.push(generateLogLine(profile, level, lineTime, index, rng))
  }

  return logs
}
