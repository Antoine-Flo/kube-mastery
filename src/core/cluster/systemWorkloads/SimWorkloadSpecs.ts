import { buildNodeRoleSlotNames, type ClusterNodeRole } from '../clusterConfig'
import type { Container, PodToleration, Volume } from '../ressources/Pod'

export type SimSystemWorkloadPolicy = 'conformance'

export interface SimSystemWorkloadNode {
  role: ClusterNodeRole
  name: string
}

export interface SimStaticPodWorkloadSpec {
  kind: 'static'
  name: string
  namespace: string
  container: Container
  nodeName: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  volumes?: Volume[]
  tolerations?: PodToleration[]
}

export interface SimDaemonSetWorkloadSpec {
  kind: 'daemonset'
  namespace: string
  name: string
  containerName: string
  labels: Record<string, string>
  selectorLabels: Record<string, string>
  nodeSelector?: Record<string, string>
  tolerations?: PodToleration[]
  annotations?: Record<string, string>
  containerResources?: Container['resources']
}

export interface SimDeploymentWorkloadSpec {
  kind: 'deployment'
  namespace: string
  name: string
  containerName: string
  labels: Record<string, string>
  selectorLabels: Record<string, string>
  replicas: number
  nodeSelector?: Record<string, string>
  tolerations?: PodToleration[]
  annotations?: Record<string, string>
  containerResources?: Container['resources']
}

export type SimSystemWorkloadSpec =
  | SimStaticPodWorkloadSpec
  | SimDaemonSetWorkloadSpec
  | SimDeploymentWorkloadSpec

export interface SimSystemWorkloadSpecsOptions {
  clusterName: string
  nodeRoles: readonly ClusterNodeRole[]
  policy?: SimSystemWorkloadPolicy
}

const buildNodes = (
  clusterName: string,
  nodeRoles: readonly ClusterNodeRole[]
): SimSystemWorkloadNode[] => {
  const roleSlots = buildNodeRoleSlotNames(nodeRoles)
  return roleSlots.map((slotName, index) => {
    return {
      role: nodeRoles[index],
      name: `${clusterName}-${slotName}`
    }
  })
}

const getControlPlaneNodeName = (nodes: SimSystemWorkloadNode[]): string => {
  const controlPlaneNode = nodes.find((node) => {
    return node.role === 'control-plane'
  })
  if (controlPlaneNode != null) {
    return controlPlaneNode.name
  }
  return nodes[0]?.name ?? 'control-plane'
}

const createControlPlaneStaticPodName = (
  controlPlaneNodeName: string,
  componentName: string
): string => {
  return `${componentName}-${controlPlaneNodeName}`
}

