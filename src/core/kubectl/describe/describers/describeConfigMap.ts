import type { ConfigMap } from '../../../cluster/ressources/ConfigMap'
import { blank } from '../../formatters/describeHelpers'
import { tabbedStringSync } from '../../printers/describeTabWriter'
import { formatLabels } from '../internal/helpers'

export const describeConfigMap = (configMap: ConfigMap): string => {
  const lines: string[] = []

  lines.push(`Name:\t${configMap.metadata.name}`)
  lines.push(`Namespace:\t${configMap.metadata.namespace}`)
  lines.push(`Labels:\t${formatLabels(configMap.metadata.labels)}`)
  lines.push(`Annotations:\t${formatLabels(configMap.metadata.annotations)}`)
  lines.push(blank())

  const dataCount = configMap.data ? Object.keys(configMap.data).length : 0
  const binaryDataCount = configMap.binaryData
    ? Object.keys(configMap.binaryData).length
    : 0

  lines.push('Data')
  lines.push('====')

  if (configMap.data && dataCount > 0) {
    Object.entries(configMap.data).forEach(([key, value]) => {
      lines.push(`${key}:`)
      lines.push('----')
      lines.push(value)
      lines.push('')
    })
  }

  if (configMap.binaryData && binaryDataCount > 0) {
    lines.push('')
    lines.push('BinaryData')
    lines.push('====')
    Object.entries(configMap.binaryData).forEach(([key, value]) => {
      const byteCount = value.length
      lines.push(`${key}: ${byteCount} bytes`)
    })
  }

  if (dataCount === 0 && binaryDataCount === 0) {
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
