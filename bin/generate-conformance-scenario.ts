#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  generateLifecycleSuite,
  type LifecycleSegment
} from './lib/scenario-generator'

const OUTPUT_PATH = 'bin/config/generated/exhaustive-suite.json'

const createExhaustiveSegments = (): LifecycleSegment[] => {
  return [
    {
      idPrefix: 'minimal',
      seed: 'minimal',
      commands: [
        'kubectl get pods',
        'kubectl get pods -A',
        'kubectl get pods -o yaml',
        'kubectl get pods -o json',
        'kubectl get nodes',
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
        'kubectl create deployment exhaustive-web --image=nginx:latest',
        'kubectl create deployment exhaustive-api --image=nginx:latest --replicas=2 --port=8080',
        'kubectl create deployment exhaustive-multi --image=busybox --image=nginx -- date',
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
        'kubectl version',
        'kubectl version --client',
        'kubectl version --output json',
        'kubectl version --output yaml',
        'kubectl cluster-info',
        'kubectl cluster-info dump',
        'kubectl cluster-info dump -o yaml',
        'kubectl cluster-info dump --namespaces=default,kube-system',
        'kubectl api-resources',
        'kubectl api-resources --output wide',
        'kubectl api-resources --output name',
        'kubectl api-resources --output json',
        'kubectl api-resources --output yaml',
        'kubectl api-resources --namespaced=true',
        'kubectl api-resources --namespaced=false',
        'kubectl api-resources --sort-by=name',
        'kubectl api-resources --sort-by=kind',
        'kubectl api-resources --no-headers'
      ]
    },
    {
      idPrefix: 'errors-help',
      seed: 'minimal',
      commands: [
        'kubectl create deployment invalid-without-image',
        'kubectl delete pods missing-pod',
        'kubectl describe pod missing-pod',
        'kubectl scale deployments missing-deploy --replicas=2',
        'kubectl get not-a-resource',
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
        'kubectl label --help',
        'kubectl annotate --help'
      ]
    }
  ]
}

const main = (): void => {
  const segments = createExhaustiveSegments()
  const suite = generateLifecycleSuite({
    name: 'exhaustive-single-cluster-suite',
    clusterName: 'conformance',
    segments,
    stopOnMismatch: false
  })
  const outputPath = join(process.cwd(), OUTPUT_PATH)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(suite, null, 2) + '\n', 'utf-8')
  console.log(`Generated suite at ${outputPath}`)
}

main()
