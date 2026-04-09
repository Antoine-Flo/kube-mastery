import type { Secret } from '../../../cluster/ressources/Secret'
import { tabbedStringSync } from '../../printers/describeTabWriter'
import { formatLabels, formatSecretType } from '../internal/helpers'

/**
 * Secret describer: tab-separated metadata keys (refs/k8s/kubectl/pkg/describe/describe.go).
 */
export const describeSecret = (secret: Secret): string => {
  const lines: string[] = []

  lines.push(`Name:\t${secret.metadata.name}`)
  lines.push(`Namespace:\t${secret.metadata.namespace}`)
  lines.push(`Labels:\t${formatLabels(secret.metadata.labels)}`)
  lines.push(`Annotations:\t${formatLabels(secret.metadata.annotations)}`)
  lines.push('')
  lines.push(`Type:\t${formatSecretType(secret.type)}`)
  lines.push('')
  lines.push('Data')
  lines.push('====')

  const dataKeys = Object.keys(secret.data)
  if (dataKeys.length > 0) {
    for (const key of dataKeys) {
      const value = secret.data[key]
      const byteCount = value.length
      lines.push(`${key}:  ${byteCount} bytes`)
    }
  } else {
    lines.push('<no data>')
  }

  lines.push('')
  lines.push('Events:\t<none>')

  return tabbedStringSync((sink) => {
    for (const line of lines) {
      sink.write(`${line}\n`)
    }
  })
}
