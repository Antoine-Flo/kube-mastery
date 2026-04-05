import type { ClusterState } from './ClusterState'
import {
  buildNodeRoleSlotNames,
  DEFAULT_CLUSTER_NODE_ROLES,
  type ClusterNodeRole
} from './clusterConfig'
import { CONFIG } from '../../config'
import { getSystemWorkloads } from './systemPods'
import type { ConfigMap } from './ressources/ConfigMap'
import { createConfigMap } from './ressources/ConfigMap'
import type { DaemonSet } from './ressources/DaemonSet'
import type { Endpoints } from './ressources/Endpoints'
import { createEndpoints } from './ressources/Endpoints'
import type { Lease } from './ressources/Lease'
import { createLease } from './ressources/Lease'
import type { Node, NodeCondition } from './ressources/Node'
import { createNode } from './ressources/Node'
import type { Namespace } from './ressources/Namespace'
import type { Deployment } from './ressources/Deployment'
import type { Pod } from './ressources/Pod'
import type { Service } from './ressources/Service'
import { createService } from './ressources/Service'
import type { StorageClass } from './ressources/StorageClass'
import { createStorageClass } from './ressources/StorageClass'
import { createSystemNamespaces, isSystemNamespace } from './systemNamespaces'

export interface SystemBootstrapOptions {
  clusterName?: string
  clock?: () => string
  nodeRoles?: readonly ClusterNodeRole[]
}

export type ClusterBootstrapProfile = 'kind-like' | 'none'

export type ClusterBootstrapMode = 'always' | 'missing-only' | 'never'

export interface ClusterBootstrapConfig extends SystemBootstrapOptions {
  profile?: ClusterBootstrapProfile
  mode?: ClusterBootstrapMode
}

export interface SystemBootstrapResources {
  namespaces: Namespace[]
  nodes: Node[]
  configMaps: ConfigMap[]
  services: Service[]
  endpoints: Endpoints[]
  pods: Pod[]
  staticPods: Pod[]
  deployments: Deployment[]
  daemonSets: DaemonSet[]
  leases: Lease[]
  storageClasses: StorageClass[]
}

const DEFAULT_CLUSTER_NAME = 'conformance'

export const DEFAULT_KIND_LIKE_BOOTSTRAP: Readonly<
  Pick<ClusterBootstrapConfig, 'profile' | 'mode'>
> = Object.freeze({
  profile: 'kind-like',
  mode: 'missing-only'
})

export const createSimulatorBootstrapConfig = (): ClusterBootstrapConfig => {
  return {
    ...DEFAULT_KIND_LIKE_BOOTSTRAP,
    clusterName: CONFIG.cluster.simulatorClusterName,
    nodeRoles: DEFAULT_CLUSTER_NODE_ROLES
  }
}

export const createConformanceBootstrapConfig = (
  clusterName = CONFIG.cluster.conformanceClusterName,
  nodeRoles: readonly ClusterNodeRole[] = DEFAULT_CLUSTER_NODE_ROLES
): ClusterBootstrapConfig => {
  return {
    ...DEFAULT_KIND_LIKE_BOOTSTRAP,
    clusterName,
    nodeRoles
  }
}

const createReadyCondition = (): NodeCondition => {
  return {
    type: 'Ready',
    status: 'True'
  }
}

const createNodeConditions = (creationTimestamp: string): NodeCondition[] => {
  return [
    {
      type: 'MemoryPressure',
      status: 'False',
      lastHeartbeatTime: creationTimestamp,
      lastTransitionTime: creationTimestamp,
      reason: 'KubeletHasSufficientMemory',
      message: 'kubelet has sufficient memory available'
    },
    {
      type: 'DiskPressure',
      status: 'False',
      lastHeartbeatTime: creationTimestamp,
      lastTransitionTime: creationTimestamp,
      reason: 'KubeletHasNoDiskPressure',
      message: 'kubelet has no disk pressure'
    },
    {
      type: 'PIDPressure',
      status: 'False',
      lastHeartbeatTime: creationTimestamp,
      lastTransitionTime: creationTimestamp,
      reason: 'KubeletHasSufficientPID',
      message: 'kubelet has sufficient PID available'
    },
    {
      ...createReadyCondition(),
      lastHeartbeatTime: creationTimestamp,
      lastTransitionTime: creationTimestamp,
      reason: 'KubeletReady',
      message: 'kubelet is posting ready status'
    }
  ]
}

const createNodeInternalIP = (nodeIndex: number): string => {
  return `172.18.0.${nodeIndex + 2}`
}

const createNodeLabels = (
  role: ClusterNodeRole,
  nodeName: string
): Record<string, string> => {
  const baseLabels: Record<string, string> = {
    'beta.kubernetes.io/arch': 'amd64',
    'beta.kubernetes.io/os': 'linux',
    'kubernetes.io/arch': 'amd64',
    'kubernetes.io/hostname': nodeName,
    'kubernetes.io/os': 'linux'
  }
  if (role === 'control-plane') {
    return {
      ...baseLabels,
      'node-role.kubernetes.io/control-plane': '',
      'node.kubernetes.io/exclude-from-external-load-balancers': ''
    }
  }
  return baseLabels
}

