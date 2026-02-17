import { generateKindLikePodName } from '../controllers/helpers'
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

const uniqueKindLikeName = (prefix: string, usedNames: Set<string>): string => {
  let generatedName: string
  do {
    generatedName = generateKindLikePodName(prefix)
  } while (usedNames.has(generatedName))
  usedNames.add(generatedName)
  return generatedName
}

const materializeStaticPod = (
  spec: SimStaticPodWorkloadSpec,
  creationTimestamp: string
): Pod => {
  return createPod({
    name: spec.name,
    namespace: spec.namespace,
    nodeName: spec.nodeName,
    containers: [minimalContainer(spec.containerName)],
    annotations: {
      'sim.kubernetes.io/workload-type': 'StaticPod'
    },
    creationTimestamp,
    phase: 'Pending'
  })
}

const materializeDaemonSetPods = (
  spec: SimDaemonSetWorkloadSpec,
  usedNames: Set<string>,
  creationTimestamp: string
): Pod[] => {
  return spec.nodeNames.map((nodeName) => {
    return createPod({
      name: uniqueKindLikeName(spec.podPrefix, usedNames),
      namespace: spec.namespace,
      nodeName,
      containers: [minimalContainer(spec.containerName)],
      ...(spec.tolerations != null && { tolerations: spec.tolerations }),
      annotations: {
        'sim.kubernetes.io/workload-type': 'DaemonSet'
      },
      creationTimestamp,
      phase: 'Pending'
    })
  })
}

const materializeDeploymentPods = (
  spec: SimDeploymentWorkloadSpec,
  usedNames: Set<string>,
  creationTimestamp: string
): Pod[] => {
  const pods: Pod[] = []
  for (let replica = 0; replica < spec.replicas; replica++) {
    pods.push(
      createPod({
        name: uniqueKindLikeName(spec.podPrefix, usedNames),
        namespace: spec.namespace,
        containers: [minimalContainer(spec.containerName)],
        ...(spec.nodeSelector != null && { nodeSelector: spec.nodeSelector }),
        ...(spec.tolerations != null && { tolerations: spec.tolerations }),
        annotations: {
          'sim.kubernetes.io/workload-type': 'Deployment',
          ...(spec.annotations ?? {})
        },
        creationTimestamp,
        phase: 'Pending'
      })
    )
  }
  return pods
}

export const materializeSimSystemWorkloads = (
  specs: SimSystemWorkloadSpec[],
  creationTimestamp: string
): Pod[] => {
  const usedNames = new Set<string>()
  const pods: Pod[] = []
  for (const spec of specs) {
    if (spec.kind === 'static') {
      pods.push(materializeStaticPod(spec, creationTimestamp))
      continue
    }
    if (spec.kind === 'daemonset') {
      pods.push(...materializeDaemonSetPods(spec, usedNames, creationTimestamp))
      continue
    }
    pods.push(...materializeDeploymentPods(spec, usedNames, creationTimestamp))
  }
  return pods
}