const createStaticSpecs = (
  controlPlaneNodeName: string
): SimSystemWorkloadSpec[] => {
  const controlPlaneNoExecuteToleration: PodToleration = {
    operator: 'Exists',
    effect: 'NoExecute'
  }
  const defaultKubeadmStaticAnnotations: Record<string, string> = {
    'kubernetes.io/config.source': 'file',
    'kubernetes.io/config.mirror': '031ded95fb7ad9fb1bf8ff495366fa99',
    'kubernetes.io/config.hash': '031ded95fb7ad9fb1bf8ff495366fa99',
    'kubernetes.io/config.seen': '2026-02-27T21:00:14.277702812Z'
  }
  const certVolumeMounts = [
    {
      name: 'etc-ca-certificates',
      mountPath: '/etc/ca-certificates',
      readOnly: true
    },
    {
      name: 'k8s-certs',
      mountPath: '/etc/kubernetes/pki',
      readOnly: true
    },
    {
      name: 'ca-certs',
      mountPath: '/etc/ssl/certs',
      readOnly: true
    },
    {
      name: 'usr-local-share-ca-certificates',
      mountPath: '/usr/local/share/ca-certificates',
      readOnly: true
    },
    {
      name: 'usr-share-ca-certificates',
      mountPath: '/usr/share/ca-certificates',
      readOnly: true
    }
  ]
  const certHostPathVolumes: Volume[] = [
    {
      name: 'ca-certs',
      source: {
        type: 'hostPath',
        path: '/etc/ssl/certs',
        hostPathType: 'DirectoryOrCreate'
      }
    },
    {
      name: 'etc-ca-certificates',
      source: {
        type: 'hostPath',
        path: '/etc/ca-certificates',
        hostPathType: 'DirectoryOrCreate'
      }
    },
    {
      name: 'k8s-certs',
      source: {
        type: 'hostPath',
        path: '/etc/kubernetes/pki',
        hostPathType: 'DirectoryOrCreate'
      }
    },
    {
      name: 'usr-local-share-ca-certificates',
      source: {
        type: 'hostPath',
        path: '/usr/local/share/ca-certificates',
        hostPathType: 'DirectoryOrCreate'
      }
    },
    {
      name: 'usr-share-ca-certificates',
      source: {
        type: 'hostPath',
        path: '/usr/share/ca-certificates',
        hostPathType: 'DirectoryOrCreate'
      }
    }
  ]
  return [
    {
      kind: 'static',
      name: createControlPlaneStaticPodName(controlPlaneNodeName, 'etcd'),
      namespace: 'kube-system',
      container: {
        name: 'etcd',
        image: 'registry.k8s.io/etcd:3.5.21-0',
        command: ['etcd'],
        args: [
          '--advertise-client-urls=https://127.0.0.1:2379',
          '--listen-client-urls=https://127.0.0.1:2379,https://127.0.0.1:4001',
          '--listen-metrics-urls=http://127.0.0.1:2381',
          '--data-dir=/var/lib/etcd'
        ],
        ports: [{ containerPort: 2381, protocol: 'TCP' }],
        resources: {
          requests: { cpu: '100m' }
        },
        startupProbe: {
          type: 'httpGet',
          path: '/readyz',
          port: 2381,
          initialDelaySeconds: 10,
          periodSeconds: 10
        },
        livenessProbe: {
          type: 'httpGet',
          path: '/livez',
          port: 2381,
          initialDelaySeconds: 10,
          periodSeconds: 10
        },
        volumeMounts: [
          {
            name: 'etcd-data',
            mountPath: '/var/lib/etcd'
          },
          ...certVolumeMounts
        ]
      },
      nodeName: controlPlaneNodeName,
      labels: {
        tier: 'control-plane',
        component: 'etcd'
      },
      annotations: {
        ...defaultKubeadmStaticAnnotations
      },
      volumes: [
        {
          name: 'etcd-data',
          source: {
            type: 'hostPath',
            path: '/var/lib/etcd',
            hostPathType: 'DirectoryOrCreate'
          }
        },
        ...certHostPathVolumes
      ],
      tolerations: [controlPlaneNoExecuteToleration]
    },
    {
      kind: 'static',
      name: createControlPlaneStaticPodName(
        controlPlaneNodeName,
        'kube-apiserver'
      ),
      namespace: 'kube-system',
      container: {
        name: 'kube-apiserver',
        image: 'registry.k8s.io/kube-apiserver:v1.35.0',
        command: ['kube-apiserver'],
        args: [
          '--advertise-address=172.18.0.2',
          '--allow-privileged=true',
          '--authorization-mode=Node,RBAC',
          '--client-ca-file=/etc/kubernetes/pki/ca.crt',
          '--enable-admission-plugins=NodeRestriction',
          '--enable-bootstrap-token-auth=true',
          '--etcd-cafile=/etc/kubernetes/pki/etcd/ca.crt',
          '--etcd-certfile=/etc/kubernetes/pki/apiserver-etcd-client.crt',
          '--etcd-keyfile=/etc/kubernetes/pki/apiserver-etcd-client.key',
          '--etcd-servers=https://127.0.0.1:2379',
          '--kubelet-client-certificate=/etc/kubernetes/pki/apiserver-kubelet-client.crt',
          '--kubelet-client-key=/etc/kubernetes/pki/apiserver-kubelet-client.key',
          '--kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname',
          '--proxy-client-cert-file=/etc/kubernetes/pki/front-proxy-client.crt',
          '--proxy-client-key-file=/etc/kubernetes/pki/front-proxy-client.key',
          '--requestheader-allowed-names=front-proxy-client',
          '--requestheader-client-ca-file=/etc/kubernetes/pki/front-proxy-ca.crt',
          '--requestheader-extra-headers-prefix=X-Remote-Extra-',
          '--requestheader-group-headers=X-Remote-Group',
          '--requestheader-username-headers=X-Remote-User',
          '--runtime-config=',
          '--secure-port=6443',
          '--service-account-issuer=https://kubernetes.default.svc.cluster.local',
          '--service-account-key-file=/etc/kubernetes/pki/sa.pub',
          '--service-account-signing-key-file=/etc/kubernetes/pki/sa.key',
          '--service-cluster-ip-range=10.96.0.0/16',
          '--tls-cert-file=/etc/kubernetes/pki/apiserver.crt',
          '--tls-private-key-file=/etc/kubernetes/pki/apiserver.key'
        ],
        ports: [{ containerPort: 6443, protocol: 'TCP' }],
        resources: {
          requests: { cpu: '250m' }
        },
        startupProbe: {
          type: 'httpGet',
          path: '/livez',
          port: 6443,
          initialDelaySeconds: 10,
          periodSeconds: 10
        },
        livenessProbe: {
          type: 'httpGet',
          path: '/livez',
          port: 6443,
          initialDelaySeconds: 10,
          periodSeconds: 10
        },
        readinessProbe: {
          type: 'httpGet',
          path: '/readyz',
          port: 6443,
          initialDelaySeconds: 0,
          periodSeconds: 1
        },
        volumeMounts: certVolumeMounts
      },
      nodeName: controlPlaneNodeName,
      labels: {
        tier: 'control-plane',
        component: 'kube-apiserver'
      },
      annotations: {
        ...defaultKubeadmStaticAnnotations,
        'kubeadm.kubernetes.io/kube-apiserver.advertise-address.endpoint':
          '172.18.0.2:6443'
      },
      volumes: certHostPathVolumes,
      tolerations: [controlPlaneNoExecuteToleration]
    },
    {
      kind: 'static',
      name: createControlPlaneStaticPodName(
        controlPlaneNodeName,
        'kube-controller-manager'
      ),
      namespace: 'kube-system',
      container: {
        name: 'kube-controller-manager',
        image: 'registry.k8s.io/kube-controller-manager:v1.35.0',
        command: ['kube-controller-manager'],
        args: [
          '--allocate-node-cidrs=true',
          '--cluster-cidr=10.244.0.0/16',
          '--leader-elect=true'
        ],
        ports: [{ containerPort: 10257, protocol: 'TCP' }],
        resources: {
          requests: { cpu: '200m' }
        },
        startupProbe: {
          type: 'httpGet',
          path: '/healthz',
          port: 10257,
          initialDelaySeconds: 10,
          periodSeconds: 10
        },
        livenessProbe: {
          type: 'httpGet',
          path: '/healthz',
          port: 10257,
          initialDelaySeconds: 10,
          periodSeconds: 10
        },
        readinessProbe: {
          type: 'httpGet',
          path: '/healthz',
          port: 10257,
          initialDelaySeconds: 0,
          periodSeconds: 1
        },
        volumeMounts: certVolumeMounts
      },
      nodeName: controlPlaneNodeName,
      labels: {
        tier: 'control-plane',
        component: 'kube-controller-manager'
      },
      annotations: {
        ...defaultKubeadmStaticAnnotations
      },
      volumes: certHostPathVolumes,
      tolerations: [controlPlaneNoExecuteToleration]
    },
    {
      kind: 'static',
      name: createControlPlaneStaticPodName(
        controlPlaneNodeName,
        'kube-scheduler'
      ),
      namespace: 'kube-system',
      container: {
        name: 'kube-scheduler',
        image: 'registry.k8s.io/kube-scheduler:v1.35.0',
        command: ['kube-scheduler'],
        args: ['--leader-elect=true'],
        ports: [{ containerPort: 10259, protocol: 'TCP' }],
        resources: {
          requests: { cpu: '100m' }
        },
        startupProbe: {
          type: 'httpGet',
          path: '/healthz',
          port: 10259,
          initialDelaySeconds: 10,
          periodSeconds: 10
        },
        livenessProbe: {
          type: 'httpGet',
          path: '/healthz',
          port: 10259,
          initialDelaySeconds: 10,
          periodSeconds: 10
        },
        readinessProbe: {
          type: 'httpGet',
          path: '/healthz',
          port: 10259,
          initialDelaySeconds: 0,
          periodSeconds: 1
        },
        volumeMounts: certVolumeMounts
      },
      nodeName: controlPlaneNodeName,
      labels: {
        tier: 'control-plane',
        component: 'kube-scheduler'
      },
      annotations: {
        ...defaultKubeadmStaticAnnotations
      },
      volumes: certHostPathVolumes,
      tolerations: [controlPlaneNoExecuteToleration]
    }
  ]
}

