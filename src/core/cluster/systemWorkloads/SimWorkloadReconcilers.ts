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
  const selectorLabels = { ...spec.selectorLabels }
  const templateLabels = { ...spec.selectorLabels }
  const deploymentContainers =
    spec.containers != null
      ? spec.containers
      : [
          {
            ...minimalContainer(spec.containerName),
            ...(spec.containerResources != null && {
              resources: spec.containerResources
            })
          }
        ]
  return createDeployment({
    name: spec.name,
    namespace: spec.namespace,
    labels: spec.labels,
    annotations: spec.annotations,
    replicas: spec.replicas,
    selector: {
      matchLabels: selectorLabels
    },
    template: {
      metadata: {
        labels: templateLabels
      },
      spec: {
        ...(spec.nodeSelector != null && { nodeSelector: spec.nodeSelector }),
        ...(spec.tolerations != null && { tolerations: spec.tolerations }),
        ...(spec.affinity != null && { affinity: spec.affinity }),
        ...(spec.dnsPolicy != null && { dnsPolicy: spec.dnsPolicy }),
        ...(spec.priorityClassName != null && {
          priorityClassName: spec.priorityClassName
        }),
        ...(spec.restartPolicy != null && { restartPolicy: spec.restartPolicy }),
        ...(spec.schedulerName != null && { schedulerName: spec.schedulerName }),
        ...(spec.securityContext != null && {
          securityContext: spec.securityContext
        }),
        ...(spec.serviceAccount != null && {
          serviceAccount: spec.serviceAccount
        }),
        ...(spec.serviceAccountName != null && {
          serviceAccountName: spec.serviceAccountName
        }),
        ...(spec.terminationGracePeriodSeconds != null && {
          terminationGracePeriodSeconds: spec.terminationGracePeriodSeconds
        }),
        containers: deploymentContainers,
        ...(spec.volumes != null && { volumes: spec.volumes })
      }
    },
    ...(spec.strategy != null && { strategy: spec.strategy }),
    ...(spec.revisionHistoryLimit != null && {
      revisionHistoryLimit: spec.revisionHistoryLimit
    }),
    ...(spec.progressDeadlineSeconds != null && {
      progressDeadlineSeconds: spec.progressDeadlineSeconds
    }),
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
