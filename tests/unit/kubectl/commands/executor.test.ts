import { beforeEach, describe, expect, it } from 'vitest'
import { createClusterState } from '../../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../../src/core/cluster/events/EventBus'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createService } from '../../../../src/core/cluster/ressources/Service'
import { createHostFileSystem } from '../../../../src/core/filesystem/debianFileSystem'
import {
  createFileSystem,
  type FileSystem
} from '../../../../src/core/filesystem/FileSystem'
import { createKubectlExecutor } from '../../../../src/core/kubectl/commands/executor'
import { createLogger } from '../../../../src/logger/Logger'

describe('kubectl Executor', () => {
  describe('createKubectlExecutor', () => {
    let clusterState: ReturnType<typeof createClusterState>
    let fileSystem: FileSystem
    let logger: ReturnType<typeof createLogger>
    let eventBus: ReturnType<typeof createEventBus>

    beforeEach(() => {
      eventBus = createEventBus()
      clusterState = createClusterState(eventBus)
      fileSystem = createFileSystem(createHostFileSystem())
      logger = createLogger()

      // Seed with test pods
      clusterState.addPod(
        createPod({
          name: 'nginx-pod',
          namespace: 'default',
          containers: [
            {
              name: 'nginx',
              image: 'nginx:latest',
              ports: [{ containerPort: 80 }]
            }
          ]
        })
      )
      clusterState.addPod(
        createPod({
          name: 'redis-pod',
          namespace: 'kube-system',
          containers: [{ name: 'redis', image: 'redis:alpine', ports: [] }]
        })
      )
    })

    describe('command routing', () => {
      it('should route "kubectl get pods" to get handler', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get pods')
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('nginx-pod')
        }
      })

      it('should route "kubectl describe pod" to describe handler', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl describe pod nginx-pod')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('nginx-pod')
        }
      })

      it('should route "kubectl describe deployment" to describe handler', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const created = executor.execute(
          'kubectl create deployment web-app --image=nginx:1.25 --replicas=3'
        )
        expect(created.ok).toBe(true)

        const result = executor.execute('kubectl describe deployment web-app')
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('Name:             web-app')
          expect(result.value).toContain('Replicas:')
          expect(result.value).toContain('Pod Template:')
        }
      })

      it('should route "kubectl delete pod" to delete handler', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl delete pod nginx-pod')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('deleted')
        }
      })

      it('should route "kubectl apply -f" to apply handler', () => {
        // Create a valid YAML file in filesystem
        const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: nginx
      image: nginx:latest
`
        fileSystem.createFile('pod.yaml')
        fileSystem.writeFile('pod.yaml', yaml)

        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl apply -f pod.yaml')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('created')
        }
      })

      it('should route "kubectl create -f" to create handler', () => {
        // Create a valid YAML file in filesystem
        const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
data:
  key: value
`
        fileSystem.createFile('deployment.yaml')
        fileSystem.writeFile('deployment.yaml', yaml)

        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl create -f deployment.yaml')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('created')
        }
      })

      it('should route "kubectl diff -f" to diff handler', () => {
        const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
  namespace: default
data:
  mode: blue
`
        fileSystem.createFile('configmap.yaml')
        fileSystem.writeFile('configmap.yaml', yaml)

        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl diff -f configmap.yaml')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('diff -u -N /tmp/LIVE-')
        expect(result.value).toContain('/tmp/MERGED-')
      })
    })

    describe('create deployment (imperative)', () => {
      it('should create a deployment with one image', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('deployment.apps/my-dep created')
        const deployment = clusterState.findDeployment('my-dep', 'default')
        expect(deployment.ok).toBe(true)
      })

      it('should create a deployment with command after --', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox -- date'
        )

        expect(result.ok).toBe(true)
        const deployment = clusterState.findDeployment('my-dep', 'default')
        expect(deployment.ok).toBe(true)
        if (!deployment.ok) {
          return
        }

        expect(
          deployment.value.spec.template.spec.containers[0].command
        ).toEqual(['date'])
      })

      it('should create a deployment with replicas', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl create deployment my-dep --image=nginx --replicas=3'
        )

        expect(result.ok).toBe(true)
        const deployment = clusterState.findDeployment('my-dep', 'default')
        expect(deployment.ok).toBe(true)
        if (!deployment.ok) {
          return
        }

        expect(deployment.value.spec.replicas).toBe(3)
      })

      it('should create a deployment with exposed container port', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox --port=5701'
        )

        expect(result.ok).toBe(true)
        const deployment = clusterState.findDeployment('my-dep', 'default')
        expect(deployment.ok).toBe(true)
        if (!deployment.ok) {
          return
        }

        expect(
          deployment.value.spec.template.spec.containers[0].ports?.[0]
            ?.containerPort
        ).toBe(5701)
      })

      it('should create a deployment with multiple images', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox:latest --image=ubuntu:latest --image=nginx'
        )

        expect(result.ok).toBe(true)
        const deployment = clusterState.findDeployment('my-dep', 'default')
        expect(deployment.ok).toBe(true)
        if (!deployment.ok) {
          return
        }

        const images = deployment.value.spec.template.spec.containers.map(
          (container) => container.image
        )
        expect(images).toEqual(['busybox:latest', 'ubuntu:latest', 'nginx'])
      })

      it('should fail when multiple images are combined with command', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox --image=nginx -- date'
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain(
            'cannot specify multiple --image options and command'
          )
        }
      })

      it('should support --image with separate value', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl create deployment my-dep --image busybox'
        )

        expect(result.ok).toBe(true)
        const deployment = clusterState.findDeployment('my-dep', 'default')
        expect(deployment.ok).toBe(true)
        if (!deployment.ok) {
          return
        }

        expect(deployment.value.spec.template.spec.containers[0].image).toBe(
          'busybox'
        )
      })

      it('should create deployment in a specific namespace', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox -n staging'
        )

        expect(result.ok).toBe(true)
        const deployment = clusterState.findDeployment('my-dep', 'staging')
        expect(deployment.ok).toBe(true)
      })

      it('should parse name correctly when namespace flag is before name', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl create deployment -n staging my-dep --image=busybox'
        )

        expect(result.ok).toBe(true)
        const deployment = clusterState.findDeployment('my-dep', 'staging')
        expect(deployment.ok).toBe(true)
      })
    })

    describe('get command with different resources', () => {
      it('should handle "kubectl get pods"', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get pods')

        expect(result.ok).toBe(true)
      })

      it('should handle "kubectl get all"', () => {
        clusterState.addService(
          createService({
            name: 'kubernetes',
            namespace: 'default',
            clusterIP: '10.96.0.1',
            ports: [{ port: 443, protocol: 'TCP' }]
          })
        )
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get all')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('service/kubernetes')
        }
      })

      it('should handle "kubectl get deployments"', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get deployments')

        expect(result.ok).toBe(true)
      })

      it('should handle "kubectl get services"', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get services')

        expect(result.ok).toBe(true)
      })

      it('should handle "kubectl get namespaces"', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get namespaces')

        expect(result.ok).toBe(true)
      })
    })

    describe('namespace handling', () => {
      it('should pass namespace to get handler from -n flag', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get pods -n kube-system')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('redis-pod')
          expect(result.value).not.toContain('nginx-pod')
        }
      })

      it('should parse get when namespace flag is before resource', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get -n kube-system pods')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('redis-pod')
          expect(result.value).not.toContain('nginx-pod')
        }
      })

      it('should pass namespace to describe handler', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl describe pod redis-pod -n kube-system'
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('redis-pod')
        }
      })

      it('should parse describe when namespace flag is before pod name', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl describe pod -n kube-system redis-pod'
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('redis-pod')
        }
      })

      it('should use default namespace when not specified', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get pods')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('nginx-pod')
          expect(result.value).not.toContain('redis-pod')
        }
      })
    })

    describe('error handling', () => {
      it('should return error for invalid command syntax', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('invalid command')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toBeTruthy()
        }
      })

      it('should return error for empty command', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('empty')
        }
      })

      it('should return error when pod not found', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl describe pod nonexistent')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('not found')
        }
      })

      it('should return error for pod in wrong namespace', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl describe pod nginx-pod -n kube-system'
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('not found')
        }
      })
    })

    describe('delete command', () => {
      it('should delete pod and return success message', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl delete pod nginx-pod')

        expect(result.ok).toBe(true)

        // Verify pod is actually deleted
        const pods = clusterState.getPods('default')
        expect(
          pods.find((p) => p.metadata.name === 'nginx-pod')
        ).toBeUndefined()
      })

      it('should delete pod with namespace specified', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl delete pod redis-pod -n kube-system'
        )

        expect(result.ok).toBe(true)

        const pods = clusterState.getPods('kube-system')
        expect(
          pods.find((p) => p.metadata.name === 'redis-pod')
        ).toBeUndefined()
      })

      it('should delete pod when namespace flag is before resource', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl delete -n kube-system pod redis-pod'
        )

        expect(result.ok).toBe(true)

        const pods = clusterState.getPods('kube-system')
        expect(
          pods.find((p) => p.metadata.name === 'redis-pod')
        ).toBeUndefined()
      })

      it('should return error when deleting nonexistent pod', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl delete pod nonexistent')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('not found')
        }
      })
    })

    describe('resource aliases', () => {
      it('should handle "kubectl get po" (pods alias)', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get po')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('nginx-pod')
        }
      })

      it('should handle "kubectl describe po nginx-pod" (pod alias)', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl describe po nginx-pod')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('nginx-pod')
        }
      })

      it('should handle "kubectl delete po nginx-pod" (pod alias)', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl delete po nginx-pod')

        expect(result.ok).toBe(true)
      })
    })

    describe('integration with parser', () => {
      it('should return root help for kubectl -h', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl -h')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain(
          'kubectl controls the Kubernetes cluster manager.'
        )
      })

      it('should return subcommand help for kubectl get --help', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get --help')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('Display one or many resources.')
        expect(result.value).toContain('Usage:')
      })

      it('should return create deployment help without executing command', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const before = clusterState.getDeployments('default').length
        const result = executor.execute('kubectl create deployment --help')
        const after = clusterState.getDeployments('default').length

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain(
          'Create a deployment with the specified name.'
        )
        expect(after).toBe(before)
      })

      it('should handle complete command flow: parse → route → execute', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get pods -n default')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toBeTruthy()
          expect(result.value).toContain('nginx-pod')
        }
      })

      it('should execute kubectl get --raw / and return discovery root JSON', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get --raw /')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        const payload = JSON.parse(result.value)
        expect(payload).toHaveProperty('paths')
        expect(Array.isArray(payload.paths)).toBe(true)
      })

      it('should execute kubectl get --raw /api/v1/namespaces and return NamespaceList', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get --raw /api/v1/namespaces')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        const payload = JSON.parse(result.value)
        expect(payload.kind).toBe('NamespaceList')
        expect(payload.apiVersion).toBe('v1')
        expect(Array.isArray(payload.items)).toBe(true)
      })

      it('should reject kubectl get --raw when output is also provided', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get --raw / -o json')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('--raw and --output are mutually exclusive')
        }
      })

      it('should propagate parser errors correctly', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl get invalidresource')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toBeTruthy()
        }
      })

      it('should handle kubectl version --client command', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl version --client')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('Client Version: v1.35.0')
          expect(result.value).toContain('Kustomize Version: v5.7.1')
          expect(result.value).not.toContain('Server Version')
        }
      })

      it('should handle kubectl version command without --client flag', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl version')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('Client Version: v1.35.0')
          expect(result.value).toContain('Kustomize Version: v5.7.1')
          expect(result.value).toContain('Server Version: v1.35.0')
        }
      })

      it('should handle kubectl version --output json', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl version --output json')

        expect(result.ok).toBe(true)
        if (result.ok) {
          const json = JSON.parse(result.value)
          expect(json).toHaveProperty('clientVersion')
          expect(json).toHaveProperty('kustomizeVersion', 'v5.7.1')
          expect(json).toHaveProperty('serverVersion')
        }
      })

      it('should handle kubectl version --output yaml', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl version --output yaml')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('clientVersion:')
          expect(result.value).toContain('kustomizeVersion: v5.7.1')
          expect(result.value).toContain('serverVersion:')
        }
      })

      it('should return error for invalid --output value', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl version --output table')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain("--output must be 'yaml' or 'json'")
        }
      })

      it('should handle kubectl cluster-info command', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl cluster-info')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain(
            'Kubernetes control plane is running at'
          )
          expect(result.value).toContain(
            'To further debug and diagnose cluster problems'
          )
        }
      })

      it('should handle kubectl cluster-info dump command', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl cluster-info dump')

        expect(result.ok).toBe(true)
        if (result.ok) {
          // Should return JSON format (default for dump)
          expect(result.value).toContain('"kind": "NodeList"')
          expect(result.value).toContain('"kind": "PodList"')
          expect(result.value).toContain('"kind": "ConfigMapList"')
        }
      })

      it('should handle kubectl cluster-info dump with --all-namespaces', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute(
          'kubectl cluster-info dump --all-namespaces'
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('"kind": "NodeList"')
        }
      })

      it('should handle kubectl api-versions command', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl api-versions')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('apps/v1')
          expect(result.value).toContain('rbac.authorization.k8s.io/v1')
          expect(result.value).toContain('v1')
        }
      })

      it('should handle kubectl explain pod.spec.containers command', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl explain pod.spec.containers')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('KIND:')
        expect(result.value).toContain('VERSION:')
        expect(result.value).toContain('FIELD:    containers')
        expect(result.value).toContain('DESCRIPTION:')
      })

      it('should return field not found for unknown explain path', () => {
        const executor = createKubectlExecutor(
          clusterState,
          fileSystem,
          logger,
          eventBus
        )
        const result = executor.execute('kubectl explain pod.spec.unknownField')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('field "unknownField" does not exist')
        }
      })
    })
  })
})