const createDaemonSetSpecs = (): SimSystemWorkloadSpec[] => {
  const controlPlaneToleration: PodToleration = {
    key: 'node-role.kubernetes.io/control-plane',
    operator: 'Exists',
    effect: 'NoSchedule'
  }
  return [
    {
      kind: 'daemonset',
      name: 'kindnet',
      namespace: 'kube-system',
      containerName: 'kindnet',
      labels: { 'k8s-app': 'kindnet' },
      selectorLabels: { 'k8s-app': 'kindnet' },
      nodeSelector: { 'kubernetes.io/os': 'linux' },
      tolerations: [controlPlaneToleration],
      containerResources: {
        requests: {
          cpu: '100m',
          memory: '50Mi'
        },
        limits: {
          cpu: '100m',
          memory: '50Mi'
        }
      }
    },
    {
      kind: 'daemonset',
      name: 'kube-proxy',
      namespace: 'kube-system',
      containerName: 'kube-proxy',
      labels: { 'k8s-app': 'kube-proxy' },
      selectorLabels: { 'k8s-app': 'kube-proxy' },
      nodeSelector: { 'kubernetes.io/os': 'linux' },
      tolerations: [controlPlaneToleration]
    }
  ]
}

const createDeploymentSpecs = (
  controlPlaneNodeName: string,
  policy: SimSystemWorkloadPolicy
): SimSystemWorkloadSpec[] => {
  if (policy === 'conformance') {
    return [
      {
        kind: 'deployment',
        name: 'coredns',
        namespace: 'kube-system',
        containerName: 'coredns',
        labels: { 'k8s-app': 'kube-dns' },
        selectorLabels: { 'k8s-app': 'kube-dns' },
        replicas: 2,
        nodeSelector: {
          'node-role.kubernetes.io/control-plane': ''
        },
        tolerations: [
          {
            key: 'node-role.kubernetes.io/control-plane',
            operator: 'Exists',
            effect: 'NoSchedule'
          }
        ],
        annotations: {
          'sim.kubernetes.io/preferred-node': controlPlaneNodeName
        },
        containerResources: {
          requests: {
            cpu: '100m',
            memory: '70Mi'
          },
          limits: {
            memory: '170Mi'
          }
        }
      }
    ]
  }
  return []
}

