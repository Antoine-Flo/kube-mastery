// ═══════════════════════════════════════════════════════════════════════════
// GOLDEN TESTS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
// Declarative configuration for all golden file tests

export type GoldenTestCategory =
  | 'pods'
  | 'events'
  | 'version'
  | 'cluster-info'
  | 'api-resources'
  | 'configmaps'
  | 'secrets'
  | 'describe'
  | 'nodes'

export interface GoldenTest {
  name: string // Nom du golden file (sans extension)
  command: string // Commande kubectl complète
  seed: string // Nom du seed à utiliser
  category: GoldenTestCategory // Catégorie pour organisation par dossiers
  clusterName?: string // Nom du cluster kind (défaut: seed name)
  waitForReady?: boolean // Attendre que les pods soient ready
  expectedError?: boolean // Commande attendue en erreur
  description?: string // Description pour documentation
}

/**
 * All golden file tests to generate
 */
export const GOLDEN_TESTS: GoldenTest[] = [
  // Pods tests
  {
    name: 'get-pods-empty',
    command: 'kubectl get pods',
    seed: 'minimal',
    category: 'pods',
    description: 'List pods in minimal cluster (only kube-system)'
  },
  {
    name: 'get-pods-empty-all-namespaces',
    command: 'kubectl get pods -A',
    seed: 'minimal',
    category: 'pods',
    description: 'List pods in all namespaces (minimal cluster)'
  },
  {
    name: 'get-pods-default',
    command: 'kubectl get pods',
    seed: 'deployment-with-configmap',
    category: 'pods',
    waitForReady: true,
    description: 'List pods in default namespace'
  },
  {
    name: 'get-pods-default-wide',
    command: 'kubectl get pods -o wide',
    seed: 'deployment-with-configmap',
    category: 'pods',
    waitForReady: true,
    description: 'List pods with wide output format'
  },
  {
    name: 'get-pods-default-all-namespaces',
    command: 'kubectl get pods -A',
    seed: 'deployment-with-configmap',
    category: 'pods',
    waitForReady: true,
    description: 'List pods in all namespaces'
  },
  {
    name: 'get-pods-default-namespace',
    command: 'kubectl get pods -n kube-system',
    seed: 'deployment-with-configmap',
    category: 'pods',
    description: 'List pods in kube-system namespace'
  },
  {
    name: 'get-pods-multi-namespace',
    command: 'kubectl get pods -A',
    seed: 'multi-namespace',
    category: 'pods',
    waitForReady: true,
    description: 'List pods across multiple namespaces'
  },
  {
    name: 'get-pods-production',
    command: 'kubectl get pods -n production',
    seed: 'multi-namespace',
    category: 'pods',
    waitForReady: true,
    description: 'List pods in production namespace'
  },
  {
    name: 'get-pods-staging',
    command: 'kubectl get pods -n staging',
    seed: 'multi-namespace',
    category: 'pods',
    waitForReady: true,
    description: 'List pods in staging namespace'
  },
  {
    name: 'get-pods-troubleshooting',
    command: 'kubectl get pods',
    seed: 'pods-errors',
    category: 'pods',
    description: 'List pods in pods-errors cluster (includes error states)'
  },
  {
    name: 'get-pod-web-yaml',
    command: 'kubectl get pod web -o yaml',
    seed: 'deployment-with-configmap',
    category: 'pods',
    waitForReady: true,
    description: 'Get web pod in YAML format'
  },
  {
    name: 'get-pod-web-json',
    command: 'kubectl get pod web -o json',
    seed: 'deployment-with-configmap',
    category: 'pods',
    waitForReady: true,
    description: 'Get web pod in JSON format'
  },

  // Describe tests
  {
    name: 'describe-pod-web',
    command: 'kubectl describe pod web',
    seed: 'deployment-with-configmap',
    category: 'describe',
    waitForReady: true,
    description: 'Describe web pod'
  },
  {
    name: 'describe-pod-crashloop',
    command: 'kubectl describe pod crashloop-pod',
    seed: 'pods-errors',
    category: 'describe',
    description: 'Describe pod in CrashLoopBackOff state'
  },
  {
    name: 'describe-pod-imagepull',
    command: 'kubectl describe pod imagepull-pod',
    seed: 'pods-errors',
    category: 'describe',
    description: 'Describe pod in ImagePullBackOff state'
  },
  {
    name: 'describe-pod-pending',
    command: 'kubectl describe pod pending-pod',
    seed: 'pods-errors',
    category: 'describe',
    description: 'Describe pod in Pending state'
  },

  // Events tests
  {
    name: 'get-events',
    command: 'kubectl get events',
    seed: 'deployment-with-configmap',
    category: 'events',
    description: 'List events'
  },
  {
    name: 'get-events-all-namespaces',
    command: 'kubectl get events -A',
    seed: 'deployment-with-configmap',
    category: 'events',
    description: 'List events in all namespaces'
  },
  {
    name: 'get-events-troubleshooting',
    command: 'kubectl get events',
    seed: 'pods-errors',
    category: 'events',
    description: 'List events in troubleshooting cluster'
  },

  // ConfigMaps tests
  {
    name: 'get-configmaps',
    command: 'kubectl get configmaps',
    seed: 'deployment-with-configmap',
    category: 'configmaps',
    description: 'List ConfigMaps'
  },

  // Secrets tests
  {
    name: 'get-secrets',
    command: 'kubectl get secrets',
    seed: 'deployment-with-configmap',
    category: 'secrets',
    description: 'List Secrets'
  },

  // Version tests
  {
    name: 'version-default',
    command: 'kubectl version',
    seed: 'deployment-with-configmap',
    category: 'version',
    description: 'Get client and server version (default output)'
  },
  {
    name: 'version-client',
    command: 'kubectl version --client',
    seed: 'deployment-with-configmap',
    category: 'version',
    description: 'Get client version only'
  },
  {
    name: 'version-json',
    command: 'kubectl version --output json',
    seed: 'deployment-with-configmap',
    category: 'version',
    description: 'Get version in JSON format'
  },
  {
    name: 'version-yaml',
    command: 'kubectl version --output yaml',
    seed: 'deployment-with-configmap',
    category: 'version',
    description: 'Get version in YAML format'
  },
  {
    name: 'version-client-json',
    command: 'kubectl version --client --output json',
    seed: 'deployment-with-configmap',
    category: 'version',
    description: 'Get client version only in JSON format'
  },
  {
    name: 'version-client-yaml',
    command: 'kubectl version --client --output yaml',
    seed: 'deployment-with-configmap',
    category: 'version',
    description: 'Get client version only in YAML format'
  },

  // Cluster-info tests
  {
    name: 'cluster-info-default',
    command: 'kubectl cluster-info',
    seed: 'deployment-with-configmap',
    category: 'cluster-info',
    description: 'Display cluster information (control plane and services)'
  },
  {
    name: 'cluster-info-empty',
    command: 'kubectl cluster-info',
    seed: 'minimal',
    category: 'cluster-info',
    description: 'Display cluster information in empty cluster'
  },
  {
    name: 'cluster-info-dump-default',
    command: 'kubectl cluster-info dump',
    seed: 'deployment-with-configmap',
    category: 'cluster-info',
    waitForReady: true,
    description: 'Dump cluster information to stdout (default namespace)'
  },
  {
    name: 'cluster-info-dump-all-namespaces',
    command: 'kubectl cluster-info dump --all-namespaces',
    seed: 'deployment-with-configmap',
    category: 'cluster-info',
    waitForReady: true,
    description: 'Dump cluster information for all namespaces'
  },
  {
    name: 'cluster-info-dump-json',
    command: 'kubectl cluster-info dump -o json',
    seed: 'deployment-with-configmap',
    category: 'cluster-info',
    waitForReady: true,
    description: 'Dump cluster information in JSON format'
  },
  {
    name: 'cluster-info-dump-yaml',
    command: 'kubectl cluster-info dump -o yaml',
    seed: 'deployment-with-configmap',
    category: 'cluster-info',
    waitForReady: true,
    description: 'Dump cluster information in YAML format'
  },

  // Api-resources tests
  {
    name: 'api-resources-default',
    command: 'kubectl api-resources',
    seed: 'deployment-with-configmap',
    category: 'api-resources',
    description: 'List API resources (default table format)'
  },
  {
    name: 'api-resources-wide',
    command: 'kubectl api-resources --output wide',
    seed: 'deployment-with-configmap',
    category: 'api-resources',
    description: 'List API resources with wide output (includes VERBS and CATEGORIES)'
  },
  {
    name: 'api-resources-name',
    command: 'kubectl api-resources --output name',
    seed: 'deployment-with-configmap',
    category: 'api-resources',
    description: 'List API resources as simple names (one per line)'
  },
  {
    name: 'api-resources-json',
    command: 'kubectl api-resources --output json',
    seed: 'deployment-with-configmap',
    category: 'api-resources',
    description: 'List API resources in JSON format'
  },
  {
    name: 'api-resources-yaml',
    command: 'kubectl api-resources --output yaml',
    seed: 'deployment-with-configmap',
    category: 'api-resources',
    description: 'List API resources in YAML format'
  },
  {
    name: 'api-resources-no-headers',
    command: 'kubectl api-resources --no-headers',
    seed: 'deployment-with-configmap',
    category: 'api-resources',
    description: 'List API resources without headers'
  },
  {
    name: 'api-resources-namespaced-true',
    command: 'kubectl api-resources --namespaced=true',
    seed: 'deployment-with-configmap',
    category: 'api-resources',
    description: 'List only namespaced API resources'
  },
  {
    name: 'api-resources-namespaced-false',
    command: 'kubectl api-resources --namespaced=false',
    seed: 'deployment-with-configmap',
    category: 'api-resources',
    description: 'List only non-namespaced API resources'
  },
  {
    name: 'api-resources-sort-by-name',
    command: 'kubectl api-resources --sort-by=name',
    seed: 'deployment-with-configmap',
    category: 'api-resources',
    description: 'List API resources sorted by name'
  },
  {
    name: 'api-resources-sort-by-kind',
    command: 'kubectl api-resources --sort-by=kind',
    seed: 'deployment-with-configmap',
    category: 'api-resources',
    description: 'List API resources sorted by kind'
  },

  // Nodes tests
  {
    name: 'get-nodes-default',
    command: 'kubectl get nodes',
    seed: 'deployment-with-configmap',
    category: 'nodes',
    description: 'List nodes in default cluster'
  },
  {
    name: 'get-nodes-empty',
    command: 'kubectl get nodes',
    seed: 'minimal',
    category: 'nodes',
    description: 'List nodes in empty cluster'
  },
  {
    name: 'get-nodes-wide',
    command: 'kubectl get nodes -o wide',
    seed: 'deployment-with-configmap',
    category: 'nodes',
    description: 'List nodes with wide output format'
  },
  {
    name: 'get-nodes-yaml',
    command: 'kubectl get nodes -o yaml',
    seed: 'deployment-with-configmap',
    category: 'nodes',
    description: 'Get nodes in YAML format'
  },
  {
    name: 'get-nodes-json',
    command: 'kubectl get nodes -o json',
    seed: 'deployment-with-configmap',
    category: 'nodes',
    description: 'Get nodes in JSON format'
  }
]
