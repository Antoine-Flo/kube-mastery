import type { KubectlFlagSpec } from '../model'

export const KUBECTL_GLOBAL_FLAGS: readonly KubectlFlagSpec[] = [
  {
    name: 'namespace',
    short: 'n',
    kind: 'string',
    description: 'If present, the namespace scope for this CLI request'
  },
  {
    name: 'all-namespaces',
    short: 'A',
    kind: 'boolean',
    description:
      'If present, list the requested object(s) across all namespaces'
  }
]
