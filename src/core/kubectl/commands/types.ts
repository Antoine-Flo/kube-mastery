import type { KubectlResource } from './resources'

// Action types supported by kubectl parser
export type Action =
  | 'get'
  | 'diff'
  | 'explain'
  | 'describe'
  | 'edit'
  | 'set'
  | 'delete'
  | 'apply'
  | 'replace'
  | 'create'
  | 'logs'
  | 'exec'
  | 'label'
  | 'annotate'
  | 'version'
  | 'cluster-info'
  | 'api-versions'
  | 'api-resources'
  | 'scale'
  | 'run'
  | 'expose'
  | 'wait'
  | 'config'
  | 'config-get-contexts'
  | 'config-current-context'
  | 'config-view'
  | 'config-set-context'

// Resource types (canonical names only)
export type Resource = KubectlResource

// Parsed command structure
export interface ParsedCommand {
  action: Action
  configSubcommand?: 'get-contexts' | 'current-context' | 'view' | 'set-context'
  resource?: Resource // Optional for commands like 'version' that don't require a resource
  rawPath?: string // For kubectl get --raw: direct API path (e.g. /api/v1/namespaces)
  name?: string
  names?: string[] // Positional names after resource (e.g. get/delete pods a b c)
  namespace?: string
  output?: 'table' | 'yaml' | 'json'
  selector?: Record<string, string> // Parsed label selector (e.g., -l app=nginx,env=prod)
  flags: Record<string, string | boolean> // Raw normalized flags map
  execCommand?: string[] // For kubectl exec: command after --
  labelChanges?: Record<string, string | null> // For kubectl label: key=value or key- (null = removal)
  annotationChanges?: Record<string, string | null> // For kubectl annotate: key=value or key- (null = removal)
  replicas?: number // For kubectl scale: --replicas=N
  port?: number // For create deployment: --port=N
  createImages?: string[] // For create deployment: repeated --image flags
  createCommand?: string[] // For create deployment: command after --
  createServiceType?: 'clusterip' | 'nodeport' | 'loadbalancer' | 'externalname' // For create service: subtype token after "service"
  createSecretType?: 'generic' | 'tls' | 'docker-registry' // For create secret: subtype token after "secret"
  createFromLiterals?: string[] // For create configmap: repeated --from-literal values
  createFromFiles?: string[] // For create secret generic: repeated --from-file values
  createFromEnvFiles?: string[] // For create secret generic: repeated --from-env-file values
  explainPath?: string[] // For kubectl explain: field path segments after resource
  runImage?: string // For kubectl run: --image value
  runCommand?: string[] // For kubectl run: command after --
  runArgs?: string[] // For kubectl run: args after -- when --command is not set
  runUseCommand?: boolean // For kubectl run: --command flag
  runHasSeparator?: boolean // For kubectl run: whether -- separator is present
  runEnv?: string[] // For kubectl run: repeated --env flags (KEY=VALUE)
  runLabels?: Record<string, string> // For kubectl run: --labels key=value list
  runDryRunClient?: boolean // For kubectl run: --dry-run=client
  runRestart?: 'Always' | 'OnFailure' | 'Never' // For kubectl run: --restart policy
  runStdin?: boolean // For kubectl run: -i/--stdin
  runTty?: boolean // For kubectl run: -t/--tty
  runRemove?: boolean // For kubectl run: --rm
  setSubcommand?: 'image' // For kubectl set: supported subcommand
  setImageAssignments?: Record<string, string> // For kubectl set image: container=image pairs
  configCurrent?: boolean // For kubectl config set-context --current
  configMinify?: boolean // For kubectl config view --minify
  configNamespace?: string // For kubectl config set-context --namespace
  waitForCondition?: string // For kubectl wait: --for=condition=Ready
  waitTimeoutSeconds?: number // For kubectl wait: --timeout=60s
}
