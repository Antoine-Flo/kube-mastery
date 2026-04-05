#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createKindCommandRunner } from '../lib/parity/kind-command-runner'
import { createSimulationSessionManager } from '../lib/parity/simulation-session-manager'
import {
  ensureCluster,
  ensureCurrentContextNamespace,
  resetConformanceClusterState
} from '../lib/cluster-manager'
import { CONFIG } from '../../src/config'

interface CliOptions {
  commands: string[]
  contextName: string
  timeoutMs: number
  resetKindBeforeRun: boolean
  verbose: boolean
}

const parseCliArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    commands: [],
    contextName: `kind-${CONFIG.cluster.conformanceClusterName}`,
    timeoutMs: 60000,
    resetKindBeforeRun: true,
    verbose: false
  }

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

const printResult = (
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

const normalizeForMatch = (value: string): string => {
  const lines = value
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
  return lines.join('\n')
}

const stripDynamicAgeValues = (value: string): string => {
  return value.replace(/\b\d+[smhdwy]\b/g, '<age>')
}

const normalizeDigStdout = (value: string): string => {
  return value
    .replace(/id:\s+\d+/g, 'id: <id>')
    .replace(/IN A\t\d+\.\d+\.\d+\.\d+/g, 'IN A\t<cluster-ip>')
    .replace(/;; WHEN:\s+.*/g, ';; WHEN: <timestamp>')
}

const normalizeConfigMapYaml = (value: string): string => {
  return value
    .replace(
      /creationTimestamp:\s*["']?.*["']?/g,
      'creationTimestamp: <timestamp>'
    )
    .replace(
      /resourceVersion:\s*["']?.*["']?/g,
      'resourceVersion: <resource-version>'
    )
    .replace(/uid:\s*["']?.*["']?/g, 'uid: <uid>')
}

const collapseBlankLines = (value: string): string => {
  return value.replace(/\n{3,}/g, '\n\n')
}

const normalizeNslookupStdout = (value: string): string => {
  const normalizedIp = value.replace(
    /Address:\s+10\.\d+\.\d+\.\d+/g,
    'Address: <cluster-ip>'
  )
  const lines = collapseBlankLines(normalizedIp)
    .split('\n')
    .map((line) => line.trimEnd())
  const nxDomainLines = lines.filter((line) => line.includes('NXDOMAIN')).sort()
  const regularLines = lines.filter((line) => !line.includes('NXDOMAIN'))
  return [...regularLines, ...nxDomainLines].join('\n')
}

const normalizeCoreDnsConfigMapForParity = (value: string): string => {
  const lines = value.split('\n')
  const corefileStart = lines.findIndex((line) => {
    return line.trimStart().startsWith('Corefile:')
  })
  if (corefileStart === -1) {
    return normalizeConfigMapYaml(value)
  }
  const corefileBody: string[] = []
  for (let index = corefileStart + 1; index < lines.length; index++) {
    const line = lines[index]
    if (line.startsWith('    ')) {
      corefileBody.push(line.slice(4))
      continue
    }
    break
  }
  return corefileBody.join('\n').trim()
}

const normalizeCoreDnsPodsTableForParity = (value: string): string => {
  const lines = value.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length === 0) {
    return value
  }
  const normalizedRows = lines.slice(1).map((line) => {
    const columns = line.split(/\s{2,}/).filter((column) => column.length > 0)
    if (columns.length < 4) {
      return line
    }
    const [rawName, ready, status] = columns
    const name = rawName.startsWith('coredns-') ? 'coredns-<pod>' : rawName
    const age = columns[columns.length - 1]
    return [name, ready, status, age].join('|')
  })
  return normalizedRows.sort().join('\n')
}

const normalizeTopPodNameForParity = (value: string): string | null => {
  if (value.startsWith('metrics-server-')) {
    return null
  }
  const statefulPrefixes = [
    'coredns-',
    'kindnet-',
    'kube-proxy-',
    'local-path-provisioner-'
  ]
  for (const prefix of statefulPrefixes) {
    if (value.startsWith(prefix)) {
      return `${prefix}<pod>`
    }
  }
  return value
}

const normalizeTopTableForParity = (command: string, value: string): string => {
  const lines = value.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length === 0) {
    return value
  }
  const isNodesTop = command.trim() === 'kubectl top nodes'
  const isPodsTop = command.trim().startsWith('kubectl top pods')
  if (!isNodesTop && !isPodsTop) {
    return value
  }

  const normalizedRows: string[] = []
  for (const line of lines.slice(1)) {
    const columns = line.split(/\s{2,}/).filter((column) => column.length > 0)
    if (isNodesTop) {
      if (columns.length < 5) {
        continue
      }
      const name = columns[0]
      normalizedRows.push([name, '<cpu>', '<cpuPercent>', '<mem>', '<memPercent>'].join('|'))
      continue
    }

    if (columns.length < 3) {
      continue
    }
    if (columns.length >= 4) {
      const namespace = columns[0]
      const podName = normalizeTopPodNameForParity(columns[1])
      if (podName == null) {
        continue
      }
      normalizedRows.push([namespace, podName, '<cpu>', '<mem>'].join('|'))
      continue
    }
    const podName = normalizeTopPodNameForParity(columns[0])
    if (podName == null) {
      continue
    }
    normalizedRows.push([podName, '<cpu>', '<mem>'].join('|'))
  }

  return normalizedRows.sort().join('\n')
}

const normalizeTopNoResourcesMessageForParity = (
  command: string,
  value: string
): string => {
  if (!command.trim().startsWith('kubectl top ')) {
    return value
  }
  const trimmed = value.trim()
  if (
    trimmed === 'No resources found' ||
    /^No resources found in .+ namespace\.$/.test(trimmed)
  ) {
    return ''
  }
  return value
}

const normalizeCommandStdoutForParity = (
  command: string,
  stdout: string
): string => {
  if (command === 'kubectl get pods -n kube-system -l k8s-app=kube-dns') {
    return normalizeCoreDnsPodsTableForParity(stdout)
  }
  if (command.includes('kubectl run ') && command.includes(' -- nslookup ')) {
    return normalizeNslookupStdout(stdout)
  }
  if (command.includes('kubectl run ') && command.includes(' -- dig ')) {
    return normalizeDigStdout(stdout)
  }
  if (
    command === 'kubectl get configmap coredns -n kube-system -o yaml' ||
    command === 'kubectl get configmap coredns -n kube-system -o yaml '
  ) {
    return normalizeCoreDnsConfigMapForParity(normalizeConfigMapYaml(stdout))
  }
  if (command.trim().startsWith('kubectl top ')) {
    return normalizeTopNoResourcesMessageForParity(
      command,
      normalizeTopTableForParity(command, stdout)
    )
  }
  return stdout
}

const normalizeCommandStderrForParity = (
  command: string,
  stderr: string
): string => {
  if (command.trim().startsWith('kubectl top ')) {
    return normalizeTopNoResourcesMessageForParity(command, stderr)
  }
  const isAttachedRunCommand =
    command.includes('kubectl run ') &&
    command.includes('--rm') &&
    command.includes('-it')
  if (!isAttachedRunCommand) {
    return stderr
  }
  const ignoredPrefixes = [
    'Unable to use a TTY - input is not a terminal or the right kind of file',
    'All commands and output from this session will be recorded in container logs, including credentials and sensitive information passed through the command prompt.',
    "If you don't see a command prompt, try pressing enter.",
    "warning: couldn't attach to pod/"
  ]
  const keptLines = stderr.split('\n').filter((line) => {
    for (const prefix of ignoredPrefixes) {
      if (line.startsWith(prefix)) {
        return false
      }
    }
    return true
  })
  return keptLines.join('\n')
}

const useKubectlContext = (contextName: string): boolean => {
  try {
    execSync(`kubectl config use-context ${contextName}`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    })
    return true
  } catch {
    return false
  }
}

const main = (): void => {
  const options = parseCliArgs(process.argv.slice(2))
  if (options.commands.length === 0) {
    console.error(
      'Usage: npm run parity:manual -- --cmd "kubectl get pods" [--cmd "..."] [--context kind-kind]'
    )
    process.exit(1)
  }

  const simulationManager = createSimulationSessionManager()
  const session = simulationManager.createSession()
  if (!useKubectlContext(options.contextName)) {
    console.error(
      `Unable to switch kubectl context to "${options.contextName}"`
    )
    process.exit(1)
  }
  if (options.resetKindBeforeRun) {
    const ensureClusterResult = ensureCluster(
      CONFIG.cluster.conformanceClusterName
    )
    if (!ensureClusterResult.ok) {
      console.error(ensureClusterResult.error)
      process.exit(1)
    }
    const ensureNamespaceResult = ensureCurrentContextNamespace('default')
    if (!ensureNamespaceResult.ok) {
      console.error(ensureNamespaceResult.error)
      process.exit(1)
    }
    const resetResult = resetConformanceClusterState()
    if (!resetResult.ok) {
      console.error(resetResult.error)
      process.exit(1)
    }
  }
  const kindRunner = createKindCommandRunner({
    timeoutMs: options.timeoutMs
  })

  console.log(`Simulation session: ${session.id}`)
  console.log(`Kind context: ${options.contextName}`)
  console.log(`Output mode: ${options.verbose ? 'verbose' : 'compact'}`)

  const reportRows: Array<{
    command: string
    simulationExitCode: number
    kindExitCode: number
    outputMatches: boolean
    note: string
    simulationStdout: string
    simulationStderr: string
    kindStdout: string
    kindStderr: string
  }> = []

  let matchedCount = 0

  for (const command of options.commands) {
    console.log('\n==================================================')
    console.log(`command: ${command}`)

    const simulationResult = simulationManager.runCommand(session.id, command)
    const kindResult = kindRunner.run(command)
    const simulationComparable = stripDynamicAgeValues(
      normalizeForMatch(
        normalizeCommandStdoutForParity(command, simulationResult.stdout)
      )
    )
    const kindComparable = stripDynamicAgeValues(
      normalizeForMatch(
        normalizeCommandStdoutForParity(command, kindResult.stdout)
      )
    )
    const sameExitCode = simulationResult.exitCode === kindResult.exitCode
    const sameStdout = simulationComparable === kindComparable
    const sameStderr =
      normalizeForMatch(
        normalizeCommandStderrForParity(command, simulationResult.stderr)
      ) ===
      normalizeForMatch(
        normalizeCommandStderrForParity(command, kindResult.stderr)
      )
    const matched = sameExitCode && sameStdout && sameStderr
    if (matched) {
      matchedCount += 1
    }
    const note = matched
      ? 'match'
      : `diff(exit:${sameExitCode ? 'ok' : 'ko'},stdout:${sameStdout ? 'ok' : 'ko'},stderr:${sameStderr ? 'ok' : 'ko'})`

    console.log(
      `[result] ${note} | sim=${simulationResult.exitCode} kind=${kindResult.exitCode}`
    )

    if (options.verbose || !matched) {
      printResult('simulation', simulationResult)
      printResult('kind', kindResult)
    }

    reportRows.push({
      command,
      simulationExitCode: simulationResult.exitCode,
      kindExitCode: kindResult.exitCode,
      outputMatches: matched,
      note,
      simulationStdout: simulationResult.stdout,
      simulationStderr: simulationResult.stderr,
      kindStdout: kindResult.stdout,
      kindStderr: kindResult.stderr
    })
  }

  const summary = {
    sessionId: session.id,
    contextName: options.contextName,
    totalCommands: reportRows.length,
    matchedCommands: matchedCount,
    mismatchedCommands: reportRows.length - matchedCount,
    rows: reportRows
  }

  mkdirSync(join(process.cwd(), '.tmp'), { recursive: true })
  const reportPath = join(process.cwd(), '.tmp', 'parity-last-report.json')
  writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf-8')

  console.log('\n==================================================')
  console.log(
    `[summary] matched ${matchedCount}/${reportRows.length} commands, report: ${reportPath}`
  )
}

main()
