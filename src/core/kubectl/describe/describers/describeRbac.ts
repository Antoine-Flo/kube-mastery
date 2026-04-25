import type { ClusterRole } from '../../../cluster/ressources/ClusterRole'
import type { ClusterRoleBinding } from '../../../cluster/ressources/ClusterRoleBinding'
import type { Role } from '../../../cluster/ressources/Role'
import type { RoleBinding } from '../../../cluster/ressources/RoleBinding'
import { tabbedStringSync } from '../../printers/describeTabWriter'
import { createStringPrefixWriter } from '../prefixWriter'
import { formatLabels } from '../internal/helpers'

const formatPolicyRuleRows = (
  rules: Array<{
    apiGroups?: string[]
    verbs: string[]
    resources?: string[]
    resourceNames?: string[]
    nonResourceURLs?: string[]
  }>
): string[] => {
  const formatRuleList = (items: string[] | undefined): string => {
    const values = items ?? []
    if (values.length === 0) {
      return '[]'
    }
    return `[${values.join(' ')}]`
  }
  const combineResourceAndApiGroups = (
    resources: string[] | undefined,
    apiGroups: string[] | undefined
  ): string => {
    const resourceList = resources ?? []
    if (resourceList.length === 0) {
      return '[]'
    }
    const groupList = apiGroups ?? []
    if (groupList.length === 0) {
      return resourceList.join(' ')
    }
    const combined = resourceList.flatMap((resource) => {
      return groupList.map((apiGroup) => {
        if (apiGroup === '') {
          return resource
        }
        return `${resource}.${apiGroup}`
      })
    })
    return combined.join(' ')
  }

  if (rules.length === 0) {
    return ['  []         []                 []              []']
  }
  return rules.map((rule) => {
    const resources = combineResourceAndApiGroups(rule.resources, rule.apiGroups)
    const nonResourceURLs = formatRuleList(rule.nonResourceURLs)
    const resourceNames = formatRuleList(rule.resourceNames)
    const verbs = formatRuleList(rule.verbs)
    return `  ${resources.padEnd(9)}  ${nonResourceURLs.padEnd(17)}  ${resourceNames.padEnd(14)}  ${verbs}`
  })
}

const writeRoleLikeHeader = (
  out: ReturnType<typeof createStringPrefixWriter>,
  name: string,
  labels: Record<string, string> | undefined,
  annotations: Record<string, string> | undefined
): void => {
  out.write(0, 'Name:         %s\n', name)
  out.write(0, 'Labels:       %s\n', formatLabels(labels))
  out.write(0, 'Annotations:  %s\n', formatLabels(annotations))
}

export const describeRole = (role: Role): string => {
  const out = createStringPrefixWriter()
  writeRoleLikeHeader(
    out,
    role.metadata.name,
    role.metadata.labels,
    role.metadata.annotations
  )
  out.write(0, 'PolicyRule:\n')
  out.write(0, '  Resources  Non-Resource URLs  Resource Names  Verbs\n')
  out.write(0, '  ---------  -----------------  --------------  -----\n')
  for (const row of formatPolicyRuleRows(role.rules)) {
    out.write(0, '%s\n', row)
  }
  return tabbedStringSync((sink) => {
    sink.write(out.toString())
  })
}

export const describeClusterRole = (clusterRole: ClusterRole): string => {
  const out = createStringPrefixWriter()
  writeRoleLikeHeader(
    out,
    clusterRole.metadata.name,
    clusterRole.metadata.labels,
    clusterRole.metadata.annotations
  )
  out.write(0, 'PolicyRule:\n')
  out.write(0, '  Resources  Non-Resource URLs  Resource Names  Verbs\n')
  out.write(0, '  ---------  -----------------  --------------  -----\n')
  for (const row of formatPolicyRuleRows(clusterRole.rules)) {
    out.write(0, '%s\n', row)
  }
  return tabbedStringSync((sink) => {
    sink.write(out.toString())
  })
}

export const describeRoleBinding = (roleBinding: RoleBinding): string => {
  const out = createStringPrefixWriter()
  writeRoleLikeHeader(
    out,
    roleBinding.metadata.name,
    roleBinding.metadata.labels,
    roleBinding.metadata.annotations
  )
  out.write(0, 'Role:\n')
  out.write(0, '  Kind:  %s\n', roleBinding.roleRef.kind)
  out.write(0, '  Name:  %s\n', roleBinding.roleRef.name)
  out.write(0, 'Subjects:\n')
  out.write(0, '  Kind            Name             Namespace\n')
  out.write(0, '  ----            ----             ---------\n')
  if ((roleBinding.subjects ?? []).length === 0) {
    out.write(0, '  <none>\n')
  } else {
    for (const subject of roleBinding.subjects) {
      const kindCell = subject.kind.padEnd(14)
      const nameCell = subject.name.padEnd(15)
      out.write(
        0,
        '  %s  %s  %s\n',
        kindCell,
        nameCell,
        subject.namespace ?? ''
      )
    }
  }
  return tabbedStringSync((sink) => {
    sink.write(out.toString())
  })
}

export const describeClusterRoleBinding = (
  clusterRoleBinding: ClusterRoleBinding
): string => {
  const out = createStringPrefixWriter()
  writeRoleLikeHeader(
    out,
    clusterRoleBinding.metadata.name,
    clusterRoleBinding.metadata.labels,
    clusterRoleBinding.metadata.annotations
  )
  out.write(0, 'Role:\n')
  out.write(0, '  Kind:  %s\n', clusterRoleBinding.roleRef.kind)
  out.write(0, '  Name:  %s\n', clusterRoleBinding.roleRef.name)
  out.write(0, 'Subjects:\n')
  out.write(0, '  Kind            Name             Namespace\n')
  out.write(0, '  ----            ----             ---------\n')
  if ((clusterRoleBinding.subjects ?? []).length === 0) {
    out.write(0, '  <none>\n')
  } else {
    for (const subject of clusterRoleBinding.subjects) {
      const kindCell = subject.kind.padEnd(14)
      const nameCell = subject.name.padEnd(15)
      out.write(
        0,
        '  %s  %s  %s\n',
        kindCell,
        nameCell,
        subject.namespace ?? ''
      )
    }
  }
  return tabbedStringSync((sink) => {
    sink.write(out.toString())
  })
}
