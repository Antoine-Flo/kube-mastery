import { beforeEach, describe, expect, it } from 'vitest'
import { createClusterState } from '../../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../../src/core/cluster/events/EventBus'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createHostFileSystem } from '../../../../src/core/filesystem/debianFileSystem'
import { createFileSystem, type FileSystem } from '../../../../src/core/filesystem/FileSystem'
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
                        { name: 'nginx', image: 'nginx:latest', ports: [{ containerPort: 80 }] }
                    ]
                })
            )
            clusterState.addPod(
                createPod({
                    name: 'redis-pod',
                    namespace: 'kube-system',
                    containers: [
                        { name: 'redis', image: 'redis:alpine', ports: [] }
                    ]
                })
            )
        })

        describe('command routing', () => {
            it('should route "kubectl get pods" to get handler', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl get pods')
                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('nginx-pod')
                }
            })

            it('should route "kubectl describe pod" to describe handler', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl describe pod nginx-pod')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('nginx-pod')
                }
            })

            it('should route "kubectl delete pod" to delete handler', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
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

                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
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

                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl create -f deployment.yaml')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('created')
                }
            })
        })

        describe('get command with different resources', () => {
            it('should handle "kubectl get pods"', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl get pods')

                expect(result.ok).toBe(true)
            })

            it('should handle "kubectl get deployments"', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl get deployments')

                expect(result.ok).toBe(true)
            })

            it('should handle "kubectl get services"', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl get services')

                expect(result.ok).toBe(true)
            })

            it('should handle "kubectl get namespaces"', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl get namespaces')

                expect(result.ok).toBe(true)
            })
        })

        describe('namespace handling', () => {
            it('should pass namespace to get handler from -n flag', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl get pods -n kube-system')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('redis-pod')
                    expect(result.value).not.toContain('nginx-pod')
                }
            })

            it('should pass namespace to describe handler', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl describe pod redis-pod -n kube-system')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('redis-pod')
                }
            })

            it('should use default namespace when not specified', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
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
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('invalid command')

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toBeTruthy()
                }
            })

            it('should return error for empty command', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('')

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toContain('empty')
                }
            })

            it('should return error when pod not found', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl describe pod nonexistent')

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toContain('not found')
                }
            })

            it('should return error for pod in wrong namespace', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl describe pod nginx-pod -n kube-system')

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toContain('not found')
                }
            })
        })

        describe('delete command', () => {
            it('should delete pod and return success message', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl delete pod nginx-pod')

                expect(result.ok).toBe(true)

                // Verify pod is actually deleted
                const pods = clusterState.getPods('default')
                expect(pods.find(p => p.metadata.name === 'nginx-pod')).toBeUndefined()
            })

            it('should delete pod with namespace specified', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl delete pod redis-pod -n kube-system')

                expect(result.ok).toBe(true)

                const pods = clusterState.getPods('kube-system')
                expect(pods.find(p => p.metadata.name === 'redis-pod')).toBeUndefined()
            })

            it('should return error when deleting nonexistent pod', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl delete pod nonexistent')

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toContain('not found')
                }
            })
        })

        describe('resource aliases', () => {
            it('should handle "kubectl get po" (pods alias)', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl get po')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('nginx-pod')
                }
            })

            it('should handle "kubectl describe po nginx-pod" (pod alias)', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl describe po nginx-pod')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('nginx-pod')
                }
            })

            it('should handle "kubectl delete po nginx-pod" (pod alias)', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl delete po nginx-pod')

                expect(result.ok).toBe(true)
            })
        })

        describe('integration with parser', () => {
            it('should handle complete command flow: parse → route → execute', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl get pods -n default')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toBeTruthy()
                    expect(result.value).toContain('nginx-pod')
                }
            })

            it('should propagate parser errors correctly', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl get invalidresource')

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toBeTruthy()
                }
            })

            it('should handle kubectl version --client command', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl version --client')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('Client Version: v1.35.0')
                    expect(result.value).toContain('Kustomize Version: v5.7.1')
                    expect(result.value).not.toContain('Server Version')
                }
            })

            it('should handle kubectl version command without --client flag', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl version')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('Client Version: v1.35.0')
                    expect(result.value).toContain('Kustomize Version: v5.7.1')
                    expect(result.value).toContain('Server Version: v1.35.0')
                }
            })

            it('should handle kubectl version --output json', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
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
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl version --output yaml')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('clientVersion:')
                    expect(result.value).toContain('kustomizeVersion: v5.7.1')
                    expect(result.value).toContain('serverVersion:')
                }
            })

            it('should return error for invalid --output value', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl version --output table')

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toContain("--output must be 'yaml' or 'json'")
                }
            })

            it('should handle kubectl cluster-info command', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl cluster-info')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('Kubernetes control plane is running at')
                    expect(result.value).toContain('To further debug and diagnose cluster problems')
                }
            })

            it('should handle kubectl cluster-info dump command', () => {
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
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
                const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)
                const result = executor.execute('kubectl cluster-info dump --all-namespaces')

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('"kind": "NodeList"')
                }
            })
        })
    })
})
