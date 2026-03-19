interface ContainerProcessIdentity {
  nodeName: string
  namespace: string
  podName: string
  containerName: string
}

type ContainerProcessState = 'Running' | 'Exited'
type ProcessSignal = 'SIGTERM' | 'SIGKILL'
type ProcessLaunchMode = 'long-running' | 'finite-sleep' | 'immediate-exit'
const SHORT_TERMINATION_DELAY_RANGE_MS = {
  min: 1000,
  max: 2000
} as const
const SHORT_SLEEP_THRESHOLD_SECONDS = 5

export interface ContainerProcessRecord extends ContainerProcessIdentity {
  processId: string
  argv: string[]
  state: ContainerProcessState
  launchMode: ProcessLaunchMode
  startedAt: string
  finishedAt?: string
  exitCode?: number
  reason?: string
  plannedExitAtMs?: number
}

export interface EnsureContainerProcessInput extends ContainerProcessIdentity {
  command?: string[]
  args?: string[]
}

export interface ProcessSignalInput extends ContainerProcessIdentity {
  signal: ProcessSignal
}

const buildProcessKey = (identity: ContainerProcessIdentity): string => {
  return `${identity.nodeName}|${identity.namespace}|${identity.podName}|${identity.containerName}`
}

const normalizeArgv = (
  command: string[] | undefined,
  args: string[] | undefined
): string[] => {
  if (command != null && command.length > 0) {
    return [...command]
  }
  if (args != null && args.length > 0) {
    return [...args]
  }
  return []
}

const parseShellExitCode = (argv: string[]): number | undefined => {
  if (argv.length < 3) {
    return undefined
  }
  const executable = argv[0]
  if (executable !== 'sh' && executable !== '/bin/sh') {
    return undefined
  }
  if (argv[1] !== '-c') {
    return undefined
  }
  const script = argv.slice(2).join(' ').trim()
  const match = script.match(/^exit\s+(-?\d+)\s*$/)
  if (match == null) {
    return undefined
  }
  const parsed = Number.parseInt(match[1], 10)
  if (Number.isNaN(parsed)) {
    return undefined
  }
  return parsed
}

const parseSleepSeconds = (argv: string[]): number | undefined => {
  if (argv.length < 2) {
    return undefined
  }
  const executable = argv[0]
  if (executable !== 'sleep' && executable !== '/bin/sleep') {
    return undefined
  }
  const value = argv[1]
  if (value === 'infinity') {
    return Number.POSITIVE_INFINITY
  }
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined
  }
  return parsed
}

const createProcessId = (identity: ContainerProcessIdentity): string => {
  const raw = `${identity.nodeName}/${identity.namespace}/${identity.podName}/${identity.containerName}`
  let hash = 0
  for (let index = 0; index < raw.length; index++) {
    hash = (hash << 5) - hash + raw.charCodeAt(index)
    hash |= 0
  }
  const digest = (hash >>> 0).toString(16).padStart(8, '0')
  return `proc://${digest}`
}

const buildProcessRecord = (
  input: EnsureContainerProcessInput,
  startedAt: string
): ContainerProcessRecord => {
  const argv = normalizeArgv(input.command, input.args)
  const shellExitCode = parseShellExitCode(argv)
  if (shellExitCode != null) {
    return {
      ...input,
      processId: createProcessId(input),
      argv,
      state: 'Exited',
      launchMode: 'immediate-exit',
      startedAt,
      finishedAt: startedAt,
      exitCode: shellExitCode,
      reason: shellExitCode === 0 ? 'Completed' : 'Error'
    }
  }
  const sleepSeconds = parseSleepSeconds(argv)
  if (sleepSeconds != null) {
    if (!Number.isFinite(sleepSeconds)) {
      return {
        ...input,
        processId: createProcessId(input),
        argv,
        state: 'Running',
        launchMode: 'long-running',
        startedAt
      }
    }
    return {
      ...input,
      processId: createProcessId(input),
      argv,
      state: 'Running',
      launchMode: 'finite-sleep',
      startedAt,
      plannedExitAtMs: Date.parse(startedAt) + sleepSeconds * 1000
    }
  }
  return {
    ...input,
    processId: createProcessId(input),
    argv,
    state: 'Running',
    launchMode: 'long-running',
    startedAt
  }
}

const maybeAutoCompleteFiniteSleep = (
  record: ContainerProcessRecord,
  nowMs: number
): ContainerProcessRecord => {
  if (record.state !== 'Running') {
    return record
  }
  if (record.launchMode !== 'finite-sleep') {
    return record
  }
  const plannedExitAtMs = record.plannedExitAtMs
  if (plannedExitAtMs == null || nowMs < plannedExitAtMs) {
    return record
  }
  return {
    ...record,
    state: 'Exited',
    exitCode: 0,
    reason: 'Completed',
    finishedAt: new Date(nowMs).toISOString()
  }
}

