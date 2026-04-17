import type { EmulatedEnvironment } from '../../../core/emulatedEnvironment/EmulatedEnvironment'

let lessonEnv: EmulatedEnvironment | null = null
let cachedDestroy: ((env: EmulatedEnvironment) => void) | null = null
let beforeUnloadBound = false

async function teardownGlobalLessonEnv() {
  const globalState = globalThis as {
    __lessonEnv?: EmulatedEnvironment
    __lessonEnvSeed?: string
  }
  if (!globalState.__lessonEnv) {
    lessonEnv = null
    return
  }
  const env = globalState.__lessonEnv
  delete globalState.__lessonEnv
  delete globalState.__lessonEnvSeed
  lessonEnv = null

  if (cachedDestroy) {
    cachedDestroy(env)
    return
  }
  const mod = await import('../../../components/lesson/lessonEmulatedEnvironment')
  cachedDestroy = mod.destroyEmulatedEnvironment
  mod.destroyEmulatedEnvironment(env)
}

function isTerminalInteractiveFromDom(): boolean {
  const root = document.querySelector('.lesson-layout-root')
  if (!root) {
    return true
  }
  return root.getAttribute('data-terminal-interactive') !== 'false'
}

async function setupLessonEnv() {
  const root = document.querySelector('.lesson-layout-root')
  if (!root) {
    return
  }
  const seedName = root.getAttribute('data-seed-name') ?? 'minimal'
  const globalState = globalThis as {
    __lessonEnv?: EmulatedEnvironment
    __lessonEnvSeed?: string
  }

  if (globalState.__lessonEnv && globalState.__lessonEnvSeed === seedName) {
    lessonEnv = globalState.__lessonEnv
  } else {
    if (globalState.__lessonEnv) {
      await teardownGlobalLessonEnv()
    }
    const mod = await import('../../../components/lesson/lessonEmulatedEnvironment')
    cachedDestroy = mod.destroyEmulatedEnvironment
    lessonEnv = mod.createLessonEmulatedEnvironment(seedName)
    globalState.__lessonEnv = lessonEnv
    globalState.__lessonEnvSeed = seedName
  }

  if (!lessonEnv) {
    return
  }

  document.dispatchEvent(
    new CustomEvent('cluster-env-ready', {
      detail: { env: lessonEnv }
    })
  )
  document.dispatchEvent(
    new CustomEvent('lesson-env-ready', {
      detail: { env: lessonEnv }
    })
  )
}

async function cleanupLessonEnv() {
  await teardownGlobalLessonEnv()
}

export async function initLessonEmulation() {
  if (!isTerminalInteractiveFromDom()) {
    await teardownGlobalLessonEnv()
    return
  }
  await setupLessonEnv()
}

export function reloadLessonEmulation() {
  if (!isTerminalInteractiveFromDom()) {
    return
  }
  void cleanupLessonEnv().then(() => {
    void setupLessonEnv()
  })
}

export function setupBeforeUnloadCleanup() {
  if (beforeUnloadBound) {
    return
  }
  beforeUnloadBound = true

  // Keep shared env alive across page transitions for persistent lesson terminal.
  window.addEventListener('beforeunload', () => {
    if (!cachedDestroy) {
      return
    }

    const globalState = globalThis as { __lessonEnv?: EmulatedEnvironment }
    const env = globalState.__lessonEnv
    if (env) {
      cachedDestroy(env)
      delete globalState.__lessonEnv
    }
    const seedState = globalThis as { __lessonEnvSeed?: string }
    delete seedState.__lessonEnvSeed
    lessonEnv = null
  })
}
