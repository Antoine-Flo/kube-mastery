// Action types supported by kubectl parser
export type Action =
  | 'get'
  | 'describe'
  | 'delete'
  | 'apply'
  | 'create'
  | 'logs'
  | 'exec'
  | 'label'
  | 'annotate'
  | 'version'
  | 'cluster-info'
  | 'api-resources'
  | 'scale'

// Resource types (canonical names only)
export type Resource =
  | 'pods'
  | 'deployments'
  | 'services'
  | 'namespaces'
  | 'configmaps'
  | 'secrets'
  | 'nodes'
  | 'replicasets'

// Parsed command structure
export interface ParsedCommand {
  action: Action
  resource?: Resource // Optional for commands like 'version' that don't require a resource
  name?: string
  namespace?: string
  output?: 'table' | 'yaml' | 'json'
  selector?: Record<string, string> // Parsed label selector (e.g., -l app=nginx,env=prod)
  flags: Record<string, string | boolean> // Raw flags for backward compatibility
  execCommand?: string[] // For kubectl exec: command after --
  labelChanges?: Record<string, string | null> // For kubectl label: key=value or key- (null = removal)
  annotationChanges?: Record<string, string | null> // For kubectl annotate: key=value or key- (null = removal)
  replicas?: number // For kubectl scale: --replicas=N
}
