type TimeoutKind = 'pending' | 'completion' | 'restart' | 'imagePull'
type AttemptKind = 'restart' | 'imagePull'

export class PodLifecycleTimeoutRegistry {
  private pendingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private completionTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private restartTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private imagePullTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
  private restartAttempts = new Map<string, number>()
  private imagePullAttempts = new Map<string, number>()

  hasTimeout(kind: TimeoutKind, key: string): boolean {
    return this.getTimeoutMap(kind).has(key)
  }

  getTimeout(
    kind: TimeoutKind,
    key: string
  ): ReturnType<typeof setTimeout> | undefined {
    return this.getTimeoutMap(kind).get(key)
  }

  setTimeout(
    kind: TimeoutKind,
    key: string,
    timeoutId: ReturnType<typeof setTimeout>
  ): void {
    this.getTimeoutMap(kind).set(key, timeoutId)
  }

  clearTimeout(kind: TimeoutKind, key: string): void {
    const timeoutMap = this.getTimeoutMap(kind)
    const timeoutId = timeoutMap.get(key)
    if (timeoutId == null) {
      return
    }
    clearTimeout(timeoutId)
    timeoutMap.delete(key)
  }

  deleteTimeout(kind: TimeoutKind, key: string): void {
    this.getTimeoutMap(kind).delete(key)
  }

  getAttempt(kind: AttemptKind, key: string): number | undefined {
    return this.getAttemptMap(kind).get(key)
  }

  setAttempt(kind: AttemptKind, key: string, attempt: number): void {
    this.getAttemptMap(kind).set(key, attempt)
  }

  deleteAttempt(kind: AttemptKind, key: string): void {
    this.getAttemptMap(kind).delete(key)
  }

  clearAll(): void {
    this.clearAllTimeouts()
    this.restartAttempts.clear()
    this.imagePullAttempts.clear()
  }

  private clearAllTimeouts(): void {
    for (const timeoutId of this.pendingTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    for (const timeoutId of this.completionTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    for (const timeoutId of this.restartTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    for (const timeoutId of this.imagePullTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.pendingTimeouts.clear()
    this.completionTimeouts.clear()
    this.restartTimeouts.clear()
    this.imagePullTimeouts.clear()
  }

  private getTimeoutMap(
    kind: TimeoutKind
  ): Map<string, ReturnType<typeof setTimeout>> {
    if (kind === 'pending') {
      return this.pendingTimeouts
    }
    if (kind === 'completion') {
      return this.completionTimeouts
    }
    if (kind === 'restart') {
      return this.restartTimeouts
    }
    return this.imagePullTimeouts
  }

  private getAttemptMap(kind: AttemptKind): Map<string, number> {
    if (kind === 'restart') {
      return this.restartAttempts
    }
    return this.imagePullAttempts
  }
}
