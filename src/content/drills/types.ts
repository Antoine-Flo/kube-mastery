/** Set `tag:` in drill YAML to one of these string ids (see `messages/*` for labels). */
export const DRILL_TAG_IDS = [
  'storage',
  'troubleshooting',
  'services_networking',
  'cluster_architecture_installation'
] as const

export type DrillTagId = (typeof DRILL_TAG_IDS)[number]

export const DRILL_CLUSTER_RESOURCE_KINDS = [
  'Pod',
  'ConfigMap',
  'ControllerRevision',
  'Secret',
  'Node',
  'ReplicaSet',
  'Deployment',
  'DaemonSet',
  'StatefulSet',
  'Service',
  'EndpointSlice',
  'Endpoints',
  'Event',
  'Ingress',
  'IngressClass',
  'NetworkPolicy',
  'GatewayClass',
  'Gateway',
  'HTTPRoute',
  'PersistentVolume',
  'PersistentVolumeClaim',
  'Namespace',
  'Lease',
  'StorageClass'
] as const

export type DrillClusterResourceKind = (typeof DRILL_CLUSTER_RESOURCE_KINDS)[number]

export const DRILL_ASSERTION_TYPES = [
  'clusterResourceExists',
  'clusterFieldEquals',
  'clusterFieldContains',
  'clusterFieldNotEmpty',
  'clusterFieldsEqual',
  'clusterListFieldContains',
  'filesystemFileExists',
  'filesystemFileContains',
  'filesystemFileNotEmpty'
] as const

export type DrillAssertionType = (typeof DRILL_ASSERTION_TYPES)[number]

export const DRILL_ASSERTION_TYPE_SET = new Set<string>(DRILL_ASSERTION_TYPES)
export const DRILL_CLUSTER_RESOURCE_KIND_SET = new Set<string>(
  DRILL_CLUSTER_RESOURCE_KINDS
)

interface DrillAssertionBase {
  type: DrillAssertionType
  onFail: string
}

interface DrillClusterAssertionBase extends DrillAssertionBase {
  kind: DrillClusterResourceKind
  namespace?: string
}

export interface DrillClusterResourceExistsAssertion
  extends DrillClusterAssertionBase {
  type: 'clusterResourceExists'
  name: string
}

export interface DrillClusterFieldEqualsAssertion
  extends DrillClusterAssertionBase {
  type: 'clusterFieldEquals'
  name: string
  path: string
  value: string
}

export interface DrillClusterFieldContainsAssertion
  extends DrillClusterAssertionBase {
  type: 'clusterFieldContains'
  name: string
  path: string
  value: string
}

export interface DrillClusterFieldNotEmptyAssertion
  extends DrillClusterAssertionBase {
  type: 'clusterFieldNotEmpty'
  name: string
  path: string
}

export interface DrillClusterFieldsEqualAssertion
  extends DrillClusterAssertionBase {
  type: 'clusterFieldsEqual'
  name: string
  leftPath: string
  rightPath: string
}

export interface DrillClusterListFieldContainsAssertion
  extends DrillClusterAssertionBase {
  type: 'clusterListFieldContains'
  path: string
  value: string
}

export interface DrillFilesystemFileExistsAssertion extends DrillAssertionBase {
  type: 'filesystemFileExists'
  path: string
}

export interface DrillFilesystemFileContainsAssertion
  extends DrillAssertionBase {
  type: 'filesystemFileContains'
  path: string
  value: string
}

export interface DrillFilesystemFileNotEmptyAssertion
  extends DrillAssertionBase {
  type: 'filesystemFileNotEmpty'
  path: string
}

export type DrillAssertion =
  | DrillClusterResourceExistsAssertion
  | DrillClusterFieldEqualsAssertion
  | DrillClusterFieldContainsAssertion
  | DrillClusterFieldNotEmptyAssertion
  | DrillClusterFieldsEqualAssertion
  | DrillClusterListFieldContainsAssertion
  | DrillFilesystemFileExistsAssertion
  | DrillFilesystemFileContainsAssertion
  | DrillFilesystemFileNotEmptyAssertion

export interface DrillValidation {
  assertions: DrillAssertion[]
}

export interface DrillTask {
  task: string
  command: string
  explanation: string
  validation?: DrillValidation
}

export interface DrillFile {
  title: string
  description?: string
  environment?: string
  ckaTargetMinutes?: number
  tag?: DrillTagId
  tasks: DrillTask[]
}

export interface DrillListItem {
  id: string
  title: string
  description: string | null
  totalTasks: number
  tag: DrillTagId | null
}

export interface DrillDetail {
  id: string
  title: string
  description: string | null
  environment?: string
  ckaTargetMinutes?: number
  tasks: DrillTask[]
  tag: DrillTagId | null
}
