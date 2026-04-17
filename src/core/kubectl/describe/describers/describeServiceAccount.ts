import type { ServiceAccount } from '../../../cluster/ressources/ServiceAccount'
import { tabbedStringSync } from '../../printers/describeTabWriter'
import { createStringPrefixWriter } from '../prefixWriter'
import { formatLabels } from '../internal/helpers'

const formatNameRefs = (refs: Array<{ name: string }> | undefined): string => {
  if (refs == null || refs.length === 0) {
    return '<none>'
  }
  return refs
    .map((entry) => {
      return entry.name
    })
    .join(', ')
}

export const describeServiceAccount = (
  serviceAccount: ServiceAccount
): string => {
  const out = createStringPrefixWriter()
  out.write(0, 'Name:                %s\n', serviceAccount.metadata.name)
  out.write(0, 'Namespace:           %s\n', serviceAccount.metadata.namespace)
  out.write(0, 'Labels:              %s\n', formatLabels(serviceAccount.metadata.labels))
  out.write(
    0,
    'Annotations:         %s\n',
    formatLabels(serviceAccount.metadata.annotations)
  )
  out.write(
    0,
    'Image pull secrets:  %s\n',
    formatNameRefs(serviceAccount.imagePullSecrets)
  )
  out.write(0, 'Events:              <none>\n')
  return tabbedStringSync((sink) => {
    sink.write(out.toString())
  })
}
