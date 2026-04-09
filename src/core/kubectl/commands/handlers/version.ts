import type { ParsedCommand } from '../types'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import {
  buildSimulatedVersionPayload,
  formatVersionJson,
  formatVersionSimpleText,
  formatVersionYaml
} from '../output/versionOutput'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL VERSION HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Output formatting lives in ../output/versionOutput.ts (see refs/k8s/kubectl/pkg/cmd/version).

/**
 * Handle kubectl version command
 * Supports:
 * - kubectl version (client + kustomize + server)
 * - kubectl version --client (client + kustomize only)
 * - kubectl version --output json (JSON format)
 * - kubectl version --output yaml (YAML format)
 */
export const handleVersion = (parsed: ParsedCommand): Result<string> => {
  const explicitOutput = parsed.flags.output || parsed.flags['o']
  const outputFormat = explicitOutput
    ? (explicitOutput as string)
    : parsed.output

  if (
    parsed.output &&
    parsed.output !== 'table' &&
    parsed.output !== 'yaml' &&
    parsed.output !== 'json'
  ) {
    return error(`--output must be 'yaml' or 'json'`)
  }
  if (
    explicitOutput &&
    explicitOutput !== 'yaml' &&
    explicitOutput !== 'json'
  ) {
    return error(`--output must be 'yaml' or 'json'`)
  }

  const clientFlag = parsed.flags.client ?? parsed.flags['client']
  const clientOnly = typeof clientFlag === 'boolean' && clientFlag === true

  const version = buildSimulatedVersionPayload({ clientOnly: clientOnly })

  if (outputFormat === 'json') {
    return success(formatVersionJson(version))
  }

  if (outputFormat === 'yaml') {
    return success(formatVersionYaml(version))
  }

  return success(formatVersionSimpleText(version))
}
