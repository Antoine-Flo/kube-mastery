import { describe, expect, it } from 'vitest'
import { createClusterState } from '../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import {
  applySystemBootstrap,
  createSystemBootstrapResources
} from '../../../src/core/cluster/systemBootstrap'

const createControlPlaneStaticPodName = (
  controlPlaneNodeName: string,
  componentName: string
): string => {
  return `${componentName}-${controlPlaneNodeName}`
}

describe('systemBootstrap', () => {
  it('creates expected kind-like bootstrap resources', () => {
    const clusterName = 'conformance'
    const controlPlaneNodeName = `${clusterName}-control-plane`
    const resources = createSystemBootstrapResources({
      clusterName,
      clock: () => '2026-02-13T12:00:00Z'
    })

    expect(resources.nodes).toHaveLength(3)
    expect(resources.namespaces.map((namespace) => namespace.metadata.name)).toEqual([
      'default',
      'kube-system',
      'kube-public',
      'kube-node-lease',
      'local-path-storage'
    ])
    expect(resources.nodes.map((node) => node.metadata.name)).toEqual([
      'conformance-control-plane',
      'conformance-worker',
      'conformance-worker2'
    ])
    const controlPlaneNode = resources.nodes.find((node) => {
      return node.metadata.name === 'conformance-control-plane'
    })
    expect(controlPlaneNode?.spec.taints).toEqual([
      {
        key: 'node-role.kubernetes.io/control-plane',
        effect: 'NoSchedule'
      }
    ])
    expect(resources.nodes.every((node) => {
      const readyCondition = (node.status.conditions ?? []).find((condition) => {
        return condition.type === 'Ready'
      })
      return readyCondition?.status === 'True'
    })).toBe(true)
    expect(resources.configMaps).toHaveLength(2)
    expect(resources.configMaps.map((configMap) => configMap.metadata.name)).toEqual([
      'kube-root-ca.crt',
      'cluster-info'
    ])
    expect(resources.configMaps.map((configMap) => configMap.metadata.namespace)).toEqual([
      'default',
      'kube-public'
    ])
    expect(resources.services.map((service) => service.metadata.name)).toEqual([
      'kubernetes',
      'kube-dns'
    ])
    expect(resources.services.map((service) => service.metadata.namespace)).toEqual([
      'default',
      'kube-system'
    ])
    expect(resources.pods).toHaveLength(4)
    expect(resources.staticPods).toHaveLength(4)
    const staticControlPlanePods = [
      createControlPlaneStaticPodName(controlPlaneNodeName, 'etcd'),
      createControlPlaneStaticPodName(controlPlaneNodeName, 'kube-apiserver'),
      createControlPlaneStaticPodName(controlPlaneNodeName, 'kube-controller-manager'),
      createControlPlaneStaticPodName(controlPlaneNodeName, 'kube-scheduler')
    ]
    const expectedComponentLabelByPodName: Record<string, string> = {
      [createControlPlaneStaticPodName(controlPlaneNodeName, 'etcd')]: 'etcd',
      [createControlPlaneStaticPodName(controlPlaneNodeName, 'kube-apiserver')]:
        'kube-apiserver',
      [createControlPlaneStaticPodName(
        controlPlaneNodeName,
        'kube-controller-manager'
      )]: 'kube-controller-manager',
      [createControlPlaneStaticPodName(controlPlaneNodeName, 'kube-scheduler')]:
        'kube-scheduler'
    }
    for (const podName of staticControlPlanePods) {
      const pod = resources.pods.find((item) => {
        return item.metadata.name === podName
      })
      expect(pod).toBeDefined()
      expect(pod?.spec.nodeName).toBe('conformance-control-plane')
      expect(pod?.metadata.labels?.tier).toBe('control-plane')
      expect(pod?.metadata.labels?.component).toBe(
        expectedComponentLabelByPodName[podName]
      )
    }
    const kubeApiserverPod = resources.pods.find((item) => {
      return (
        item.metadata.name ===
        createControlPlaneStaticPodName(controlPlaneNodeName, 'kube-apiserver')
      )
    })
    expect(kubeApiserverPod).toBeDefined()
    expect(kubeApiserverPod?.spec.containers[0].image).toBe(
      'registry.k8s.io/kube-apiserver:v1.35.0'
    )
    expect(kubeApiserverPod?.spec.containers[0].ports).toEqual([
      { containerPort: 6443, protocol: 'TCP' }
    ])
    expect(kubeApiserverPod?.spec.containers[0].startupProbe).toBeDefined()
    expect(kubeApiserverPod?.spec.containers[0].livenessProbe).toBeDefined()
    expect(kubeApiserverPod?.spec.containers[0].readinessProbe).toBeDefined()
    expect(kubeApiserverPod?.spec.volumes?.length).toBeGreaterThan(0)
    expect(kubeApiserverPod?.spec.tolerations?.some((toleration) => {
      return toleration.operator === 'Exists' && toleration.effect === 'NoExecute'
    })).toBe(true)
    expect(
      kubeApiserverPod?.metadata.annotations?.[
        'kubeadm.kubernetes.io/kube-apiserver.advertise-address.endpoint'
      ]
    ).toBe('172.18.0.2:6443')
    const corednsDeployment = resources.deployments.find((item) => {
      return item.metadata.name === 'coredns'
    })
    expect(corednsDeployment).toBeDefined()
    expect(corednsDeployment?.spec.replicas).toBe(2)
    expect(corednsDeployment?.spec.template.spec.nodeSelector).toEqual({
      'node-role.kubernetes.io/control-plane': ''
    })
    expect(corednsDeployment?.spec.template.spec.tolerations?.some((toleration) => {
      return (
        toleration.key === 'node-role.kubernetes.io/control-plane' &&
        toleration.operator === 'Exists' &&
        toleration.effect === 'NoSchedule'
      )
    })).toBe(true)
    const localPathDeployment = resources.deployments.find((item) => {
      return item.metadata.name === 'local-path-provisioner'
    })
    expect(localPathDeployment).toBeDefined()
    expect(localPathDeployment?.spec.replicas).toBe(1)
    expect(localPathDeployment?.spec.template.spec.tolerations?.some((toleration) => {
      return (
        toleration.key === 'node-role.kubernetes.io/control-plane' &&
        toleration.operator === 'Exists' &&
        toleration.effect === 'NoSchedule'
      )
    })).toBe(true)
    expect(resources.daemonSets.map((item) => item.metadata.name)).toEqual([
      'kindnet',
      'kube-proxy'
    ])
  })

  it('applies bootstrap resources without duplicates when called twice', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const clock = () => '2026-02-13T12:00:00Z'
    const expected = createSystemBootstrapResources({
      clusterName: 'conformance',
      clock
    })

    applySystemBootstrap(clusterState, { clusterName: 'conformance', clock })
    applySystemBootstrap(clusterState, { clusterName: 'conformance', clock })

    expect(clusterState.getNodes()).toHaveLength(expected.nodes.length)
    expect(clusterState.getNamespaces()).toHaveLength(expected.namespaces.length)
    expect(clusterState.getConfigMaps()).toHaveLength(expected.configMaps.length)
    expect(clusterState.getServices()).toHaveLength(expected.services.length)
    expect(clusterState.getPods()).toHaveLength(expected.pods.length)
    expect(clusterState.getDeployments()).toHaveLength(expected.deployments.length)
    expect(clusterState.getDaemonSets()).toHaveLength(expected.daemonSets.length)
  })

  it('supports topology with extra workers without magic strings', () => {
    const resources = createSystemBootstrapResources({
      clusterName: 'conformance',
      clock: () => '2026-02-13T12:00:00Z',
      nodeRoles: ['control-plane', 'worker', 'worker', 'worker']
    })

    expect(resources.nodes.map((node) => node.metadata.name)).toEqual([
      'conformance-control-plane',
      'conformance-worker',
      'conformance-worker2',
      'conformance-worker3'
    ])
    expect(resources.nodes.map((node) => {
      const addresses = node.status.addresses ?? []
      const internal = addresses.find((address) => {
        return address.type === 'InternalIP'
      })
      return internal?.address
    })).toEqual(['172.18.0.2', '172.18.0.3', '172.18.0.4', '172.18.0.5'])
    const daemonSets = resources.daemonSets
    expect(daemonSets).toHaveLength(2)
    const kubeProxyDaemonSet = daemonSets.find((daemonSet) => {
      return daemonSet.metadata.name === 'kube-proxy'
    })
    const kindnetDaemonSet = daemonSets.find((daemonSet) => {
      return daemonSet.metadata.name === 'kindnet'
    })
    expect(kubeProxyDaemonSet).toBeDefined()
    expect(kindnetDaemonSet).toBeDefined()
    expect(kubeProxyDaemonSet?.spec.template.spec.tolerations?.some((toleration) => {
      return (
        toleration.key === 'node-role.kubernetes.io/control-plane' &&
        toleration.operator === 'Exists' &&
        toleration.effect === 'NoSchedule'
      )
    })).toBe(true)
  })
})