const createNodeAnnotations = (): Record<string, string> => {
  return {
    'node.alpha.kubernetes.io/ttl': '0',
    'volumes.kubernetes.io/controller-managed-attach-detach': 'true'
  }
}

const createNodeCapacity = (): Record<string, string> => {
  return {
    cpu: '24',
    'ephemeral-storage': '951220Mi',
    'hugepages-1Gi': '0',
    'hugepages-2Mi': '0',
    memory: '49157748Ki',
    pods: '110'
  }
}

const createNodePodCIDR = (nodeIndex: number): string => {
  return `10.244.${nodeIndex}.0/24`
}

const stableHex = (seed: string, length: number): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index++) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0')
  let output = ''
  while (output.length < length) {
    output = `${output}${hex}`
  }
  return output.slice(0, length)
}

const createMachineID = (clusterName: string, nodeName: string): string => {
  return stableHex(`${clusterName}/${nodeName}/machine-id`, 32)
}

const createSystemUUID = (clusterName: string, nodeName: string): string => {
  const raw = stableHex(`${clusterName}/${nodeName}/system-uuid`, 32)
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20, 32)}`
}

const createBootstrapNode = (
  clusterName: string,
  role: ClusterNodeRole,
  roleSlotName: string,
  nodeIndex: number,
  creationTimestamp: string
): Node => {
  const nodeName = `${clusterName}-${roleSlotName}`
  const spec =
    role === 'control-plane'
      ? {
          taints: [
            {
              key: 'node-role.kubernetes.io/control-plane',
              effect: 'NoSchedule' as const
            }
          ]
        }
      : {}

  return createNode({
    name: nodeName,
    labels: createNodeLabels(role, nodeName),
    annotations: createNodeAnnotations(),
    creationTimestamp,
    spec: {
      ...spec,
      podCIDR: createNodePodCIDR(nodeIndex),
      podCIDRs: [createNodePodCIDR(nodeIndex)],
      providerID: `kind://docker/${clusterName}/${nodeName}`
    },
    status: {
      addresses: [
        {
          type: 'InternalIP',
          address: createNodeInternalIP(nodeIndex)
        },
        {
          type: 'Hostname',
          address: nodeName
        }
      ],
      capacity: createNodeCapacity(),
      allocatable: createNodeCapacity(),
      conditions: createNodeConditions(creationTimestamp),
      nodeInfo: {
        architecture: 'amd64',
        bootID: 'bf73921b-7ffd-4fd6-8b89-3e87a95e957c',
        containerRuntimeVersion: 'containerd://2.2.0',
        kernelVersion: '6.18.9-200.fc43.x86_64',
        kubeProxyVersion: '',
        kubeletVersion: 'v1.35.0',
        machineID: createMachineID(clusterName, nodeName),
        operatingSystem: 'linux',
        osImage: 'Debian GNU/Linux 12 (bookworm)',
        systemUUID: createSystemUUID(clusterName, nodeName)
      }
    }
  })
}

const createKubeRootCAConfigMap = (creationTimestamp: string): ConfigMap => {
  return createConfigMap({
    name: 'kube-root-ca.crt',
    namespace: 'default',
    creationTimestamp,
    data: {
      'ca.crt':
        '-----BEGIN CERTIFICATE-----\nSIMULATED-CA\n-----END CERTIFICATE-----'
    }
  })
}

const buildKubeconfigIdentity = (clusterName: string): string => {
  const normalizedName = clusterName.trim().toLowerCase()
  if (normalizedName.length === 0) {
    return 'kind-sim'
  }
  return `kind-${normalizedName}`
}

