import type { ClusterStateData } from '../../../cluster/ClusterState'
import { collectDiscoveredNamespaces } from './namespaceDiscovery'

type RawGetHandler = (state: ClusterStateData) => unknown

const DISCOVERY_ROOT_PATHS = [
  '/.well-known/openid-configuration',
  '/api',
  '/api/v1',
  '/apis',
  '/apis/',
  '/apis/admissionregistration.k8s.io',
  '/apis/admissionregistration.k8s.io/v1',
  '/apis/apiextensions.k8s.io',
  '/apis/apiextensions.k8s.io/v1',
  '/apis/apiregistration.k8s.io',
  '/apis/apiregistration.k8s.io/v1',
  '/apis/apps',
  '/apis/apps/v1',
  '/apis/authentication.k8s.io',
  '/apis/authentication.k8s.io/v1',
  '/apis/authorization.k8s.io',
  '/apis/authorization.k8s.io/v1',
  '/apis/autoscaling',
  '/apis/autoscaling/v1',
  '/apis/autoscaling/v2',
  '/apis/batch',
  '/apis/batch/v1',
  '/apis/certificates.k8s.io',
  '/apis/certificates.k8s.io/v1',
  '/apis/coordination.k8s.io',
  '/apis/coordination.k8s.io/v1',
  '/apis/discovery.k8s.io',
  '/apis/discovery.k8s.io/v1',
  '/apis/events.k8s.io',
  '/apis/events.k8s.io/v1',
  '/apis/flowcontrol.apiserver.k8s.io',
  '/apis/flowcontrol.apiserver.k8s.io/v1',
  '/apis/networking.k8s.io',
  '/apis/networking.k8s.io/v1',
  '/apis/node.k8s.io',
  '/apis/node.k8s.io/v1',
  '/apis/policy',
  '/apis/policy/v1',
  '/apis/rbac.authorization.k8s.io',
  '/apis/rbac.authorization.k8s.io/v1',
  '/apis/resource.k8s.io',
  '/apis/resource.k8s.io/v1',
  '/apis/scheduling.k8s.io',
  '/apis/scheduling.k8s.io/v1',
  '/apis/storage.k8s.io',
  '/apis/storage.k8s.io/v1',
  '/healthz',
  '/healthz/autoregister-completion',
  '/healthz/etcd',
  '/healthz/log',
  '/healthz/ping',
  '/healthz/poststarthook/aggregator-reload-proxy-client-cert',
  '/healthz/poststarthook/apiservice-discovery-controller',
  '/healthz/poststarthook/apiservice-openapi-controller',
  '/healthz/poststarthook/apiservice-openapiv3-controller',
  '/healthz/poststarthook/apiservice-registration-controller',
  '/healthz/poststarthook/apiservice-status-local-available-controller',
  '/healthz/poststarthook/apiservice-status-remote-available-controller',
  '/healthz/poststarthook/bootstrap-controller',
  '/healthz/poststarthook/crd-informer-synced',
  '/healthz/poststarthook/generic-apiserver-start-informers',
  '/healthz/poststarthook/kube-apiserver-autoregistration',
  '/healthz/poststarthook/priority-and-fairness-config-consumer',
  '/healthz/poststarthook/priority-and-fairness-config-producer',
  '/healthz/poststarthook/priority-and-fairness-filter',
  '/healthz/poststarthook/rbac/bootstrap-roles',
  '/healthz/poststarthook/scheduling/bootstrap-system-priority-classes',
  '/healthz/poststarthook/start-apiextensions-controllers',
  '/healthz/poststarthook/start-apiextensions-informers',
  '/healthz/poststarthook/start-apiserver-admission-initializer',
  '/healthz/poststarthook/start-cluster-authentication-info-controller',
  '/healthz/poststarthook/start-kube-aggregator-informers',
  '/healthz/poststarthook/start-kube-apiserver-identity-lease-controller',
  '/healthz/poststarthook/start-kube-apiserver-identity-lease-garbage-collector',
  '/healthz/poststarthook/start-kubernetes-service-cidr-controller',
  '/healthz/poststarthook/start-legacy-token-tracking-controller',
  '/healthz/poststarthook/start-service-ip-repair-controllers',
  '/healthz/poststarthook/start-system-namespaces-controller',
  '/healthz/poststarthook/storage-object-count-tracker-hook',
  '/livez',
  '/livez/autoregister-completion',
  '/livez/etcd',
  '/livez/log',
  '/livez/ping',
  '/livez/poststarthook/aggregator-reload-proxy-client-cert',
  '/livez/poststarthook/apiservice-discovery-controller',
  '/livez/poststarthook/apiservice-openapi-controller',
  '/livez/poststarthook/apiservice-openapiv3-controller',
  '/livez/poststarthook/apiservice-registration-controller',
  '/livez/poststarthook/apiservice-status-local-available-controller',
  '/livez/poststarthook/apiservice-status-remote-available-controller',
  '/livez/poststarthook/bootstrap-controller',
  '/livez/poststarthook/crd-informer-synced',
  '/livez/poststarthook/generic-apiserver-start-informers',
  '/livez/poststarthook/kube-apiserver-autoregistration',
  '/livez/poststarthook/priority-and-fairness-config-consumer',
  '/livez/poststarthook/priority-and-fairness-config-producer',
  '/livez/poststarthook/priority-and-fairness-filter',
  '/livez/poststarthook/rbac/bootstrap-roles',
  '/livez/poststarthook/scheduling/bootstrap-system-priority-classes',
  '/livez/poststarthook/start-apiextensions-controllers',
  '/livez/poststarthook/start-apiextensions-informers',
  '/livez/poststarthook/start-apiserver-admission-initializer',
  '/livez/poststarthook/start-cluster-authentication-info-controller',
  '/livez/poststarthook/start-kube-aggregator-informers',
  '/livez/poststarthook/start-kube-apiserver-identity-lease-controller',
  '/livez/poststarthook/start-kube-apiserver-identity-lease-garbage-collector',
  '/livez/poststarthook/start-kubernetes-service-cidr-controller',
  '/livez/poststarthook/start-legacy-token-tracking-controller',
  '/livez/poststarthook/start-service-ip-repair-controllers',
  '/livez/poststarthook/start-system-namespaces-controller',
  '/livez/poststarthook/storage-object-count-tracker-hook',
  '/metrics',
  '/metrics/slis',
  '/openapi/v2',
  '/openapi/v3',
  '/openapi/v3/',
  '/openid/v1/jwks',
  '/readyz',
  '/readyz/autoregister-completion',
  '/readyz/etcd',
  '/readyz/etcd-readiness',
  '/readyz/informer-sync',
  '/readyz/log',
  '/readyz/ping',
  '/readyz/poststarthook/aggregator-reload-proxy-client-cert',
  '/readyz/poststarthook/apiservice-discovery-controller',
  '/readyz/poststarthook/apiservice-openapi-controller',
  '/readyz/poststarthook/apiservice-openapiv3-controller',
  '/readyz/poststarthook/apiservice-registration-controller',
  '/readyz/poststarthook/apiservice-status-local-available-controller',
  '/readyz/poststarthook/apiservice-status-remote-available-controller',
  '/readyz/poststarthook/bootstrap-controller',
  '/readyz/poststarthook/crd-informer-synced',
  '/readyz/poststarthook/generic-apiserver-start-informers',
  '/readyz/poststarthook/kube-apiserver-autoregistration',
  '/readyz/poststarthook/priority-and-fairness-config-consumer',
  '/readyz/poststarthook/priority-and-fairness-config-producer',
  '/readyz/poststarthook/priority-and-fairness-filter',
  '/readyz/poststarthook/rbac/bootstrap-roles',
  '/readyz/poststarthook/scheduling/bootstrap-system-priority-classes',
  '/readyz/poststarthook/start-apiextensions-controllers',
  '/readyz/poststarthook/start-apiextensions-informers',
  '/readyz/poststarthook/start-apiserver-admission-initializer',
  '/readyz/poststarthook/start-cluster-authentication-info-controller',
  '/readyz/poststarthook/start-kube-aggregator-informers',
  '/readyz/poststarthook/start-kube-apiserver-identity-lease-controller',
  '/readyz/poststarthook/start-kube-apiserver-identity-lease-garbage-collector',
  '/readyz/poststarthook/start-kubernetes-service-cidr-controller',
  '/readyz/poststarthook/start-legacy-token-tracking-controller',
  '/readyz/poststarthook/start-service-ip-repair-controllers',
  '/readyz/poststarthook/start-system-namespaces-controller',
  '/readyz/poststarthook/storage-object-count-tracker-hook',
  '/readyz/shutdown',
  '/version'
]

