import type { ConformanceScenarioCatalog } from './types'

export const conformanceTests: ConformanceScenarioCatalog = {
  'base': {
    cmds: [
      'kubectl version --client',
      'kubectl version',
      'kubectl api-versions',
      'kubectl cluster-info',
      'kubectl config get-contexts',
      'kubectl config current-context',
      'kubectl config view --minify',
      'kubectl get --raw /',
      'kubectl get --raw /api/v1/namespaces',
      'kubectl get --raw /openapi/v3',
      'kubectl get --raw /apis/networking.k8s.io/v1',
      'kubectl get --raw /openapi/v3/apis/networking.k8s.io/v1',
      'kubectl api-resources',
      'kubectl api-resources --output wide',
      'kubectl api-resources --output name',
      'kubectl explain pod',
      'kubectl explain pod.spec.containers'
    ]
  },
  'deployment': {
    setup: ['kubectl create deployment web --image=nginx:latest'],
    cmds: [
      'kubectl get deployments',
      'kubectl get deployment web',
      'kubectl describe deployment web',
      'kubectl scale deployment web --replicas=2',
      'kubectl get deployment web -o yaml'
    ],
    cleanup: ['kubectl delete deployment web']
  },
  'service': {
    setup: [
      'kubectl create deployment web --image=nginx:latest',
      'kubectl expose deployment web --name=web-svc --port=80 --target-port=80',
      'kubectl expose deployment web --name=web-nodeport --type=NodePort --port=80 --target-port=80'
    ],
    cmds: [
      'kubectl get svc',
      'kubectl get svc web-svc',
      'kubectl describe svc web-svc',
      'kubectl get svc web-nodeport -o yaml',
      'kubectl describe svc web-nodeport'
    ],
    cleanup: [
      'kubectl delete svc web-svc',
      'kubectl delete svc web-nodeport',
      'kubectl delete deployment web'
    ]
  },
  'configmap': {
    setup: [
      'kubectl create configmap myconfig --from-literal=ca.crt=dummy-ca --from-literal=mode=prod',
      'kubectl create secret generic my-secret --from-literal=username=jane --from-literal=password=s33msi4'
    ],
    cmds: [
      'kubectl get configmaps',
      'kubectl get configmap myconfig -o yaml',
      "kubectl get configmap myconfig -o jsonpath='{.data.ca\\.crt}'",
      'kubectl get secrets',
      'kubectl get secret my-secret -o yaml'
    ],
    cleanup: ['kubectl delete configmap myconfig', 'kubectl delete secret my-secret']
  },
  'pod': {
    setup: [
      'kubectl run web --image=busybox --command -- sleep 3600',
      'kubectl wait --for=condition=Ready pod/web --timeout=60s'
    ],
    cmds: [
      'kubectl get pod web',
      'kubectl describe pod web',
      'kubectl logs web --tail=5',
      'kubectl exec web -- env',
      'kubectl label pod web team=platform',
      'kubectl annotate pod web owner=platform',
      'kubectl get pod web -o yaml',
      'kubectl label pod web team-',
      'kubectl annotate pod web owner-'
    ],
    cleanup: ['kubectl delete pod web']
  },
  'run': {
    cmds: [
      'kubectl run run-ok-image-only --image=busybox',
      'kubectl get pod run-ok-image-only',
      'kubectl logs run-ok-image-only -n default --tail=5',
      'kubectl delete pod run-ok-image-only',
      'kubectl run run-ok-args --image=busybox -- sleep 3600',
      'kubectl get pod run-ok-args',
      'kubectl delete pod run-ok-args',
      'kubectl run run-ok-env-label-port --image=busybox --env=DNS_DOMAIN=cluster --env=POD_NAMESPACE=default --labels=app=hazelcast,env=prod --port=5701',
      'kubectl get pod run-ok-env-label-port -o yaml',
      'kubectl delete pod run-ok-env-label-port',
      'kubectl run run-ok-dry-run --image=busybox --dry-run=client'
    ]
  },
  'imperative-dry-run-yaml': {
    cmds: [
      'kubectl create namespace dryrun-demo --dry-run=client -o yaml',
      'kubectl create deployment dryrun-dep --image=nginx --replicas=2 --dry-run=client -o yaml',
      'kubectl create service clusterip dryrun-svc --tcp=80:80 --dry-run=client -o yaml',
      'kubectl create configmap dryrun-cm --from-literal=mode=dev --dry-run=client -o yaml',
      'kubectl create secret generic dryrun-secret --from-literal=password=s3cr3t --dry-run=client -o yaml',
      'kubectl run dryrun-pod --image=busybox --dry-run=client -o yaml'
    ]
  },
  'daemonset-and-replicaset': {
    setup: [
      'kubectl create deployment rs-source --image=nginx:latest',
      'kubectl create daemonset ds-sample --image=nginx:latest'
    ],
    cmds: [
      'kubectl get replicasets',
      'kubectl get daemonsets -n default',
      'kubectl get daemonset ds-sample',
      'kubectl get daemonset ds-sample -o yaml',
      'kubectl describe daemonset ds-sample'
    ],
    cleanup: ['kubectl delete daemonset ds-sample', 'kubectl delete deployment rs-source']
  },
  'storage-pv-pvc': {
    cmds: [
      'kubectl get pv',
      'kubectl get pvc -A',
      'kubectl describe pv missing-pv',
      'kubectl describe pvc missing-pvc'
    ]
  },
  'namespace': {
    setup: [
      'kubectl create namespace conformance-team',
      'kubectl create deployment web --image=nginx:latest -n conformance-team'
    ],
    cmds: [
      'kubectl get namespace conformance-team',
      'kubectl get deployment web -n conformance-team',
      'kubectl get pods -n conformance-team'
    ],
    cleanup: [
      'kubectl delete deployment web -n conformance-team',
      'kubectl delete namespace conformance-team'
    ]
  },
  'ingress': {
    setup: [
      'kubectl create deployment api --image=nginx:latest',
      'kubectl create deployment frontend --image=nginx:latest',
      'kubectl expose deployment api --name=api-service --port=80 --target-port=80',
      'kubectl expose deployment frontend --name=frontend-service --port=80 --target-port=80',
      'kubectl create ingress demo-ingress --rule="demo.local/=frontend-service:80" --rule="demo.local/api=api-service:80"'
    ],
    cmds: [
      'kubectl get ingress',
      'kubectl describe ingress demo-ingress',
      'kubectl get ingressclass',
      'kubectl get svc api-service -o yaml',
      'kubectl get svc frontend-service -o json'
    ],
    cleanup: [
      'kubectl delete ingress demo-ingress',
      'kubectl delete svc api-service',
      'kubectl delete svc frontend-service',
      'kubectl delete deployment api',
      'kubectl delete deployment frontend'
    ]
  }
}

export const DEFAULT_SCENARIO_KEY = 'platform-cluster-readonly'