const DEFAULT_KUBECONFIG_CA_DATA =
  'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURCVENDQWUyZ0F3SUJBZ0lJREVkbnNIcXJqVGd3RFFZSktvWklodmNOQVFFTEJRQXdGVEVUTUJFR0ExVUUKQXhNS2EzVmlaWEp1WlhSbGN6QWVGdzB5TmpBeU1qY3lNRFUxTURkYUZ3MHpOakF5TWpVeU1UQXdNRGRhTUJVeApFekFSQmdOVkJBTVRDbXQxWW1WeWJtVjBaWE13Z2dFaU1BMEdDU3FHU0liM0RRRUJBUVVBQTRJQkR3QXdnZ0VLCkFvSUJBUURLdVA3YWtFd0VVclczRU1iUGtMbVVnNTNnVDZScVNQRFZ4bXQrMHRTRDdGWXMxRWRieWpOaFNvckoKNmw3dTE2L2pYVE0rWVhWRG1PaVZNUGM0TmtHdmc2WmJpZlo5RE9zUkhwdks4YS90K3lXVWExMGRVV1ZOd2dJVgp3b2c0MUxaeUd2bVJYcW5iNDVmbHRPOFlGT1ZNVithQzhaTnRYdFY5TUtWd3J6eStQZW5hd1lrcTJFS3FyZ25TCk5UT0VMTHhEMmpzZE5qSlBwZlUzSExqVjdrZ3hsUyttQnRmdE03bEk1K1hEb1ZHZjFhYVVrNE5xSEtkTkFmWGsKeG1mN3NJNnk1TXRzb0VkYjFYZ2VTOU1FTkJ2b2N5NXoyRTMySGV1SWhqYUIrVk5mN0J0K3hzbi9ra2lCZFl2NwpjR2FFaWNid2pwNmI2YlZLWjc0OFZTQVc4eEpKQWdNQkFBR2pXVEJYTUE0R0ExVWREd0VCL3dRRUF3SUNwREFQCkJnTlZIUk1CQWY4RUJUQURBUUgvTUIwR0ExVWREZ1FXQkJRLytFZkhNcmJpenJGT09vTFNUeUlWcVpQdy9qQVYKQmdOVkhSRUVEakFNZ2dwcmRXSmxjbTVsZEdWek1BMEdDU3FHU0liM0RRRUJDd1VBQTRJQkFRQ0YzeWRMVFdCUApNcTB6TDNyTFJ2MmRybDI2L1AzbDF4MWV4dmh0RHVsR1dmMGpqVm5ZTkl3WGtuUVIxbWRDa1RkZkhHODRDd2hVCjkrOUgvbWl6Zi9BQk52L0NDd1MzWFd0VFNiUnhnZFIycEhLbWVmNFBmTnhvYUkzcFkzSUVVYVN3UERsSjlEQzYKTWNtVjdUK1VjQzJSYkJvdVVGMkVuTFZqRTN6Q1dvU09tVjFXNmZRc01iVmJzbVV6M2laQkRtOUtQaHRLdmlQOQpZZjVMdDUwVVFrWWJkOExWalpXTStFZ09jRWJ3c0FhSWY1WnlreFhFNm9IWGNNV2EzR0pVL0J3dGJ1YkJUWEZQClcvdTJHUDd4cnFJdlF6QStkWjBQWFRtWlFXbEVSU28vSDFiTisySTJsZmxHRVVYOFVRWHBHbWFWTjl5OTRNY1UKTjAvTEpRTEVVT3B6Ci0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0K'
const DEFAULT_KUBECONFIG_CLIENT_CERT_DATA =
  'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSURLVENDQWhHZ0F3SUJBZ0lJQnRoRzUrZEQxTll3RFFZSktvWklodmNOQVFFTEJRQXdGVEVUTUJFR0ExVUUKQXhNS2EzVmlaWEp1WlhSbGN6QWVGdzB5TmpBeU1qY3lNRFUxTURkYUZ3MHlOekF5TWpjeU1UQXdNRGRhTUR3eApIekFkQmdOVkJBb1RGbXQxWW1WaFpHMDZZMngxYzNSbGNpMWhaRzFwYm5NeEdUQVhCZ05WQkFNVEVHdDFZbVZ5CmJtVjBaWE10WVdSdGFXNHdnZ0VpTUEwR0NTcUdTSWIzRFFFQkFRVUFBNElCRHdBd2dnRUtBb0lCQVFDc1h5NEsKQmpiOEJ6ZDAzeEF6WGYvbkJuUHR0dXlKZ2h4NWh3UFN5dkk0RFNPZUU2UWpJU3pMdFVLSnRwVHVGZnBqOUwyYQp4RGoxeXpQS3cvanU0KzV1VTY3MWgxeUd6aVExVVV3dHdLTURDTVNDd3RydG9oc2ptK01CTzRDSnFIV3BEdmo2CnpwWWtMa0IzbmRkQkIvcm53YXh5TktTdUZUNHdEUCtlcWJ5TXNIekxQa094SlpwcXkva2huVy8reUliTklPV2QKVFIxQm8rY1NnUExJdHIwd0JVNzFMOFNUZXdYbmFNUjFTYm5LamQzT216WGN1NEJ4Z3pDNUZTd3RsWmJvY0liNwo4MDVXUXozWkttdm9YS1crSGVSU2JURnUwbTNSdUxGS2hnMW92MVo4cUpkTW5qcStNUnU5Q0t4RWp1ai9kWmRtCkhicWVaeWc0RmUzUmFmYzdBZ01CQUFHalZqQlVNQTRHQTFVZER3RUIvd1FFQXdJRm9EQVRCZ05WSFNVRUREQUsKQmdnckJnRUZCUWNEQWpBTUJnTlZIUk1CQWY4RUFqQUFNQjhHQTFVZEl3UVlNQmFBRkQvNFI4Y3l0dUxPc1U0NgpndEpQSWhXcGsvRCtNQTBHQ1NxR1NJYjNEUUVCQ3dVQUE0SUJBUUNkK0Z2dXJZbnh2V2hiS0ZHTGRuOXE5elNvCmV5V1I0VUM1TnFPbkN0cjJCTkt5RmNsVExpYU4rUlhEejdGUThCQU1lTGlPYTZXZmkzaFpOK095WWkwSTJkWU0KemdpZGhlUWRuTHdFUGxtdVRtUVBod055RU9yWkhXaXErQmFvY0V3aWk1Tm5oenlYVGIyQ0s4ZjlZeitiUjVkdQpBMWxQbkZ2bHkvUVBqc0NMdzkyRVhvdG01N1N0QWQwVEIvZkJWSWhhR0E4a1MydjJkUlBqYjlZVlhadDBPbm9tCnhMMUNKRUd1NnFRdEh1Y1JpQkhtcE9VdFgzYXNYN2lDaGhadUVrbTg1dUV2dVdXSUpScjJzYzYzRCtTelByTy8KelBTL1NaVEVwcUcrMmtrUXJPdUJEb0drWTB3RTBLNFJKcTBrVXAxK0ZMbVdBbnZuZnVBQjJPcXlwUDZBCi0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0K'