const createDiscoveryRoot = (): { paths: string[] } => {
  return {
    paths: DISCOVERY_ROOT_PATHS
  }
}

const createNamespacesList = (
  state: ClusterStateData
): {
  kind: 'NamespaceList'
  apiVersion: 'v1'
  metadata: { resourceVersion: string }
  items: Array<{
    metadata: {
      name: string
      resourceVersion: string
      labels: { 'kubernetes.io/metadata.name': string }
    }
    spec: { finalizers: ['kubernetes'] }
    status: { phase: 'Active' }
  }>
} => {
  const namespaces = collectDiscoveredNamespaces(state)
  return {
    kind: 'NamespaceList',
    apiVersion: 'v1',
    metadata: {
      resourceVersion: String(namespaces.length * 10 + 1)
    },
    items: namespaces.map((namespace, index) => {
      return {
        metadata: {
          name: namespace,
          resourceVersion: String(index + 1),
          labels: {
            'kubernetes.io/metadata.name': namespace
          }
        },
        spec: {
          finalizers: ['kubernetes']
        },
        status: {
          phase: 'Active'
        }
      }
    })
  }
}

const createOpenAPIV3Index = () => {
  return {
    paths: {
      'apis/networking.k8s.io/v1': {
        serverRelativeURL: '/openapi/v3/apis/networking.k8s.io/v1'
      },
      'api/v1': {
        serverRelativeURL: '/openapi/v3/api/v1'
      },
      'apis/apps/v1': {
        serverRelativeURL: '/openapi/v3/apis/apps/v1'
      }
    }
  }
}

