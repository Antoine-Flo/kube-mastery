import type { DaemonSet } from '../ressources/DaemonSet'
import { createDaemonSet } from '../ressources/DaemonSet'
import type { Deployment } from '../ressources/Deployment'
import { createDeployment } from '../ressources/Deployment'
import type { Pod } from '../ressources/Pod'
import { createPod } from '../ressources/Pod'
import type {
  SimDaemonSetWorkloadSpec,
  SimDeploymentWorkloadSpec,
  SimStaticPodWorkloadSpec,
  SimSystemWorkloadSpec
} from './SimWorkloadSpecs'

const minimalContainer = (
  name: string,
  image: string = 'k8s.gcr.io/pause:3.9'
) => ({
  name,
  image
})

const materializeStaticPod = (
  spec: SimStaticPodWorkloadSpec,
  creationTimestamp: string
): Pod => {
  return createPod({
    name: spec.name,
    namespace: spec.namespace,
    nodeName: spec.nodeName,
    containers: [spec.container],
    ...(spec.labels != null && { labels: spec.labels }),
    ...(spec.volumes != null && { volumes: spec.volumes }),
    ...(spec.tolerations != null && { tolerations: spec.tolerations }),
    annotations: {
      ...(spec.annotations ?? {}),
      'sim.kubernetes.io/workload-type': 'StaticPod'
    },
    creationTimestamp,
    phase: 'Pending'
  })
}

const materializeDaemonSetPods = (
  spec: SimDaemonSetWorkloadSpec,
  creationTimestamp: string
): DaemonSet => {
  return createDaemonSet({
    name: spec.name,
    namespace: spec.namespace,
    labels: spec.labels,
    annotations: spec.annotations,
    selector: {
      matchLabels: spec.selectorLabels
    },
    template: {
      metadata: {
        labels: spec.selectorLabels
      },
      spec: {
        ...(spec.nodeSelector != null && { nodeSelector: spec.nodeSelector }),
        ...(spec.tolerations != null && { tolerations: spec.tolerations }),
        containers: [
          {
            ...minimalContainer(spec.containerName),
            ...(spec.containerResources != null && {
              resources: spec.containerResources
            })
          }
        ]
      }
    },
    creationTimestamp
  })
}

const materializeDeployment = (
  spec: SimDeploymentWorkloadSpec,
  creationTimestamp: string
): Deployment => {
  return createDeployment({
    name: spec.name,
    namespace: spec.namespace,
    labels: spec.labels,
    annotations: spec.annotations,
    replicas: spec.replicas,
    selector: {
      matchLabels: spec.selectorLabels
    },
    template: {
      metadata: {
        labels: spec.selectorLabels
      },
      spec: {
        ...(spec.nodeSelector != null && { nodeSelector: spec.nodeSelector }),
        ...(spec.tolerations != null && { tolerations: spec.tolerations }),
        containers: [
          {
            ...minimalContainer(spec.containerName),
            ...(spec.containerResources != null && {
              resources: spec.containerResources
            })
          }
        ]
      }
    },
    creationTimestamp
  })
}

export interface MaterializedSimSystemWorkloads {
  staticPods: Pod[]
  daemonSets: DaemonSet[]
  deployments: Deployment[]
}

export const materializeSimSystemWorkloads = (
  specs: SimSystemWorkloadSpec[],
  creationTimestamp: string
): MaterializedSimSystemWorkloads => {
  const staticPods: Pod[] = []
  const daemonSets: DaemonSet[] = []
  const deployments: Deployment[] = []
  for (const spec of specs) {
    if (spec.kind === 'static') {
      staticPods.push(materializeStaticPod(spec, creationTimestamp))
      continue
    }
    if (spec.kind === 'daemonset') {
      daemonSets.push(materializeDaemonSetPods(spec, creationTimestamp))
      continue
    }
    deployments.push(materializeDeployment(spec, creationTimestamp))
  }

  return {
    staticPods,
    daemonSets,
    deployments
  }
}