const DEFAULT_KUBECONFIG_CLIENT_KEY_DATA =
  'LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFcEFJQkFBS0NBUUVBckY4dUNnWTIvQWMzZE44UU0xMy81d1p6N2Jic2lZSWNlWWNEMHNyeU9BMGpuaE9rCkl5RXN5N1ZDaWJhVTdoWDZZL1M5bXNRNDljc3p5c1A0N3VQdWJsT3U5WWRjaHM0a05WRk1MY0NqQXdqRWdzTGEKN2FJYkk1dmpBVHVBaWFoMXFRNzQrczZXSkM1QWQ1M1hRUWY2NThHc2NqU2tyaFUrTUF6L25xbThqTEI4eXo1RApzU1dhYXN2NUlaMXYvc2lHelNEbG5VMGRRYVBuRW9EeXlMYTlNQVZPOVMvRWszc0Y1MmpFZFVtNXlvM2R6cHMxCjNMdUFjWU13dVJVc0xaV1c2SENHKy9OT1ZrTTkyU3ByNkZ5bHZoM2tVbTB4YnRKdDBiaXhTb1lOYUw5V2ZLaVgKVEo0NnZqRWJ2UWlzUkk3by8zV1haaDI2bm1jb09CWHQwV24zT3dJREFRQUJBb0lCQUFxVVRqNFNtRDRBV2czKwpsdFJLN2xHSlJZVGtna0N2cEtjWGUwdVh1eVZuaTdVVnN0cnVjVkptRGU4U2hBZUNLbnV5RExwbFZWMmpSWFYvCmNRQXdnSFRJWEJKT1p0dTdPK0VETVZxKzJsZkMvNm4xamFiM2JtcFJhZ01CcjVKRFdFZ0hyRGtGMlpTS080TmIKN2xjeEhJYlc0elQxNHRtYkROVzVlOWcxY0x0dHRuWmRweE5qeHNLU2N4NU40eVpUVXl6blVpNVhNZHBNVEpVVApDcEFmMjBSY1p2RndNQmxUVUZyOXNqblY3djBlM2tBSGFIMVNJbjhucXlYYXFGTjBCbWVZQzd4STZTTmRxQmp3CmdjSGRPNmJqUnhqNHRNWlZkVTVkamVuNUQ4b2xIOW40UzdhK1gxZ0JkSjBOUWlGdEtyeEZ2NzhGaFpFRDhsQm4KZXhkakhza0NnWUVBenEwb0gxQWZnbm8vZ09ueEtiOWlNbWNTa0d6WGhRRkk1allJa2w4UmlaRkRIQktLRHJqTgp3SXZ1Vy80TWt2SHRnOGVPM3ZUdXpxZDRtdFFhOEQxN3M1NzdvZHl5a05Ua3V0aTY2b2RaYzdqcUt5U0pFWHNvCjB1T0d3V1NPZ242WklXdlpjZVNsNnN0Y0F6MlR2c0V0MHZXL2F1WlBGMVVJRHRyUlBzQmdEK2NDZ1lFQTFZSXgKTkpXZitnd0NOZS9HZlFMTkVBME1sbmZDaDJBYXdFZlIvWG9sSDZvUTR2cWlER1pFQmVKYjdnQTJsaGYyUDVSQgpSN0MvNmR6cGZnUUJpck9qT0lnSWQwcjA5SG9LdWROUXcxclc3ZlNOaHVKV0VKeGtFSU81K0dvUzF4QWJyMWVkCmRiT3puT25Pd1daVFJQVzFZandzRmNBU084UW0yOUdmcjNUeWc0MENnWUVBcFFMaFJ1YnMwWHNUV3JUdHhIdzIKUmJHL3c2bnpCUkY2aDd0YWFxc1cwSFEzVmFHRHNxOWdMenhKNmc3VE1UdVJmQ2FIYm9HMmJTNk8vMmNidnZZSAozdWl2VlpOa3luZi95eUtoVWdFUXJYRlZIVzhGTlB6VklsTmcwdVdiVnBzSFhnVEN6c2xVb3pzTVV0WUdNVVlCCmRTNmFUeHBreVdjdGtOYXFPK1RTamI4Q2dZRUFpc3BKQmkvRmdKdlJ6QklENnp1bzVhZzE2SklOS0VjMjNJdFQKVy96TXFScTZRM0k5YU9ZSmpmR3BaTHRLd0tMdTlrRi9kZ1RWbkVaNG1ld3N2R2N0MFEvTXdROCswTFdNeDJNdwpldTFRRGZzTkRRT1FndGZHekYxMHhLRGZnbUg4UFMwdE5GZ09pQkFNMFBlZFpaUjd4bEhyTG5CZTZlOEdlNXAyCnZXMitQL2tDZ1lCN3JQMGszZXowb0svbFo5RlRreUN0VFozaWFqMzg2OEYzWjhQVjBZc05ab1pDWWN5QnA2bzIKN0dZSXJ1ekpPRU5RdnJCWHFNZUd6a3dKSXI1RlZMdE9vOHMvNDNPMzk5TkVScUdha0NGT29RUnY1eHVyVWFUcAowN3ZUYjNuWE5nQkhzTVZFT1FSbzhEeit4M2t3MW1yNU9MTzZZZjNZRDVzSkZCYURRYWNqVWc9PQotLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQo='