const randomIntInRange = (minInclusive: number, maxInclusive: number): number => {
  const normalizedMin = Math.floor(minInclusive)
  const normalizedMax = Math.floor(maxInclusive)
  if (normalizedMax <= normalizedMin) {
    return normalizedMin
  }
  const randomValue = Math.random()
  return normalizedMin + Math.floor(randomValue * (normalizedMax - normalizedMin + 1))
}

const applyTermSignal = (
  current: ContainerProcessRecord,
  nowMs: number
): ContainerProcessRecord => {
  if (current.launchMode === 'immediate-exit') {
    return current
  }

  if (current.launchMode === 'finite-sleep') {
    const plannedExitAtMs = current.plannedExitAtMs
    if (plannedExitAtMs == null) {
      return current
    }
    const remainingMs = plannedExitAtMs - nowMs
    const shortThresholdMs = SHORT_SLEEP_THRESHOLD_SECONDS * 1000
    if (remainingMs <= shortThresholdMs) {
      const shutdownDelayMs = randomIntInRange(
        SHORT_TERMINATION_DELAY_RANGE_MS.min,
        SHORT_TERMINATION_DELAY_RANGE_MS.max
      )
      return {
        ...current,
        plannedExitAtMs: Math.min(plannedExitAtMs, nowMs + shutdownDelayMs)
      }
    }
    return current
  }

  return current
}

export interface ContainerProcessRuntime {
  ensureMainProcess: (input: EnsureContainerProcessInput) => ContainerProcessRecord
  getMainProcess: (
    identity: ContainerProcessIdentity
  ) => ContainerProcessRecord | undefined
  listProcesses: (filter?: Partial<ContainerProcessIdentity>) => ContainerProcessRecord[]
  signalMainProcess: (
    input: ProcessSignalInput
  ) => ContainerProcessRecord | undefined
  clearPodProcesses: (input: {
    nodeName: string
    namespace: string
    podName: string
  }) => void
}

export const createContainerProcessRuntime = (): ContainerProcessRuntime => {
  const recordsByKey = new Map<string, ContainerProcessRecord>()

  const readRecord = (key: string): ContainerProcessRecord | undefined => {
    const current = recordsByKey.get(key)
    if (current == null) {
      return undefined
    }
    const updated = maybeAutoCompleteFiniteSleep(current, Date.now())
    if (updated !== current) {
      recordsByKey.set(key, updated)
    }
    return updated
  }

  return {
    ensureMainProcess: (input) => {
      const key = buildProcessKey(input)
      const existing = readRecord(key)
      if (existing != null) {
        return existing
      }
      const created = buildProcessRecord(input, new Date().toISOString())
      recordsByKey.set(key, created)
      return created
    },
    getMainProcess: (identity) => {
      const key = buildProcessKey(identity)
      return readRecord(key)
    },
    listProcesses: (filter) => {
      const records: ContainerProcessRecord[] = []
      for (const key of recordsByKey.keys()) {
        const record = readRecord(key)
        if (record == null) {
          continue
        }
        if (filter?.nodeName != null && record.nodeName !== filter.nodeName) {
          continue
        }
        if (filter?.namespace != null && record.namespace !== filter.namespace) {
          continue
        }
        if (filter?.podName != null && record.podName !== filter.podName) {
          continue
        }
        if (
          filter?.containerName != null &&
          record.containerName !== filter.containerName
        ) {
          continue
        }
        records.push(record)
      }
      return records
    },
    signalMainProcess: (input) => {
      const key = buildProcessKey(input)
      const current = readRecord(key)
      if (current == null) {
        return undefined
      }
      if (current.state !== 'Running') {
        return current
      }
      const isKill = input.signal === 'SIGKILL'
      const nowMs = Date.now()
      const now = new Date(nowMs).toISOString()
      if (!isKill) {
        const nextRecord = applyTermSignal(current, nowMs)
        recordsByKey.set(key, nextRecord)
        return nextRecord
      }
      const nextRecord: ContainerProcessRecord = {
        ...current,
        state: 'Exited',
        exitCode: isKill ? 137 : 143,
        reason: isKill ? 'Killed' : 'Terminated',
        finishedAt: now
      }
      recordsByKey.set(key, nextRecord)
      return nextRecord
    },
    clearPodProcesses: (input) => {
      const prefix = `${input.nodeName}|${input.namespace}|${input.podName}|`
      for (const key of recordsByKey.keys()) {
        if (!key.startsWith(prefix)) {
          continue
        }
        recordsByKey.delete(key)
      }
    }
  }
}
