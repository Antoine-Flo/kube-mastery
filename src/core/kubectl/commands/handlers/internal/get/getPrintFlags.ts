/**
 * Maps resolved `kubectl get -o` to a print pipeline, mirroring the intent of
 * PrintFlags.ToPrinter() in refs/k8s/kubectl/pkg/cmd/get/get_flags.go.
 *
 * Upstream ToPrinter resolution order (exact, get_flags.go):
 * 1. TemplateFlags (go-template / templatefile / implicit template arg)
 * 2. JSONYamlPrintFlags
 * 3. HumanReadableFlags
 * 4. CustomColumnsFlags
 * 5. NamePrintFlags
 *
 * This simulation groups json, yaml, and jsonpath into one structured sink
 * (renderStructuredPayload) and does not yet mirror template-first dispatch;
 * keep this in mind when adding go-template parity or reordering entrypoint logic.
 *
 * handleGet / handleGetAll route non-structured sinks as: table (human) then
 * custom-columns then name, matching the relative order after JSON/YAML in ToPrinter.
 *
 * Table and wide use the human-readable table path (tableRendering).
 */
import type { OutputDirective, OutputKind } from '../../../output/outputHelpers'

export type GetPrintSink =
  | 'structured'
  | 'name'
  | 'custom-columns'
  | 'table'

/** Values accepted by validateOutputDirective for plain get (not go-template in sim). */
export const GET_ALLOWED_OUTPUT_KINDS: readonly OutputKind[] = [
  'table',
  'json',
  'yaml',
  'wide',
  'name',
  'jsonpath',
  'custom-columns'
]

export const GET_OUTPUT_VALIDATION_ERROR_MESSAGE =
  '--output must be one of: json|yaml|wide|name|jsonpath|custom-columns'

export const resolveGetPrintSink = (
  directive: OutputDirective
): GetPrintSink => {
  if (
    directive.kind === 'json' ||
    directive.kind === 'yaml' ||
    directive.kind === 'jsonpath'
  ) {
    return 'structured'
  }
  if (directive.kind === 'name') {
    return 'name'
  }
  if (directive.kind === 'custom-columns') {
    return 'custom-columns'
  }
  return 'table'
}

export const isStructuredGetPrintSink = (sink: GetPrintSink): boolean => {
  return sink === 'structured'
}