export const createBootstrapKubeconfig = (clusterName: string): string => {
  const kubeconfigIdentity = buildKubeconfigIdentity(clusterName)
  return [
    'apiVersion: v1',
    'kind: Config',
    'clusters:',
    '- cluster:',
    `    certificate-authority-data: ${DEFAULT_KUBECONFIG_CA_DATA}`,
    `    server: ${CONFIG.cluster.kubeconfigServerUrl}`,
    `  name: ${kubeconfigIdentity}`,
    'contexts:',
    '- context:',
    `    cluster: ${kubeconfigIdentity}`,
    `    user: ${kubeconfigIdentity}`,
    `  name: ${kubeconfigIdentity}`,
    `current-context: ${kubeconfigIdentity}`,
    'users:',
    `- name: ${kubeconfigIdentity}`,
    '  user:',
    `    client-certificate-data: ${DEFAULT_KUBECONFIG_CLIENT_CERT_DATA}`,
    `    client-key-data: ${DEFAULT_KUBECONFIG_CLIENT_KEY_DATA}`
  ].join('\n')
}

const createClusterInfoConfigMap = (
  creationTimestamp: string,
  clusterName: string
): ConfigMap => {
  return createConfigMap({
    name: 'cluster-info',
    namespace: 'kube-public',
    creationTimestamp,
    data: {
      kubeconfig: createBootstrapKubeconfig(clusterName)
    }
  })
}

const createCoreDnsConfigMap = (creationTimestamp: string): ConfigMap => {
  const corefile = [
    '.:53 {',
    '    errors',
    '    health {',
    '       lameduck 5s',
    '    }',
    '    ready',
    '    kubernetes cluster.local in-addr.arpa ip6.arpa {',
    '       pods insecure',
    '       fallthrough in-addr.arpa ip6.arpa',
    '       ttl 30',
    '    }',
    '    prometheus :9153',
    '    forward . /etc/resolv.conf {',
    '       max_concurrent 1000',
    '    }',
    '    cache 30 {',
    '       disable success cluster.local',
    '       disable denial cluster.local',
    '    }',
    '    loop',
    '    reload',
    '    loadbalance',
    '}'
  ].join('\n')
  return createConfigMap({
    name: 'coredns',
    namespace: 'kube-system',
    creationTimestamp,
    data: {
      Corefile: corefile
    }
  })
}

const createSystemServices = (creationTimestamp: string): Service[] => {
  return [
    createService({
      name: 'kubernetes',
      namespace: 'default',
      creationTimestamp,
      labels: {
        component: 'apiserver',
        provider: 'kubernetes'
      },
      clusterIP: '10.96.0.1',
      ports: [{ name: 'https', port: 443, protocol: 'TCP', targetPort: 6443 }]
    }),
    createService({
      name: 'kube-dns',
      namespace: 'kube-system',
      creationTimestamp,
      clusterIP: '10.96.0.10',
      ports: [
        { name: 'dns', port: 53, protocol: 'UDP', targetPort: 53 },
        { name: 'dns-tcp', port: 53, protocol: 'TCP', targetPort: 53 },
        { name: 'metrics', port: 9153, protocol: 'TCP', targetPort: 9153 }
      ]
    })
  ]
}

const createSystemEndpoints = (creationTimestamp: string): Endpoints[] => {
  return [
    createEndpoints({
      name: 'kubernetes',
      namespace: 'default',
      creationTimestamp,
      subsets: [
        {
          addresses: [{ ip: createNodeInternalIP(0) }],
          ports: [{ name: 'https', port: 6443, protocol: 'TCP' }]
        }
      ]
    })
  ]
}

const createDefaultStorageClass = (creationTimestamp: string): StorageClass => {
  const defaultStorageClassManifest = JSON.stringify({
    apiVersion: 'storage.k8s.io/v1',
    kind: 'StorageClass',
    metadata: {
      annotations: {
        'storageclass.kubernetes.io/is-default-class': 'true'
      },
      name: 'standard'
    },
    provisioner: 'rancher.io/local-path',
    reclaimPolicy: 'Delete',
    volumeBindingMode: 'WaitForFirstConsumer'
  })
  return createStorageClass({
    name: 'standard',
    creationTimestamp,
    annotations: {
      'kubectl.kubernetes.io/last-applied-configuration':
        defaultStorageClassManifest,
      'storageclass.kubernetes.io/is-default-class': 'true'
    },
    spec: {
      provisioner: 'rancher.io/local-path',
      reclaimPolicy: 'Delete',
      volumeBindingMode: 'WaitForFirstConsumer'
    }
  })
}

