interface ClusterConfigShape {
  conformanceClusterName: string
}

export interface CliOptions {
  commands: string[]
  contextName: string
  timeoutMs: number
  resetKindBeforeRun: boolean
  verbose: boolean
}

export const createDefaultCliOptions = (
  clusterConfig: ClusterConfigShape
): CliOptions => {
  return {
    commands: [],
    contextName: `kind-${clusterConfig.conformanceClusterName}`,
    timeoutMs: 60000,
    resetKindBeforeRun: true,
    verbose: false
  }
}

export const parseCliArgs = (
  argv: string[],
  clusterConfig: ClusterConfigShape
): CliOptions => {
  const options = createDefaultCliOptions(clusterConfig)

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--cmd' && index + 1 < argv.length) {
      options.commands.push(argv[index + 1])
      index += 1
      continue
    }
    if (arg.startsWith('--cmd=')) {
      options.commands.push(arg.slice('--cmd='.length))
      continue
    }
    if (arg === '--context' && index + 1 < argv.length) {
      options.contextName = argv[index + 1]
      index += 1
      continue
    }
    if (arg.startsWith('--context=')) {
      options.contextName = arg.slice('--context='.length)
      continue
    }
    if (arg === '--timeout-ms' && index + 1 < argv.length) {
      options.timeoutMs = Number.parseInt(argv[index + 1], 10)
      index += 1
      continue
    }
    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number.parseInt(arg.slice('--timeout-ms='.length), 10)
      continue
    }
    if (arg === '--no-reset-kind') {
      options.resetKindBeforeRun = false
      continue
    }
    if (arg === '--verbose') {
      options.verbose = true
      continue
    }
  }

  return options
}

export const getParityUsageText = (): string => {
  return 'Usage: npm run parity:manual -- --cmd "kubectl get pods" [--cmd "..."] [--context kind-kind]'
}

export const printParityHeader = (
  sessionId: string,
  contextName: string,
  verbose: boolean
): void => {
  console.log(`Simulation session: ${sessionId}`)
  console.log(`Kind context: ${contextName}`)
  console.log(`Output mode: ${verbose ? 'verbose' : 'compact'}`)
}

export const printParityCommandBanner = (command: string): void => {
  console.log('\n==================================================')
  console.log(`command: ${command}`)
}

export const printParityResultLine = (
  note: string,
  simulationExitCode: number,
  kindExitCode: number
): void => {
  console.log(`[result] ${note} | sim=${simulationExitCode} kind=${kindExitCode}`)
}

export const printResultPayload = (
  label: 'simulation' | 'kind',
  payload: { command: string; exitCode: number; stdout: string; stderr: string }
): void => {
  console.log(`\n[${label}]`)
  console.log(`command: ${payload.command}`)
  console.log(`exitCode: ${payload.exitCode}`)
  console.log('stdout:')
  console.log(payload.stdout.length > 0 ? payload.stdout : '(empty)')
  console.log('stderr:')
  console.log(payload.stderr.length > 0 ? payload.stderr : '(empty)')
}

export const printParitySummaryLine = (
  matchedCount: number,
  kubectlRuntimeTotal: number,
  supportShellTotal: number,
  reportPath: string
): void => {
  console.log('\n==================================================')
  console.log(
    `[summary] matched ${matchedCount}/${kubectlRuntimeTotal} kubectl-runtime commands, support-shell excluded: ${supportShellTotal}, report: ${reportPath}`
  )
}
