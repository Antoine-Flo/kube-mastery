// ═══════════════════════════════════════════════════════════════════════════
// CONFORMANCE SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════
// Declarative scenarios: same commands run on real cluster and simulator,
// outputs are normalized and compared.

export interface ConformanceStep {
  commands: string[]
}

export interface ConformanceScenario {
  name: string
  seed: string
  /** If true, wait for pods to be ready after applying seed (real cluster only) */
  seedWaitForPods?: boolean
  steps: ConformanceStep[]
}

export const CONFORMANCE_SCENARIOS: ConformanceScenario[] = [
  {
    name: 'minimal',
    seed: 'minimal',
    steps: [
      {
        commands: [
          'kubectl get pods',
          'kubectl get pods -A',
          'kubectl get nodes'
        ]
      }
    ]
  },
  {
    name: 'deployment-with-configmap',
    seed: 'deployment-with-configmap',
    seedWaitForPods: true,
    steps: [
      {
        commands: [
          'kubectl get pods',
          'kubectl get nodes',
          'kubectl get pods -o wide',
          'kubectl get pods -A'
        ]
      },
      {
        commands: [
          'kubectl describe pod web',
          'kubectl get pod web -o yaml',
          'kubectl get configmaps',
          'kubectl get secrets'
        ]
      },
      {
        commands: [
          'kubectl version',
          'kubectl version --client',
          'kubectl get events',
          'kubectl cluster-info'
        ]
      }
    ]
  },
  {
    name: 'multi-namespace',
    seed: 'multi-namespace',
    seedWaitForPods: true,
    steps: [
      {
        commands: [
          'kubectl get pods -A',
          'kubectl get pods -n production',
          'kubectl get pods -n staging'
        ]
      }
    ]
  },
  {
    name: 'pods-errors',
    seed: 'pods-errors',
    steps: [
      {
        commands: [
          'kubectl get pods',
          'kubectl describe pod crashloop-pod',
          'kubectl describe pod imagepull-pod',
          'kubectl describe pod pending-pod',
          'kubectl get events'
        ]
      }
    ]
  }
]
