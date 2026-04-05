import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ParityLane } from '../support-shell/surface'

export interface ParityReportRow {
  command: string
  lane: ParityLane
  simulationExitCode: number
  kindExitCode: number
  outputMatches: boolean
  excludedFromParity: boolean
  note: string
  simulationStdout: string
  simulationStderr: string
  kindStdout: string
  kindStderr: string
}

export interface ParitySummaryPayload {
  sessionId: string
  contextName: string
  totalCommands: number
  totalKubectlRuntimeCommands: number
  totalSupportShellCommands: number
  matchedCommands: number
  mismatchedCommands: number
  rows: ParityReportRow[]
}

export const createParitySummaryPayload = (
  sessionId: string,
  contextName: string,
  reportRows: ParityReportRow[],
  matchedCount: number,
  kubectlRuntimeTotal: number,
  supportShellTotal: number
): ParitySummaryPayload => {
  return {
    sessionId,
    contextName,
    totalCommands: reportRows.length,
    totalKubectlRuntimeCommands: kubectlRuntimeTotal,
    totalSupportShellCommands: supportShellTotal,
    matchedCommands: matchedCount,
    mismatchedCommands: kubectlRuntimeTotal - matchedCount,
    rows: reportRows
  }
}

export const writeParitySummaryReport = (
  summary: ParitySummaryPayload
): string => {
  mkdirSync(join(process.cwd(), '.tmp'), { recursive: true })
  const reportPath = join(process.cwd(), '.tmp', 'parity-last-report.json')
  writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf-8')
  return reportPath
}