const createBootstrapLease = (node: Node, creationTimestamp: string): Lease => {
  return createLease({
    name: node.metadata.name,
    namespace: 'kube-node-lease',
    creationTimestamp,
    spec: {
      holderIdentity: node.metadata.name,
      leaseDurationSeconds: 40,
      renewTime: creationTimestamp
    },
    ownerReferences: [
      {
        apiVersion: 'v1',
        kind: 'Node',
        name: node.metadata.name,
        uid: node.metadata.uid || ''
      }
    ]
  })
}

export const createSystemBootstrapResources = (
  options: SystemBootstrapOptions = {}
): SystemBootstrapResources => {
  const clusterName = options.clusterName ?? DEFAULT_CLUSTER_NAME
  const nodeRoles = options.nodeRoles ?? DEFAULT_CLUSTER_NODE_ROLES
  const roleSlotNames = buildNodeRoleSlotNames(nodeRoles)
  const creationTimestamp =
    options.clock != null ? options.clock() : new Date().toISOString()
  const workloads = getSystemWorkloads({
    clusterName,
    nodeRoles,
    clock: () => creationTimestamp
  })

  const nodes = nodeRoles.map((role, index) => {
    return createBootstrapNode(
      clusterName,
      role,
      roleSlotNames[index],
      index,
      creationTimestamp
    )
  })

  return {
    namespaces: createSystemNamespaces(creationTimestamp),
    nodes,
    configMaps: [
      createKubeRootCAConfigMap(creationTimestamp),
      createClusterInfoConfigMap(creationTimestamp, clusterName),
      createCoreDnsConfigMap(creationTimestamp)
    ],
    services: createSystemServices(creationTimestamp),
    endpoints: createSystemEndpoints(creationTimestamp),
    pods: workloads.staticPods,
    staticPods: workloads.staticPods,
    deployments: workloads.deployments,
    daemonSets: workloads.daemonSets,
    leases: nodes.map((node) => createBootstrapLease(node, creationTimestamp)),
    storageClasses: [createDefaultStorageClass(creationTimestamp)]
  }
}

const isSystemPodNamespace = (namespace: string): boolean => {
  return isSystemNamespace(namespace)
}

type BootstrapKind =
  | 'Namespace'
  | 'Node'
  | 'ConfigMap'
  | 'Service'
  | 'Endpoints'
  | 'Deployment'
  | 'DaemonSet'
  | 'Pod'
  | 'Lease'
  | 'StorageClass'

interface BootstrapResource {
  metadata: {
    name: string
    namespace?: string
  }
}

type BootstrapResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: string
    }