const createStorageSpecs = (
  controlPlaneNodeName: string
): SimSystemWorkloadSpec[] => {
  return [
    {
      kind: 'deployment',
      name: 'local-path-provisioner',
      namespace: 'local-path-storage',
      containerName: 'local-path-provisioner',
      labels: { app: 'local-path-provisioner' },
      selectorLabels: { app: 'local-path-provisioner' },
      replicas: 1,
      nodeSelector: {
        'node-role.kubernetes.io/control-plane': ''
      },
      tolerations: [
        {
          key: 'node-role.kubernetes.io/control-plane',
          operator: 'Exists',
          effect: 'NoSchedule'
        }
      ],
      annotations: {
        'sim.kubernetes.io/preferred-node': controlPlaneNodeName
      }
    }
  ]
}

export const createSimSystemWorkloadSpecs = (
  options: SimSystemWorkloadSpecsOptions
): SimSystemWorkloadSpec[] => {
  const policy = options.policy ?? 'conformance'
  const nodes = buildNodes(options.clusterName, options.nodeRoles)
  const controlPlaneNodeName = getControlPlaneNodeName(nodes)
  return [
    ...createStaticSpecs(controlPlaneNodeName),
    ...createDaemonSetSpecs(),
    ...createDeploymentSpecs(controlPlaneNodeName, policy),
    ...createStorageSpecs(controlPlaneNodeName)
  ]
}