const createNetworkingOpenAPIPreview = () => {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Kubernetes networking.k8s.io/v1',
      version: 'v1'
    },
    paths: {
      '/apis/networking.k8s.io/v1/ingresses': {},
      '/apis/networking.k8s.io/v1/ingressclasses': {}
    }
  }
}

const createNetworkingAPIResourceList = () => {
  return {
    kind: 'APIResourceList',
    apiVersion: 'v1',
    groupVersion: 'networking.k8s.io/v1',
    resources: [
      {
        name: 'ingressclasses',
        singularName: 'ingressclass',
        namespaced: false,
        kind: 'IngressClass',
        verbs: ['create', 'delete', 'get', 'list', 'patch', 'update', 'watch']
      },
      {
        name: 'ingresses',
        singularName: 'ingress',
        namespaced: true,
        kind: 'Ingress',
        verbs: ['create', 'delete', 'get', 'list', 'patch', 'update', 'watch']
      }
    ]
  }
}

const RAW_GET_HANDLERS: Record<string, RawGetHandler> = {
  '/': () => {
    return createDiscoveryRoot()
  },
  '/api/v1/namespaces': (state) => {
    return createNamespacesList(state)
  },
  '/openapi/v3': () => {
    return createOpenAPIV3Index()
  },
  '/openapi/v3/': () => {
    return createOpenAPIV3Index()
  },
  '/openapi/v3/apis/networking.k8s.io/v1': () => {
    return createNetworkingOpenAPIPreview()
  },
  '/apis/networking.k8s.io/v1': () => {
    return createNetworkingAPIResourceList()
  }
}

export const handleGetRaw = (
  state: ClusterStateData,
  rawPath: string
): string => {
  const handler = RAW_GET_HANDLERS[rawPath]
  if (!handler) {
    return `Error from server (NotFound): the server could not find the requested resource`
  }

  const payload = handler(state)
  if (rawPath === '/') {
    return JSON.stringify(payload, null, 2)
  }
  if (rawPath === '/openapi/v3' || rawPath === '/openapi/v3/') {
    return JSON.stringify(payload, null, 2)
  }
  return JSON.stringify(payload)
}
