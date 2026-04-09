import type { Lease } from '../../../cluster/ressources/Lease'
import { tabbedStringSync } from '../../printers/describeTabWriter'
import { createStringPrefixWriter } from '../prefixWriter'
import { formatDescribeDate, formatLabels } from '../internal/helpers'

/**
 * Lease describer: PrefixWriter for line emission (refs/k8s/kubectl/pkg/describe/describe.go).
 * Tab-aligned blocks may use tabbedStringSync from printers/describeTabWriter where upstream uses tabwriter.
 */
export const describeLease = (lease: Lease): string => {
  const out = createStringPrefixWriter()

  out.write(0, 'Name:         %s\n', lease.metadata.name)
  out.write(0, 'Namespace:    %s\n', lease.metadata.namespace)
  out.write(0, 'Labels:       %s\n', formatLabels(lease.metadata.labels))
  out.write(0, 'Annotations:  %s\n', formatLabels(lease.metadata.annotations))
  out.write(0, 'API Version:  %s\n', lease.apiVersion)
  out.write(0, 'Kind:         %s\n', lease.kind)
  out.write(0, 'Metadata:\n')
  out.write(
    0,
    '  Creation Timestamp:  %s\n',
    formatDescribeDate(lease.metadata.creationTimestamp)
  )

  if (
    lease.metadata.ownerReferences &&
    lease.metadata.ownerReferences.length > 0
  ) {
    out.write(0, '  Owner References:\n')
    for (const ownerRef of lease.metadata.ownerReferences) {
      out.write(0, '    API Version:     %s\n', ownerRef.apiVersion)
      out.write(0, '    Kind:            %s\n', ownerRef.kind)
      out.write(0, '    Name:            %s\n', ownerRef.name)
      out.write(0, '    UID:             %s\n', ownerRef.uid)
    }
  } else {
    out.write(0, '  Owner References:  <none>\n')
  }

  if (lease.metadata.resourceVersion) {
    out.write(0, '  Resource Version:  %s\n', lease.metadata.resourceVersion)
  }
  if (lease.metadata.uid) {
    out.write(0, '  UID:               %s\n', lease.metadata.uid)
  }

  out.write(0, 'Spec:\n')
  if (lease.spec.holderIdentity) {
    out.write(0, '  Holder Identity:         %s\n', lease.spec.holderIdentity)
  } else {
    out.write(0, '  Holder Identity:         <none>\n')
  }
  if (lease.spec.leaseDurationSeconds != null) {
    out.write(
      0,
      '  Lease Duration Seconds:  %s\n',
      lease.spec.leaseDurationSeconds
    )
  }
  if (lease.spec.renewTime) {
    out.write(0, '  Renew Time:              %s\n', lease.spec.renewTime)
  }

  out.write(0, 'Events:                    <none>\n')

  const raw = out.toString()
  return tabbedStringSync((sink) => {
    sink.write(raw)
  })
}