interface BootstrapStore {
  findByKind: (
    kind: BootstrapKind,
    name: string,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  listByKind: (
    kind: BootstrapKind,
    namespace?: string
  ) => readonly BootstrapResource[]
  createByKind: (
    kind: BootstrapKind,
    resource: BootstrapResource,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  updateByKind: (
    kind: BootstrapKind,
    name: string,
    resource: BootstrapResource,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  deleteByKind: (
    kind: BootstrapKind,
    name: string,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
}

export interface BootstrapApiLike {
  findResource: (
    kind: BootstrapKind,
    name: string,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  listResources: (
    kind: BootstrapKind,
    namespace?: string
  ) => readonly BootstrapResource[]
  createResource: (
    kind: BootstrapKind,
    resource: BootstrapResource,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  updateResource: (
    kind: BootstrapKind,
    name: string,
    resource: BootstrapResource,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  deleteResource: (
    kind: BootstrapKind,
    name: string,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
}

const assertBootstrapWriteResult = <T>(
  result: BootstrapResult<T>,
  operation: string
): void => {
  if (result.ok) {
    return
  }
  throw new Error(`Bootstrap ${operation} failed: ${result.error}`)
}

const createBootstrapStoreFromClusterState = (
  clusterState: ClusterState
): BootstrapStore => {
  const createByKind = (
    kind: BootstrapKind,
    resource: BootstrapResource
  ): BootstrapResult<BootstrapResource> => {
    if (kind === 'Namespace') {
      return clusterState.createByKind('Namespace', resource as Namespace)
    }
    if (kind === 'Node') {
      return clusterState.createByKind('Node', resource as Node)
    }
    if (kind === 'ConfigMap') {
      return clusterState.createByKind('ConfigMap', resource as ConfigMap)
    }
    if (kind === 'Service') {
      return clusterState.createByKind('Service', resource as Service)
    }
    if (kind === 'Endpoints') {
      return clusterState.createByKind('Endpoints', resource as Endpoints)
    }
    if (kind === 'Deployment') {
      return clusterState.createByKind('Deployment', resource as Deployment)
    }
    if (kind === 'DaemonSet') {
      return clusterState.createByKind('DaemonSet', resource as DaemonSet)
    }
    if (kind === 'Lease') {
      return clusterState.createByKind('Lease', resource as Lease)
    }
    if (kind === 'StorageClass') {
      return clusterState.createByKind('StorageClass', resource as StorageClass)
    }
    return clusterState.createByKind('Pod', resource as Pod)
  }

  const updateByKind = (
    kind: BootstrapKind,
    name: string,
    resource: BootstrapResource,
    namespace?: string
  ): BootstrapResult<BootstrapResource> => {
    if (kind === 'Namespace') {
      return clusterState.updateByKind('Namespace', name, resource as Namespace)
    }
    if (kind === 'Node') {
      return clusterState.updateByKind('Node', name, resource as Node)
    }
    if (kind === 'ConfigMap') {
      return clusterState.updateByKind(
        'ConfigMap',
        name,
        resource as ConfigMap,
        namespace
      )
    }
    if (kind === 'Service') {
      return clusterState.updateByKind(
        'Service',
        name,
        resource as Service,
        namespace
      )
    }
    if (kind === 'Endpoints') {
      return clusterState.updateByKind(
        'Endpoints',
        name,
        resource as Endpoints,
        namespace
      )
    }
    if (kind === 'Deployment') {
      return clusterState.updateByKind(
        'Deployment',
        name,
        resource as Deployment,
        namespace
      )
    }
    if (kind === 'DaemonSet') {
      return clusterState.updateByKind(
        'DaemonSet',
        name,
        resource as DaemonSet,
        namespace
      )
    }
    if (kind === 'Lease') {
      return clusterState.updateByKind(
        'Lease',
        name,
        resource as Lease,
        namespace
      )
    }
    if (kind === 'StorageClass') {
      return clusterState.updateByKind(
        'StorageClass',
        name,
        resource as StorageClass
      )
    }
    return clusterState.updateByKind('Pod', name, resource as Pod, namespace)
  }

  const deleteByKind = (
    kind: BootstrapKind,
    name: string,
    namespace?: string
  ): BootstrapResult<BootstrapResource> => {
    if (kind === 'Namespace') {
      return clusterState.deleteByKind('Namespace', name)
    }
    if (kind === 'Node') {
      return clusterState.deleteByKind('Node', name)
    }
    if (kind === 'ConfigMap') {
      return clusterState.deleteByKind('ConfigMap', name, namespace)
    }
    if (kind === 'Service') {
      return clusterState.deleteByKind('Service', name, namespace)
    }
    if (kind === 'Endpoints') {
      return clusterState.deleteByKind('Endpoints', name, namespace)
    }
    if (kind === 'Deployment') {
      return clusterState.deleteByKind('Deployment', name, namespace)
    }
    if (kind === 'DaemonSet') {
      return clusterState.deleteByKind('DaemonSet', name, namespace)
    }
    if (kind === 'Lease') {
      return clusterState.deleteByKind('Lease', name, namespace)
    }
    if (kind === 'StorageClass') {
      return clusterState.deleteByKind('StorageClass', name)
    }
    return clusterState.deleteByKind('Pod', name, namespace)
  }

  return {
    findByKind: (kind, name, namespace) => {
      return clusterState.findByKind(
        kind,
        name,
        namespace
      ) as BootstrapResult<BootstrapResource>
    },
    listByKind: (kind, namespace) => {
      return clusterState.listByKind(
        kind,
        namespace
      ) as readonly BootstrapResource[]
    },
    createByKind: (kind, resource) => {
      return createByKind(kind, resource)
    },
    updateByKind: (kind, name, resource, namespace) => {
      return updateByKind(kind, name, resource, namespace)
    },
    deleteByKind: (kind, name, namespace) => {
      return deleteByKind(kind, name, namespace)
    }
  }
}

const createBootstrapStoreFromApi = (api: BootstrapApiLike): BootstrapStore => {
  return {
    findByKind: (kind, name, namespace) => {
      return api.findResource(
        kind,
        name,
        namespace
      ) as BootstrapResult<BootstrapResource>
    },
    listByKind: (kind, namespace) => {
      return api.listResources(kind, namespace) as readonly BootstrapResource[]
    },
    createByKind: (kind, resource, namespace) => {
      return api.createResource(
        kind,
        resource,
        namespace
      ) as BootstrapResult<BootstrapResource>
    },
    updateByKind: (kind, name, resource, namespace) => {
      return api.updateResource(
        kind,
        name,
        resource,
        namespace
      ) as BootstrapResult<BootstrapResource>
    },
    deleteByKind: (kind, name, namespace) => {
      return api.deleteResource(
        kind,
        name,
        namespace
      ) as BootstrapResult<BootstrapResource>
    }
  }
}

const upsertResourcesByKind = <T extends BootstrapResource>(
  store: BootstrapStore,
  kind: BootstrapKind,
  resources: readonly T[]
): void => {
  for (const resource of resources) {
    const resourceNamespace = resource.metadata.namespace
    const findResult =
      resourceNamespace == null
        ? store.findByKind(kind, resource.metadata.name)
        : store.findByKind(kind, resource.metadata.name, resourceNamespace)
    if (!findResult.ok) {
      if (resourceNamespace == null) {
        assertBootstrapWriteResult(
          store.createByKind(kind, resource),
          `create ${kind}/${resource.metadata.name}`
        )
      } else {
        assertBootstrapWriteResult(
          store.createByKind(kind, resource, resourceNamespace),
          `create ${kind}/${resourceNamespace}/${resource.metadata.name}`
        )
      }
      continue
    }
    if (resourceNamespace == null) {
      assertBootstrapWriteResult(
        store.updateByKind(kind, resource.metadata.name, resource),
        `update ${kind}/${resource.metadata.name}`
      )
    } else {
      assertBootstrapWriteResult(
        store.updateByKind(
          kind,
          resource.metadata.name,
          resource,
          resourceNamespace
        ),
        `update ${kind}/${resourceNamespace}/${resource.metadata.name}`
      )
    }
  }
}

const removeExistingSystemPods = (store: BootstrapStore): void => {
  const pods = store.listByKind('Pod') as readonly Pod[]
  for (const pod of pods) {
    if (!isSystemPodNamespace(pod.metadata.namespace)) {
      continue
    }
    assertBootstrapWriteResult(
      store.deleteByKind('Pod', pod.metadata.name, pod.metadata.namespace),
      `delete Pod/${pod.metadata.namespace}/${pod.metadata.name}`
    )
  }
}

const upsertNodes = (store: BootstrapStore, nodes: Node[]): void => {
  upsertResourcesByKind(store, 'Node', nodes)
}

const upsertNamespaces = (
  store: BootstrapStore,
  namespaces: Namespace[]
): void => {
  upsertResourcesByKind(store, 'Namespace', namespaces)
}

const upsertConfigMaps = (
  store: BootstrapStore,
  configMaps: ConfigMap[]
): void => {
  upsertResourcesByKind(store, 'ConfigMap', configMaps)
}

const upsertServices = (store: BootstrapStore, services: Service[]): void => {
  upsertResourcesByKind(store, 'Service', services)
}

const upsertEndpoints = (
  store: BootstrapStore,
  endpoints: Endpoints[]
): void => {
  upsertResourcesByKind(store, 'Endpoints', endpoints)
}

const upsertDeployments = (
  store: BootstrapStore,
  deployments: Deployment[]
): void => {
  upsertResourcesByKind(store, 'Deployment', deployments)
}

const upsertDaemonSets = (
  store: BootstrapStore,
  daemonSets: DaemonSet[]
): void => {
  upsertResourcesByKind(store, 'DaemonSet', daemonSets)
}

const upsertLeases = (store: BootstrapStore, leases: Lease[]): void => {
  upsertResourcesByKind(store, 'Lease', leases)
}

const upsertStorageClasses = (
  store: BootstrapStore,
  storageClasses: StorageClass[]
): void => {
  upsertResourcesByKind(store, 'StorageClass', storageClasses)
}

const addMissingPods = (store: BootstrapStore, pods: readonly Pod[]): void => {
  for (const pod of pods) {
    const findPodResult = store.findByKind(
      'Pod',
      pod.metadata.name,
      pod.metadata.namespace
    )
    if (!findPodResult.ok) {
      assertBootstrapWriteResult(
        store.createByKind('Pod', pod, pod.metadata.namespace),
        `create Pod/${pod.metadata.namespace}/${pod.metadata.name}`
      )
    }
  }
}

const ensureSystemPods = (store: BootstrapStore, pods: Pod[]): void => {
  addMissingPods(store, pods)
}

const replaceSystemPods = (store: BootstrapStore, pods: Pod[]): void => {
  removeExistingSystemPods(store)
  addMissingPods(store, pods)
}

const applyKindLikeBootstrap = (
  store: BootstrapStore,
  options: ClusterBootstrapConfig
): void => {
  const resources = createSystemBootstrapResources(options)
  const mode = options.mode ?? 'missing-only'

  upsertNamespaces(store, resources.namespaces)
  upsertNodes(store, resources.nodes)
  upsertConfigMaps(store, resources.configMaps)
  upsertServices(store, resources.services)
  upsertEndpoints(store, resources.endpoints)
  upsertDeployments(store, resources.deployments)
  upsertDaemonSets(store, resources.daemonSets)
  upsertLeases(store, resources.leases)
  upsertStorageClasses(store, resources.storageClasses)

  if (mode === 'always') {
    replaceSystemPods(store, resources.staticPods)
    return
  }

  ensureSystemPods(store, resources.staticPods)
}

export const applyClusterBootstrap = (
  clusterState: ClusterState,
  config: ClusterBootstrapConfig
): void => {
  const store = createBootstrapStoreFromClusterState(clusterState)
  const mode = config.mode ?? 'missing-only'
  if (mode === 'never') {
    return
  }

  const profile = config.profile ?? 'kind-like'
  if (profile === 'none') {
    return
  }

  if (profile === 'kind-like') {
    applyKindLikeBootstrap(store, config)
  }
}

export const applyClusterBootstrapViaApi = (
  api: BootstrapApiLike,
  config: ClusterBootstrapConfig
): void => {
  const store = createBootstrapStoreFromApi(api)
  const mode = config.mode ?? 'missing-only'
  if (mode === 'never') {
    return
  }

  const profile = config.profile ?? 'kind-like'
  if (profile === 'none') {
    return
  }

  if (profile === 'kind-like') {
    applyKindLikeBootstrap(store, config)
  }
}

export const applySystemBootstrap = (
  clusterState: ClusterState,
  options: SystemBootstrapOptions = {}
): void => {
  applyClusterBootstrap(clusterState, {
    ...DEFAULT_KIND_LIKE_BOOTSTRAP,
    ...options
  })
}
