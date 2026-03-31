import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleDelete } from '../../../../../src/core/kubectl/commands/handlers/delete'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import {
  createApiServerFacade,
  type ApiServerFacade
} from '../../../../../src/core/api/ApiServerFacade'
import {
  createFileSystem,
  type FileSystem
} from '../../../../../src/core/filesystem/FileSystem'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createIngress } from '../../../../../src/core/cluster/ressources/Ingress'
import { createService } from '../../../../../src/core/cluster/ressources/Service'
import { createNamespace } from '../../../../../src/core/cluster/ressources/Namespace'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { expectErr, expectOk } from '../../../helpers/resultAssertions'

describe('kubectl delete handler', () => {
  let apiServer: ApiServerFacade
  let eventBus: ApiServerFacade['eventBus']
  let fileSystem: FileSystem

  beforeEach(() => {
    apiServer = createApiServerFacade()
    eventBus = apiServer.eventBus
    fileSystem = createFileSystem()
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'delete',
    resource: 'pods',
    flags: {},
    ...overrides
  })

  const expectPodMarkedTerminating = (
    name: string,
    namespace = 'default'
  ): void => {
    const podResult = apiServer.findResource('Pod', name, namespace)
    expect(podResult.ok).toBe(true)
    if (!podResult.ok) {
      return
    }
    expect(podResult.value.metadata.deletionTimestamp).toBeDefined()
  }

  describe('validation', () => {
    it('should return error when name is not provided', () => {
      const parsed = createParsedCommand({ name: undefined })

      const result = handleDelete(apiServer, parsed)
      const errorMessage = expectErr(result)
      expect(errorMessage).toContain('must specify the name')
    })
  })

  describe('declarative delete with -f', () => {
    it('should delete pod declared in manifest file', () => {
      apiServer.createResource(
        'Pod',
        createPod({
          name: 'decl-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })
      )
      fileSystem.createFile('pod.yaml')
      fileSystem.writeFile(
        'pod.yaml',
        `apiVersion: v1
kind: Pod
metadata:
  name: decl-pod
  namespace: default
spec:
  containers:
    - name: main
      image: nginx:latest
`
      )

      const parsed = createParsedCommand({
        flags: { f: 'pod.yaml' }
      })

      const result = handleDelete(apiServer, parsed, fileSystem)
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value).toContain(
        'pod "decl-pod" deleted from default namespace'
      )
      expectPodMarkedTerminating('decl-pod')
    })

    it('should return not found for manifest resource that does not exist', () => {
      fileSystem.createFile('missing-pod.yaml')
      fileSystem.writeFile(
        'missing-pod.yaml',
        `apiVersion: v1
kind: Pod
metadata:
  name: missing-pod
  namespace: default
spec:
  containers:
    - name: main
      image: nginx:latest
`
      )

      const parsed = createParsedCommand({
        flags: { filename: 'missing-pod.yaml' }
      })

      const result = handleDelete(apiServer, parsed, fileSystem)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('pods "missing-pod" not found')
      }
    })

    it('should return error when manifest file cannot be read', () => {
      const parsed = createParsedCommand({
        flags: { f: 'does-not-exist.yaml' }
      })

      const result = handleDelete(apiServer, parsed, fileSystem)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('No such file or directory')
      }
    })

    it('should return error when manifest content is invalid', () => {
      fileSystem.createFile('invalid.yaml')
      fileSystem.writeFile('invalid.yaml', 'not: [valid')

      const parsed = createParsedCommand({
        flags: { f: 'invalid.yaml' }
      })

      const result = handleDelete(apiServer, parsed, fileSystem)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('YAML parse error')
      }
    })

    it('should delete resources from sorted manifests in a directory', () => {
      apiServer.createResource(
        'Pod',
        createPod({
          name: 'alpha-del',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })
      )
      apiServer.createResource(
        'Pod',
        createPod({
          name: 'zulu-del',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })
      )

      const podYaml = (name: string) => `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: default
spec:
  containers:
    - name: main
      image: nginx:latest
`

      fileSystem.createDirectory('delete-manifests-dir')
      fileSystem.createFile('delete-manifests-dir/z.yaml')
      fileSystem.writeFile('delete-manifests-dir/z.yaml', podYaml('zulu-del'))
      fileSystem.createFile('delete-manifests-dir/a.yaml')
      fileSystem.writeFile('delete-manifests-dir/a.yaml', podYaml('alpha-del'))

      const parsed = createParsedCommand({
        flags: { f: 'delete-manifests-dir' }
      })

      const result = handleDelete(apiServer, parsed, fileSystem)
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }
      expect(result.value.split('\n')).toEqual([
        'pod "alpha-del" deleted from default namespace',
        'pod "zulu-del" deleted from default namespace'
      ])
      expectPodMarkedTerminating('alpha-del')
      expectPodMarkedTerminating('zulu-del')
    })

    it('should error when delete directory has no manifest files', () => {
      fileSystem.createDirectory('empty-delete-dir')

      const parsed = createParsedCommand({
        flags: { f: 'empty-delete-dir' }
      })

      const result = handleDelete(apiServer, parsed, fileSystem)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('error: no objects passed to delete')
      }
    })

    it('should error when delete directory has only non-manifest files', () => {
      fileSystem.createDirectory('txt-only-delete-dir')
      fileSystem.createFile('txt-only-delete-dir/note.txt')
      fileSystem.writeFile('txt-only-delete-dir/note.txt', 'hello')

      const parsed = createParsedCommand({
        flags: { f: 'txt-only-delete-dir' }
      })

      const result = handleDelete(apiServer, parsed, fileSystem)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('error: no objects passed to delete')
      }
    })
  })

  describe('deleting pods', () => {
    it('should delete existing pod', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      apiServer.createResource('Pod', pod)

      const parsed = createParsedCommand({
        name: 'my-pod',
        resource: 'pods'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('deleted')
        expect(result.value).toContain('my-pod')
      }
    })

    it('should emit PodUpdated event with deletion metadata', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('PodUpdated', subscriber)

      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      apiServer.createResource('Pod', pod)

      const parsed = createParsedCommand({
        name: 'my-pod',
        resource: 'pods'
      })

      handleDelete(apiServer, parsed)

      expect(subscriber).toHaveBeenCalled()
      expectPodMarkedTerminating('my-pod')
    })

    it('should return error for non-existent pod', () => {
      const parsed = createParsedCommand({
        name: 'nonexistent',
        resource: 'pods'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(false)
    })

    it('should delete pod in specified namespace', () => {
      apiServer.createResource(
        'Namespace',
        createNamespace({ name: 'production' })
      )
      const pod = createPod({
        name: 'my-pod',
        namespace: 'production',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      apiServer.createResource('Pod', pod)

      const parsed = createParsedCommand({
        name: 'my-pod',
        namespace: 'production',
        resource: 'pods'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
    })

    it('should delete multiple pods passed as positional names', () => {
      apiServer.createResource(
        'Pod',
        createPod({
          name: 'pod-1',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })
      )
      apiServer.createResource(
        'Pod',
        createPod({
          name: 'pod-2',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })
      )
      apiServer.createResource(
        'Pod',
        createPod({
          name: 'pod-3',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })
      )

      const parsed = createParsedCommand({
        name: 'pod-1',
        names: ['pod-1', 'pod-2', 'pod-3'],
        resource: 'pods'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value).toContain(
        'pod "pod-1" deleted from default namespace'
      )
      expect(result.value).toContain(
        'pod "pod-2" deleted from default namespace'
      )
      expect(result.value).toContain(
        'pod "pod-3" deleted from default namespace'
      )
      expectPodMarkedTerminating('pod-1')
      expectPodMarkedTerminating('pod-2')
      expectPodMarkedTerminating('pod-3')
    })

    it('should mark force deleted pod as Terminating before final removal', () => {
      apiServer.createResource(
        'Pod',
        createPod({
          name: 'force-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'busybox' }]
        })
      )
      const parsed = createParsedCommand({
        name: 'force-pod',
        resource: 'pods',
        deleteGracePeriodSeconds: 0,
        deleteForce: true
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      const podResult = apiServer.findResource('Pod', 'force-pod', 'default')
      expect(podResult.ok).toBe(true)
      if (!podResult.ok) {
        return
      }
      expect(podResult.value.metadata.deletionTimestamp).toBeDefined()
      expect(podResult.value.metadata.deletionGracePeriodSeconds).toBe(0)
    })
  })

  describe('deleting configmaps', () => {
    it('should delete existing configmap', () => {
      const cm = createConfigMap({
        name: 'my-config',
        namespace: 'default',
        data: { key: 'value' }
      })
      apiServer.createResource('ConfigMap', cm)

      const parsed = createParsedCommand({
        name: 'my-config',
        resource: 'configmaps'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('configmap')
        expect(result.value).toContain('deleted')
      }
    })

    it('should emit ConfigMapDeleted event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('ConfigMapDeleted', subscriber)

      const cm = createConfigMap({
        name: 'my-config',
        namespace: 'default',
        data: {}
      })
      apiServer.createResource('ConfigMap', cm)

      const parsed = createParsedCommand({
        name: 'my-config',
        resource: 'configmaps'
      })

      handleDelete(apiServer, parsed)

      expect(subscriber).toHaveBeenCalled()
    })

    it('should return error for non-existent configmap', () => {
      const parsed = createParsedCommand({
        name: 'nonexistent',
        resource: 'configmaps'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(false)
    })
  })

  describe('deleting secrets', () => {
    it('should delete existing secret', () => {
      const secret = createSecret({
        name: 'my-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {}
      })
      apiServer.createResource('Secret', secret)

      const parsed = createParsedCommand({
        name: 'my-secret',
        resource: 'secrets'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('secret')
        expect(result.value).toContain('deleted')
      }
    })

    it('should emit SecretDeleted event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('SecretDeleted', subscriber)

      const secret = createSecret({
        name: 'my-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {}
      })
      apiServer.createResource('Secret', secret)

      const parsed = createParsedCommand({
        name: 'my-secret',
        resource: 'secrets'
      })

      handleDelete(apiServer, parsed)

      expect(subscriber).toHaveBeenCalled()
    })

    it('should return error for non-existent secret', () => {
      const parsed = createParsedCommand({
        name: 'nonexistent',
        resource: 'secrets'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(false)
    })
  })

  describe('deleting other resources', () => {
    it('should delete deployment with kind-like message', () => {
      apiServer.createResource(
        'Deployment',
        createDeployment({
          name: 'my-deploy',
          namespace: 'default',
          replicas: 1,
          selector: { matchLabels: { app: 'my-deploy' } },
          template: {
            metadata: { labels: { app: 'my-deploy' } },
            spec: {
              containers: [{ name: 'my-deploy', image: 'nginx:latest' }]
            }
          }
        })
      )

      const parsed = createParsedCommand({
        name: 'my-deploy',
        resource: 'deployments'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('deployment.apps')
        expect(result.value).toContain('deleted from default namespace')
      }
    })

    it('should return not found for missing deployment', () => {
      const parsed = createParsedCommand({
        name: 'missing-deploy',
        resource: 'deployments'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain(
          'deployments.apps "missing-deploy" not found'
        )
      }
    })

    it('should delete service with namespace suffix', () => {
      apiServer.createResource(
        'Service',
        createService({
          name: 'my-service',
          namespace: 'default',
          selector: { app: 'my-app' },
          ports: [{ port: 80 }]
        })
      )

      const parsed = createParsedCommand({
        name: 'my-service',
        resource: 'services'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain(
          'service "my-service" deleted from default namespace'
        )
      }
    })

    it('should delete ingress with networking kind reference', () => {
      apiServer.createResource(
        'Ingress',
        createIngress({
          name: 'demo-ingress',
          namespace: 'default',
          spec: {
            rules: [
              {
                host: 'demo.example.com',
                http: {
                  paths: [
                    {
                      path: '/',
                      pathType: 'Prefix',
                      backend: {
                        service: {
                          name: 'frontend-service',
                          port: { number: 80 }
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        })
      )

      const parsed = createParsedCommand({
        name: 'demo-ingress',
        resource: 'ingresses'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('ingress.networking.k8s.io')
        expect(result.value).toContain('deleted from default namespace')
      }
    })

    it('should handle namespace delete (simulated)', () => {
      apiServer.createResource(
        'Namespace',
        createNamespace({ name: 'my-namespace' })
      )
      const parsed = createParsedCommand({
        name: 'my-namespace',
        resource: 'namespaces'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('namespace')
      }
    })

    it('should cascade delete namespaced resources when deleting namespace', () => {
      apiServer.createResource(
        'Namespace',
        createNamespace({ name: 'project-x' })
      )
      apiServer.createResource(
        'Pod',
        createPod({
          name: 'app-pod',
          namespace: 'project-x',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })
      )
      apiServer.createResource(
        'ConfigMap',
        createConfigMap({
          name: 'app-config',
          namespace: 'project-x',
          data: { key: 'value' }
        })
      )
      apiServer.createResource(
        'Service',
        createService({
          name: 'app-service',
          namespace: 'project-x',
          selector: { app: 'app' },
          ports: [{ port: 80 }]
        })
      )

      const parsed = createParsedCommand({
        name: 'project-x',
        resource: 'namespaces'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      expect(apiServer.findResource('Namespace', 'project-x').ok).toBe(false)
      expect(apiServer.listResources('Pod', 'project-x')).toHaveLength(0)
      expect(apiServer.listResources('ConfigMap', 'project-x')).toHaveLength(0)
      expect(apiServer.listResources('Service', 'project-x')).toHaveLength(0)
    })

    it('should handle unknown resource type', () => {
      const parsed = createParsedCommand({
        name: 'my-resource',
        resource: 'unknown' as unknown as ParsedCommand['resource']
      })

      const result = handleDelete(apiServer, parsed)
      const output = expectOk(result)
      expect(output).toContain('deleted')
    })
  })

  describe('delete by selector', () => {
    it('should return "No resources found" when selector matches nothing', () => {
      const parsed = createParsedCommand({
        resource: 'all',
        selector: { tier: 'experiment' }
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }
      expect(result.value).toBe('No resources found')
    })

    it('should delete matching resources for delete all -l', () => {
      apiServer.createResource(
        'Deployment',
        createDeployment({
          name: 'label-demo',
          namespace: 'default',
          replicas: 1,
          labels: { app: 'label-demo', tier: 'experiment' },
          selector: { matchLabels: { app: 'label-demo' } },
          template: {
            metadata: { labels: { app: 'label-demo' } },
            spec: {
              containers: [{ name: 'main', image: 'nginx:latest' }]
            }
          }
        })
      )

      const parsed = createParsedCommand({
        resource: 'all',
        selector: { tier: 'experiment' }
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }
      expect(result.value).toContain('deployment.apps "label-demo" deleted')
      const deploymentResult = apiServer.findResource(
        'Deployment',
        'label-demo',
        'default'
      )
      expect(deploymentResult.ok).toBe(false)
    })

    it('should delete resources matching notin and exists selectors', () => {
      apiServer.createResource(
        'Deployment',
        createDeployment({
          name: 'stable-app',
          namespace: 'default',
          replicas: 1,
          labels: { app: 'stable-app', track: 'stable', version: 'v1' },
          selector: { matchLabels: { app: 'stable-app' } },
          template: {
            metadata: { labels: { app: 'stable-app' } },
            spec: {
              containers: [{ name: 'main', image: 'nginx:latest' }]
            }
          }
        })
      )
      apiServer.createResource(
        'Deployment',
        createDeployment({
          name: 'canary-app',
          namespace: 'default',
          replicas: 1,
          labels: { app: 'canary-app', track: 'canary' },
          selector: { matchLabels: { app: 'canary-app' } },
          template: {
            metadata: { labels: { app: 'canary-app' } },
            spec: {
              containers: [{ name: 'main', image: 'nginx:latest' }]
            }
          }
        })
      )

      const parsed = createParsedCommand({
        resource: 'deployments',
        selector: {
          requirements: [
            {
              key: 'track',
              operator: 'NotIn',
              values: ['canary']
            },
            {
              key: 'version',
              operator: 'Exists',
              values: []
            }
          ]
        }
      })

      const result = handleDelete(apiServer, parsed)
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value).toContain('stable-app')
      expect(result.value).not.toContain('canary-app')
      expect(
        apiServer.findResource('Deployment', 'stable-app', 'default').ok
      ).toBe(false)
      expect(
        apiServer.findResource('Deployment', 'canary-app', 'default').ok
      ).toBe(true)
    })
  })

  describe('namespace handling', () => {
    it('should default to default namespace', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      apiServer.createResource('Pod', pod)

      const parsed = createParsedCommand({
        name: 'my-pod',
        resource: 'pods'
        // no namespace specified
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
    })

    it('should not find pod in wrong namespace', () => {
      apiServer.createResource(
        'Namespace',
        createNamespace({ name: 'production' })
      )
      const pod = createPod({
        name: 'my-pod',
        namespace: 'production',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      apiServer.createResource('Pod', pod)

      const parsed = createParsedCommand({
        name: 'my-pod',
        namespace: 'default',
        resource: 'pods'
      })

      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(false)
    })
  })
})
