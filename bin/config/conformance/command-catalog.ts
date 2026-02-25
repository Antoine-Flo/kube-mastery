import type {
  LifecycleCommandConfig,
  LifecycleSegment
} from '../../lib/scenario-generator'

const createRawCommand = (
  command: string,
  stdoutContains: string[]
): LifecycleCommandConfig => {
  return {
    command,
    compareMode: 'none',
    expectKind: {
      exitCode: 0,
      stdoutContains
    },
    expectRunner: {
      exitCode: 0,
      stdoutContains
    }
  }
}

const createRawErrorCommand = (
  command: string,
  stderrContains: string[]
): LifecycleCommandConfig => {
  return {
    command,
    compareMode: 'none',
    expectKind: {
      exitCode: 1,
      stderrContains
    },
    expectRunner: {
      exitCode: 1,
      stderrContains
    }
  }
}

const createRawDiffCommand = (
  command: string,
  stdoutContains: string[]
): LifecycleCommandConfig => {
  return {
    command,
    compareMode: 'none',
    expectKind: {
      exitCode: 1,
      stdoutContains
    },
    expectRunner: {
      exitCode: 1,
      stdoutContains
    }
  }
}

export const createCommandCatalogSegments = (): LifecycleSegment[] => {
  return [
    {
      idPrefix: 'minimal',
      seed: 'minimal',
      waitForPods: true,
      commands: [
        'kubectl get pods',
        'kubectl get pods -A',
        'kubectl get pods -o yaml',
        'kubectl get pods -o json',
        'kubectl delete pod web-00063e839a-chadq',
        'kubectl get nodes',
        'kubectl describe node conformance-worker',
        'kubectl get configmaps',
        'kubectl get secrets'
      ]
    },
    {
      idPrefix: 'deploy-cm',
      seed: 'deployment-with-configmap',
      waitForPods: true,
      commands: [
        'kubectl get pods',
        'kubectl get pods -A',
        'kubectl get pods -o wide',
        'kubectl describe pod web',
        'kubectl get pod web -o yaml',
        'kubectl get deployments',
        'kubectl get replicasets',
        'kubectl get daemonsets -A',
        'kubectl diff -f src/courses/seeds/deployment-with-configmap/configmap.yaml',
        'kubectl diff -f src/courses/seeds/deployment-with-configmap/secret.yaml',
        createRawDiffCommand(
          'kubectl diff -f src/courses/seeds/diff-fixtures/configmap-changed.yaml',
          ['app-config', 'LOG_LEVEL']
        ),
        createRawDiffCommand(
          'kubectl diff -f src/courses/seeds/diff-fixtures/secret-changed.yaml',
          ['app-secret']
        ),
        'kubectl create deployment exhaustive-web --image=nginx:latest',
        'kubectl describe deployment exhaustive-web',
        'kubectl create deployment exhaustive-api --image=nginx:latest --replicas=2 --port=8080',
        'kubectl create deployment exhaustive-multi --image=busybox --image=nginx -- date',
        'kubectl get all',
        'kubectl get all -A',
        'kubectl scale deployments exhaustive-web --replicas=3',
        'kubectl get deployments',
        'kubectl delete deployments exhaustive-api',
        'kubectl delete deployments exhaustive-multi',
        'kubectl delete deployments exhaustive-web'
      ]
    },
    {
      idPrefix: 'platform',
      seed: 'minimal',
      commands: [
        createRawCommand('kubectl get --raw /', ['"paths"', '/api', '/openapi/v3']),
        createRawCommand('kubectl get --raw /api/v1/namespaces', [
          'NamespaceList',
          '"items"',
          '"kubernetes.io/metadata.name"',
          '"kube-public"',
          '"kube-node-lease"'
        ]),
        'kubectl version',
        'kubectl version --client',
        'kubectl version --output json',
        'kubectl version --output yaml',
        'kubectl cluster-info',
        'kubectl cluster-info dump',
        'kubectl cluster-info dump -o yaml',
        'kubectl cluster-info dump --namespaces=default,kube-system',
        'kubectl api-versions',
        'kubectl api-resources',
        'kubectl api-resources --output wide',
        'kubectl api-resources --output name',
        'kubectl api-resources --output json',
        'kubectl api-resources --output yaml',
        'kubectl api-resources --namespaced=true',
        'kubectl api-resources --namespaced=false',
        'kubectl api-resources --sort-by=name',
        'kubectl api-resources --sort-by=kind',
        'kubectl api-resources --no-headers',
        createRawCommand('kubectl explain pod', ['KIND:', 'Pod', 'FIELDS:']),
        createRawCommand('kubectl explain pod.spec.containers', [
          'FIELD:    containers',
          'DESCRIPTION:'
        ]),
        createRawCommand(
          'kubectl explain deployment.spec.template.spec.containers',
          ['FIELD:    containers', 'KIND:', 'Deployment']
        ),
        createRawCommand('kubectl explain service.spec.ports', [
          'FIELD:    ports',
          'KIND:',
          'Service'
        ]),
        createRawCommand('kubectl explain configmap.data', [
          'FIELD:    data',
          'KIND:',
          'ConfigMap'
        ]),
        createRawCommand('kubectl explain secret.data', [
          'FIELD:    data',
          'KIND:',
          'Secret'
        ]),
        createRawCommand('kubectl explain namespace.metadata', [
          'FIELD:    metadata',
          'KIND:',
          'Namespace'
        ]),
        createRawCommand('kubectl explain node.status', [
          'FIELD:    status',
          'KIND:',
          'Node'
        ]),
        'kubectl describe node conformance-control-plane',
        'kubectl describe node conformance-worker2',
        createRawCommand('kubectl explain replicaset.spec.replicas', [
          'FIELD:    replicas',
          'KIND:',
          'ReplicaSet'
        ]),
        createRawCommand('kubectl explain daemonset.spec.template', [
          'FIELD:    template',
          'KIND:',
          'DaemonSet'
        ])
      ]
    },
    {
      idPrefix: 'run-cases',
      seed: 'minimal',
      commands: [
        createRawCommand(
          'kubectl run run-ok-command --image=busybox --command -- sleep 3600',
          ['pod/run-ok-command created']
        ),
        'kubectl get pod run-ok-command',
        'kubectl delete pod run-ok-command',
        createRawCommand('kubectl run run-ok-image-only --image=busybox', [
          'pod/run-ok-image-only created'
        ]),
        'kubectl delete pod run-ok-image-only',
        createRawCommand('kubectl run run-ok-args --image=busybox -- sleep 3600', [
          'pod/run-ok-args created'
        ]),
        'kubectl delete pod run-ok-args',
        createRawCommand(
          'kubectl run run-ok-env-label-port --image=busybox --env=DNS_DOMAIN=cluster --env=POD_NAMESPACE=default --labels=app=hazelcast,env=prod --port=5701',
          ['pod/run-ok-env-label-port created']
        ),
        'kubectl describe pod run-ok-env-label-port',
        'kubectl delete pod run-ok-env-label-port',
        createRawCommand(
          'kubectl run run-ok-interactive --image=busybox -i -t --restart=Never --rm',
          ['pod/run-ok-interactive created']
        ),
        'kubectl delete pod run-ok-interactive',
        createRawCommand(
          'kubectl run run-ok-dry-run --image=busybox --dry-run=client',
          ['pod/run-ok-dry-run created (dry run)']
        ),
        createRawErrorCommand('kubectl get pod run-ok-dry-run', [
          'Error from server (NotFound): pods "run-ok-dry-run" not found'
        ])
      ]
    },
    {
      idPrefix: 'namespace-ops',
      seed: 'minimal',
      commands: [
        createRawCommand('kubectl create namespace my-team', [
          'namespace/my-team created'
        ]),
        'kubectl get namespace my-team',
        'kubectl get namespaces',
        createRawCommand('kubectl get --raw /api/v1/namespaces', [
          'NamespaceList',
          '"my-team"'
        ]),
        createRawErrorCommand('kubectl create namespace my-team', [
          'Error from server (AlreadyExists): namespaces "my-team" already exists'
        ]),
        'kubectl delete namespace my-team',
        createRawErrorCommand('kubectl get namespace my-team', [
          'Error from server (NotFound): namespaces "my-team" not found'
        ])
      ]
    },
    {
      idPrefix: 'errors-help',
      seed: 'minimal',
      commands: [
        createRawErrorCommand('kubectl get pods --raw /', [
          'arguments may not be passed when --raw is specified'
        ]),
        createRawErrorCommand('kubectl get --raw / -o json', [
          '--raw and --output are mutually exclusive'
        ]),
        'kubectl create deployment invalid-without-image',
        'kubectl delete pods missing-pod',
        'kubectl describe pod missing-pod',
        'kubectl scale deployments missing-deploy --replicas=2',
        'kubectl get not-a-resource',
        createRawErrorCommand('kubectl run', ['run requires a resource name']),
        createRawErrorCommand('kubectl run missing-image', [
          'run requires flag --image'
        ]),
        createRawErrorCommand(
          'kubectl run missing-command --image=busybox --command --',
          ['run requires command after --']
        ),
        createRawErrorCommand('kubectl run missing-args --image=busybox --', [
          'run requires arguments after --'
        ]),
        createRawErrorCommand(
          'kubectl run invalid-env --image=busybox --env INVALID',
          ['run --env values must use KEY=VALUE format']
        ),
        createRawErrorCommand(
          'kubectl run invalid-dry-run --image=busybox --dry-run=local',
          ['run dry-run must be one of: none, server, client']
        ),
        createRawErrorCommand(
          'kubectl run invalid-restart-value --image=busybox --restart=Sometimes',
          ['run restart must be one of: Always, OnFailure, Never']
        ),
        createRawErrorCommand(
          'kubectl run unsupported-restart --image=busybox --restart=Always',
          ['run currently supports only --restart=Never in this simulator']
        ),
        createRawErrorCommand('kubectl explain pod.spec.notFound', [
          'field "notFound" does not exist'
        ]),
        createRawErrorCommand('kubectl explain all', [
          'the server does not have a resource type'
        ]),
        'kubectl version --output wide',
        'kubectl api-resources --sort-by=age',
        'kubectl cluster-info dump --output-directory /tmp/out',
        'kubectl -h',
        'kubectl --help',
        'kubectl get --help',
        'kubectl create --help',
        'kubectl create deployment --help',
        'kubectl delete --help',
        'kubectl describe --help',
        'kubectl scale --help',
        'kubectl version --help',
        'kubectl cluster-info --help',
        'kubectl api-resources --help',
        'kubectl logs --help',
        'kubectl exec --help',
        'kubectl run --help',
        'kubectl label --help',
        'kubectl annotate --help'
      ]
    }
  ]
}
