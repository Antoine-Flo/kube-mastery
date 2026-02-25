import type { KubectlCommandName } from '../../lib/command-segmentation'

export type ScenarioType =
  | 'happy-path'
  | 'error-path'
  | 'help-path'
  | 'format-path'
  | 'parity-path'

export interface CommandMatrixAxis {
  inputShape: string[]
  context: string[]
  expectedOutput: string[]
}

export interface CommandMatrixDefinition {
  command: KubectlCommandName
  strategy: 'pairwise-risk-based'
  scenarioTypes: ScenarioType[]
  mandatoryCases: string[]
  axis: CommandMatrixAxis
}

const COMMON_EXPECTATIONS = [
  'exitCode parity',
  'stdout/stderr contract',
  'compareMode (normalized/raw/none)'
]

export const COMMAND_MATRIX: Record<KubectlCommandName, CommandMatrixDefinition> = {
  annotate: {
    command: 'annotate',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['help-path'],
    mandatoryCases: ['kubectl annotate --help'],
    axis: {
      inputShape: ['--help'],
      context: ['N/A'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  'api-resources': {
    command: 'api-resources',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'error-path', 'help-path', 'format-path'],
    mandatoryCases: [
      'kubectl api-resources',
      'kubectl api-resources --output wide',
      'kubectl api-resources --output json',
      'kubectl api-resources --sort-by=kind',
      'kubectl api-resources --sort-by=age',
      'kubectl api-resources --help'
    ],
    axis: {
      inputShape: ['--output', '--namespaced', '--sort-by', '--no-headers'],
      context: ['seed=minimal'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  'api-versions': {
    command: 'api-versions',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path'],
    mandatoryCases: ['kubectl api-versions'],
    axis: {
      inputShape: ['default'],
      context: ['seed=minimal'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  apply: {
    command: 'apply',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['help-path'],
    mandatoryCases: ['kubectl apply --help'],
    axis: {
      inputShape: ['--help'],
      context: ['N/A'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  'cluster-info': {
    command: 'cluster-info',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'error-path', 'help-path', 'format-path'],
    mandatoryCases: [
      'kubectl cluster-info',
      'kubectl cluster-info dump',
      'kubectl cluster-info dump -o yaml',
      'kubectl cluster-info dump --output-directory /tmp/out',
      'kubectl cluster-info --help'
    ],
    axis: {
      inputShape: ['default', 'dump', '-o', '--output-directory'],
      context: ['seed=minimal', 'namespaces=default,kube-system'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  config: {
    command: 'config',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'help-path', 'format-path'],
    mandatoryCases: [
      'kubectl config get-contexts',
      'kubectl config current-context',
      'kubectl config view --minify',
      'kubectl config set-context --current --namespace=dev',
      'kubectl config --help'
    ],
    axis: {
      inputShape: ['get-contexts', 'current-context', 'view --minify', 'set-context --current --namespace'],
      context: ['seed=minimal'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  create: {
    command: 'create',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'error-path', 'help-path'],
    mandatoryCases: [
      'kubectl create deployment exhaustive-web --image=nginx:latest',
      'kubectl create deployment exhaustive-multi --image=busybox --image=nginx -- date',
      'kubectl create deployment invalid-without-image',
      'kubectl create namespace my-team',
      'kubectl create --help',
      'kubectl create deployment --help'
    ],
    axis: {
      inputShape: ['--image', '--replicas', '--port', '--help'],
      context: ['seed=deployment-with-configmap', 'seed=minimal'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  delete: {
    command: 'delete',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'error-path', 'help-path'],
    mandatoryCases: [
      'kubectl delete deployments exhaustive-web',
      'kubectl delete namespace my-team',
      'kubectl delete pods missing-pod',
      'kubectl delete --help'
    ],
    axis: {
      inputShape: ['resource by name', '--help'],
      context: ['seed=deployment-with-configmap', 'seed=minimal'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  describe: {
    command: 'describe',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'error-path', 'help-path'],
    mandatoryCases: [
      'kubectl describe pod web',
      'kubectl describe deployment exhaustive-web',
      'kubectl describe node conformance-worker2',
      'kubectl describe pod missing-pod',
      'kubectl describe --help'
    ],
    axis: {
      inputShape: ['resource by name', '--help'],
      context: ['seed=deployment-with-configmap', 'seed=minimal'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  diff: {
    command: 'diff',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'parity-path'],
    mandatoryCases: [
      'kubectl diff -f src/courses/seeds/deployment-with-configmap/configmap.yaml',
      'kubectl diff -f src/courses/seeds/diff-fixtures/configmap-changed.yaml'
    ],
    axis: {
      inputShape: ['-f path'],
      context: ['seed=deployment-with-configmap'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  exec: {
    command: 'exec',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['help-path'],
    mandatoryCases: ['kubectl exec --help'],
    axis: {
      inputShape: ['--help'],
      context: ['N/A'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  explain: {
    command: 'explain',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'error-path', 'help-path'],
    mandatoryCases: [
      'kubectl explain pod',
      'kubectl explain deployment.spec.template.spec.containers',
      'kubectl explain pod.spec.notFound',
      'kubectl explain all'
    ],
    axis: {
      inputShape: ['resource', 'resource.path'],
      context: ['seed=minimal'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  get: {
    command: 'get',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'error-path', 'help-path', 'format-path'],
    mandatoryCases: [
      'kubectl get pods',
      'kubectl get pods -A',
      'kubectl get pods -o yaml',
      'kubectl get all -A',
      'kubectl get --raw /',
      'kubectl get not-a-resource',
      'kubectl get --help'
    ],
    axis: {
      inputShape: ['-A', '-o', '--raw'],
      context: ['seed=minimal', 'seed=deployment-with-configmap'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  help: {
    command: 'help',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['help-path'],
    mandatoryCases: ['kubectl -h', 'kubectl --help'],
    axis: {
      inputShape: ['-h', '--help'],
      context: ['N/A'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  label: {
    command: 'label',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['help-path'],
    mandatoryCases: ['kubectl label --help'],
    axis: {
      inputShape: ['--help'],
      context: ['N/A'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  logs: {
    command: 'logs',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['help-path'],
    mandatoryCases: ['kubectl logs --help'],
    axis: {
      inputShape: ['--help'],
      context: ['N/A'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  run: {
    command: 'run',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'error-path', 'help-path', 'format-path'],
    mandatoryCases: [
      'kubectl run run-ok-image-only --image=busybox',
      'kubectl run run-ok-env-label-port --image=busybox --env=DNS_DOMAIN=cluster --labels=app=hazelcast,env=prod --port=5701',
      'kubectl run run-ok-dry-run --image=busybox --dry-run=client',
      'kubectl run missing-image',
      'kubectl run invalid-env --image=busybox --env INVALID',
      'kubectl run unsupported-restart --image=busybox --restart=Always',
      'kubectl run --help'
    ],
    axis: {
      inputShape: ['--image', '--command', '--', '--env', '--labels', '--port', '--dry-run', '--restart'],
      context: ['seed=minimal'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  scale: {
    command: 'scale',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'error-path', 'help-path'],
    mandatoryCases: [
      'kubectl scale deployments exhaustive-web --replicas=3',
      'kubectl scale deployments missing-deploy --replicas=2',
      'kubectl scale --help'
    ],
    axis: {
      inputShape: ['--replicas'],
      context: ['seed=deployment-with-configmap'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  },
  version: {
    command: 'version',
    strategy: 'pairwise-risk-based',
    scenarioTypes: ['happy-path', 'error-path', 'help-path', 'format-path'],
    mandatoryCases: [
      'kubectl version',
      'kubectl version --client',
      'kubectl version --output json',
      'kubectl version --output wide',
      'kubectl version --help'
    ],
    axis: {
      inputShape: ['--client', '--output'],
      context: ['seed=minimal'],
      expectedOutput: COMMON_EXPECTATIONS
    }
  }
}
