import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createNode } from '../../../../src/core/cluster/ressources/Node'
import { createNamespace } from '../../../../src/core/cluster/ressources/Namespace'
import { createReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import { createService } from '../../../../src/core/cluster/ressources/Service'
import { createConfigMap } from '../../../../src/core/cluster/ressources/ConfigMap'
import { createHostFileSystem } from '../../../../src/core/filesystem/debianFileSystem'
import {
  createFileSystem,
  type FileSystem
} from '../../../../src/core/filesystem/FileSystem'
import { createKubectlExecutor } from '../../../../src/core/kubectl/commands/executor'
import { initializeSimNetworkRuntime } from '../../../../src/core/network/SimNetworkRuntime'
import type { EditorModal } from '../../../../src/core/shell/commands'
import { createLogger } from '../../../../src/logger/Logger'

describe('kubectl Executor', () => {
  describe('createKubectlExecutor', () => {
    let apiServer: ReturnType<typeof createApiServerFacade>
    let fileSystem: FileSystem
    let logger: ReturnType<typeof createLogger>

    beforeEach(() => {
      apiServer = createApiServerFacade()
      fileSystem = createFileSystem(createHostFileSystem())
      logger = createLogger()

      apiServer.createResource(
        'ConfigMap',
        createConfigMap({
          name: 'cluster-info',
          namespace: 'kube-public',
          data: {
            kubeconfig: [
              'apiVersion: v1',
              'kind: Config',
              'clusters:',
              '- cluster:',
              '    server: https://127.0.0.1:6443',
              '  name: kubernetes'
            ].join('\n')
          }
        })
      )

      // Seed with test pods
      apiServer.createResource(
        'Pod',
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
      apiServer.createResource(
        'Pod',
        createPod({
          name: 'redis-pod',
          namespace: 'kube-system',
          containers: [{ name: 'redis', image: 'redis:alpine', ports: [] }]
        })
      )
      apiServer.createResource(
        'Node',
        createNode({
          name: 'sim-worker',
          status: {
            nodeInfo: {
              architecture: 'amd64',
              containerRuntimeVersion: 'containerd://2.2.0',
              kernelVersion: '6.6.87.2-microsoft-standard-WSL2',
              kubeletVersion: 'v1.35.0',
              operatingSystem: 'linux',
              osImage: 'Debian GNU/Linux 12 (bookworm)'
            },
            addresses: [
              {
                type: 'InternalIP',
                address: '172.18.0.3'
              },
              {
                type: 'Hostname',
                address: 'sim-worker'
              }
            ],
            allocatable: {
              cpu: '4000m',
              memory: '8Gi'
            },
            conditions: [
              {
                type: 'Ready',
                status: 'True'
              }
            ]
          }
        })
      )
    })

    describe('command routing', () => {
      it('should route "kubectl get pods" to get handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get pods')
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('nginx-pod')
        }
      })

      it('should route "kubectl describe pod" to describe handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl describe pod nginx-pod')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('nginx-pod')
        }
      })

      it('should route "kubectl top pods" to top handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl top pods -A')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        expect(result.value).toContain('NAMESPACE')
        expect(result.value).toContain('nginx-pod')
      })

      it('should route "kubectl top nodes" to top handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl top nodes')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        expect(result.value).toContain('sim-worker')
        expect(result.value).toContain('CPU')
      })

      it('should route "kubectl describe pod -l app=probed" to selector describe flow', () => {
        apiServer.createResource(
          'Pod',
          createPod({
            name: 'probed-b',
            namespace: 'default',
            labels: { app: 'probed' },
            containers: [{ name: 'web', image: 'nginx:1.28', ports: [] }]
          })
        )
        apiServer.createResource(
          'Pod',
          createPod({
            name: 'probed-a',
            namespace: 'default',
            labels: { app: 'probed' },
            containers: [{ name: 'web', image: 'nginx:1.28', ports: [] }]
          })
        )

        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl describe pod -l app=probed')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('Name:                 probed-a')
        expect(result.value).toContain('Name:                 probed-b')
        expect(result.value).toContain('\n\n')
      })

      it('should route "kubectl describe deployment" to describe handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const created = executor.execute(
          'kubectl create deployment web-app --image=nginx:1.28 --replicas=3'
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

      it('should route "kubectl describe node" to describe handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl describe node sim-worker')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('Name:')
        expect(result.value).toContain('sim-worker')
        expect(result.value).toContain('Conditions:')
      })

      it('should route "kubectl delete pod" to delete handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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

        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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

        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl create -f deployment.yaml')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('created')
        }
      })

      it('should route "kubectl replace -f" to replace handler', () => {
        const initialYaml = `apiVersion: v1
kind: Pod
metadata:
  name: replace-pod
  namespace: default
spec:
  containers:
    - name: app
      image: nginx:1.28
`
        const updatedYaml = `apiVersion: v1
kind: Pod
metadata:
  name: replace-pod
  namespace: default
spec:
  containers:
    - name: app
      image: busybox:latest
`

        fileSystem.createFile('replace-pod-initial.yaml')
        fileSystem.writeFile('replace-pod-initial.yaml', initialYaml)
        fileSystem.createFile('replace-pod-updated.yaml')
        fileSystem.writeFile('replace-pod-updated.yaml', updatedYaml)

        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const createResult = executor.execute(
          'kubectl create -f replace-pod-initial.yaml'
        )
        expect(createResult.ok).toBe(true)

        const replaceResult = executor.execute(
          'kubectl replace -f replace-pod-updated.yaml'
        )
        expect(replaceResult.ok).toBe(true)
        if (!replaceResult.ok) {
          return
        }

        expect(replaceResult.value).toContain('pod/replace-pod replaced')
      })

      it('should route "kubectl set image" to set image handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const createResult = executor.execute(
          'kubectl create deployment web-app --image=nginx:1.25'
        )
        expect(createResult.ok).toBe(true)

        const setResult = executor.execute(
          'kubectl set image deployment/web-app nginx=nginx:1.26'
        )
        expect(setResult.ok).toBe(true)
        if (!setResult.ok) {
          return
        }
        expect(setResult.value).toContain(
          'deployment.apps/web-app image updated'
        )

        const deployment = apiServer.findResource(
          'Deployment',
          'web-app',
          'default'
        )
        expect(deployment.ok).toBe(true)
        if (!deployment.ok) {
          return
        }
        expect(deployment.value.spec.template.spec.containers[0].image).toBe(
          'nginx:1.26'
        )
      })

      it('should route "kubectl rollout status" to rollout handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const createResult = executor.execute(
          'kubectl create deployment web-app --image=nginx:1.28 --replicas=3'
        )
        expect(createResult.ok).toBe(true)

        const rolloutResult = executor.execute(
          'kubectl rollout status deployment/web-app --watch=false'
        )
        expect(rolloutResult.ok).toBe(true)
        if (!rolloutResult.ok) {
          return
        }
        expect(rolloutResult.value).toContain(
          'Waiting for deployment "web-app" rollout to finish'
        )
      })

      it('should route "kubectl patch" to patch handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const createResult = executor.execute(
          'kubectl create deployment my-app --image=nginx:1.28 --replicas=2'
        )
        expect(createResult.ok).toBe(true)

        const patchResult = executor.execute(
          `kubectl patch deployment my-app --type=merge -p '{"spec":{"replicas":4}}'`
        )
        expect(patchResult.ok).toBe(true)
        if (!patchResult.ok) {
          return
        }
        expect(patchResult.value).toContain('deployment.apps/my-app patched')

        const deployment = apiServer.findResource(
          'Deployment',
          'my-app',
          'default'
        )
        expect(deployment.ok).toBe(true)
        if (!deployment.ok) {
          return
        }
        expect(deployment.value.spec.replicas).toBe(4)
      })

      it('should route "kubectl edit" to edit handler and persist saved changes', () => {
        let capturedContent = ''
        let capturedSave: ((newContent: string) => void) | undefined
        const editorModal: EditorModal = {
          open: (_filename, content, onSave) => {
            capturedContent = content
            capturedSave = onSave
          }
        }

        const executor = createKubectlExecutor(
          apiServer,
          fileSystem,
          logger,
          undefined,
          undefined,
          {
            editorModal
          }
        )
        const result = executor.execute('kubectl edit pod nginx-pod')
        expect(result.ok).toBe(true)
        expect(capturedSave).toBeDefined()
        if (capturedSave == null) {
          return
        }

        capturedSave(capturedContent.replace('nginx:latest', 'nginx:1.26'))
        const pod = apiServer.findResource('Pod', 'nginx-pod', 'default')
        expect(pod.ok).toBe(true)
        if (!pod.ok) {
          return
        }
        expect(pod.value.spec.containers[0].image).toBe('nginx:1.26')
      })

      it('should return yaml for create -f dry-run client without creating resource', () => {
        const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config-dry-run
data:
  key: value
`
        fileSystem.createFile('configmap-dry-run.yaml')
        fileSystem.writeFile('configmap-dry-run.yaml', yaml)

        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create -f configmap-dry-run.yaml --dry-run=client -o yaml'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('apiVersion: v1')
        expect(result.value).toContain('kind: ConfigMap')
        expect(result.value).toContain('name: test-config-dry-run')

        const configMap = apiServer.findResource(
          'ConfigMap',
          'test-config-dry-run',
          'default'
        )
        expect(configMap.ok).toBe(false)
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

        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl diff -f configmap.yaml')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('diff -u -N /tmp/LIVE-')
        expect(result.value).toContain('/tmp/MERGED-')
      })

      it('should route "kubectl run" to run handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run test-pod --image=busybox --command -- sleep 3600'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('pod/test-pod created')
      })

      it('should route "kubectl expose deployment" to expose handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const createResult = executor.execute(
          'kubectl create deployment web --image=nginx --port=8080'
        )
        expect(createResult.ok).toBe(true)

        const exposeResult = executor.execute(
          'kubectl expose deployment web --port=80 -n default'
        )
        expect(exposeResult.ok).toBe(true)
        if (!exposeResult.ok) {
          return
        }
        expect(exposeResult.value).toContain('service/web exposed')
      })

      it('should route "kubectl expose pod" to expose handler', () => {
        apiServer.createResource(
          'Pod',
          createPod({
            name: 'web-prod',
            namespace: 'default',
            labels: { app: 'web', env: 'prod', track: 'stable' },
            containers: [
              { name: 'web', image: 'nginx', ports: [{ containerPort: 8080 }] }
            ]
          })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const exposeResult = executor.execute(
          'kubectl expose pod web-prod --name=web-svc --port=80 --selector="app=web,env=prod,track=stable"'
        )

        expect(exposeResult.ok).toBe(true)
        if (!exposeResult.ok) {
          return
        }
        expect(exposeResult.value).toContain('service/web-svc exposed')

        const service = apiServer.findResource('Service', 'web-svc', 'default')
        expect(service.ok).toBe(true)
        if (!service.ok) {
          return
        }
        expect(service.value.spec.selector).toEqual({
          app: 'web',
          env: 'prod',
          track: 'stable'
        })
      })

      it('should update endpoints according to expose selector', () => {
        const networkRuntime = initializeSimNetworkRuntime(apiServer)
        apiServer.createResource(
          'Pod',
          createPod({
            name: 'web-prod',
            namespace: 'default',
            labels: { app: 'web', env: 'prod', track: 'stable' },
            phase: 'Running',
            podIP: '10.244.0.10',
            containers: [
              { name: 'web', image: 'nginx', ports: [{ containerPort: 8080 }] }
            ]
          })
        )
        apiServer.createResource(
          'Pod',
          createPod({
            name: 'web-canary',
            namespace: 'default',
            labels: { app: 'web', env: 'prod', track: 'canary' },
            phase: 'Running',
            podIP: '10.244.0.11',
            containers: [
              { name: 'web', image: 'nginx', ports: [{ containerPort: 8080 }] }
            ]
          })
        )

        const executor = createKubectlExecutor(
          apiServer,
          fileSystem,
          logger,
          networkRuntime
        )
        const exposeResult = executor.execute(
          'kubectl expose pod web-prod --name=web-svc --port=80 --selector="app=web,env=prod,track=stable"'
        )
        expect(exposeResult.ok).toBe(true)
        if (!exposeResult.ok) {
          networkRuntime.controller.stop()
          return
        }

        const describeService = executor.execute(
          'kubectl describe service web-svc'
        )
        expect(describeService.ok).toBe(true)
        if (!describeService.ok) {
          networkRuntime.controller.stop()
          return
        }
        expect(describeService.value).toContain(
          'Endpoints:                10.244.0.10:8080'
        )
        expect(describeService.value).not.toContain('10.244.0.11:8080')

        const getEndpoints = executor.execute('kubectl get endpoints web-svc')
        expect(getEndpoints.ok).toBe(true)
        if (!getEndpoints.ok) {
          networkRuntime.controller.stop()
          return
        }
        expect(getEndpoints.value).toContain('10.244.0.10:8080')
        expect(getEndpoints.value).not.toContain('10.244.0.11:8080')

        const getEndpointSlices = executor.execute(
          'kubectl get endpointslices -l kubernetes.io/service-name=web-svc'
        )
        expect(getEndpointSlices.ok).toBe(true)
        if (!getEndpointSlices.ok) {
          networkRuntime.controller.stop()
          return
        }
        expect(getEndpointSlices.value).toContain('web-svc-')
        expect(getEndpointSlices.value).toContain('10.244.0.10')
        expect(getEndpointSlices.value).not.toContain('10.244.0.11')

        const deleteService = executor.execute('kubectl delete service web-svc')
        expect(deleteService.ok).toBe(true)
        const exposeBrokenSelector = executor.execute(
          'kubectl expose pod web-prod --name=web-svc --port=80 --selector="app=doesnotexist"'
        )
        expect(exposeBrokenSelector.ok).toBe(true)
        const getBrokenEndpoints = executor.execute(
          'kubectl get endpoints web-svc'
        )
        expect(getBrokenEndpoints.ok).toBe(true)
        if (!getBrokenEndpoints.ok) {
          networkRuntime.controller.stop()
          return
        }
        expect(getBrokenEndpoints.value).toContain('<none>')

        const getBrokenEndpointSlices = executor.execute(
          'kubectl get endpointslices -l kubernetes.io/service-name=web-svc'
        )
        expect(getBrokenEndpointSlices.ok).toBe(true)
        if (!getBrokenEndpointSlices.ok) {
          networkRuntime.controller.stop()
          return
        }
        expect(getBrokenEndpointSlices.value).toContain('web-svc-')
        expect(getBrokenEndpointSlices.value).toContain('<none>')
        networkRuntime.controller.stop()
      })

      it('should route "kubectl create namespace" to create handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl create namespace my-team')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('namespace/my-team created')
      })

      it('should return namespace yaml for create namespace dry-run client', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create namespace dry-run-ns --dry-run=client -o yaml'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('apiVersion: v1')
        expect(result.value).toContain('kind: Namespace')
        expect(result.value).toContain('name: dry-run-ns')
        expect(result.value).toContain('spec: {}')
        expect(result.value).toContain('status: {}')

        const namespace = apiServer.findResource('Namespace', 'dry-run-ns')
        expect(namespace.ok).toBe(false)
      })

      it('should create service clusterip from imperative create command', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create service clusterip my-svc --tcp=80:8080'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('service/my-svc created')
        const service = apiServer.findResource('Service', 'my-svc', 'default')
        expect(service.ok).toBe(true)
        if (!service.ok) {
          return
        }
        expect(service.value.spec.type).toBe('ClusterIP')
        expect(service.value.spec.selector).toEqual({ app: 'my-svc' })
        expect(service.value.spec.ports[0].port).toBe(80)
        expect(service.value.spec.ports[0].targetPort).toBe(8080)
      })

      it('should return service yaml for create service nodeport dry-run client', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create service nodeport my-svc --tcp=80:8080 --node-port=30080 --dry-run=client -o yaml'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('kind: Service')
        expect(result.value).toContain('name: my-svc')
        expect(result.value).toContain('type: NodePort')
        expect(result.value).toContain('nodePort: 30080')
        expect(result.value).toContain('labels:')
        expect(result.value).toContain('app: my-svc')
        expect(result.value).toContain('name: 80-8080')
        expect(result.value).toContain('loadBalancer: {}')

        const service = apiServer.findResource('Service', 'my-svc', 'default')
        expect(service.ok).toBe(false)
      })

      it('should create service externalname with external-name flag', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create service externalname ext-svc --external-name=example.com'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        const service = apiServer.findResource('Service', 'ext-svc', 'default')
        expect(service.ok).toBe(true)
        if (!service.ok) {
          return
        }
        expect(service.value.spec.type).toBe('ExternalName')
        expect(service.value.spec.externalName).toBe('example.com')
      })

      it('should return configmap yaml for create configmap dry-run client', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create configmap app-config --from-literal=LOG_LEVEL=info --dry-run=client -o yaml'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('kind: ConfigMap')
        expect(result.value).toContain('name: app-config')
        expect(result.value).not.toContain('creationTimestamp: null')
        expect(result.value).toContain('LOG_LEVEL: info')

        const configMap = apiServer.findResource(
          'ConfigMap',
          'app-config',
          'default'
        )
        expect(configMap.ok).toBe(false)
      })

      it('should return secret generic yaml for create secret dry-run client', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create secret generic mysecret --from-literal=password=s3cr3t --dry-run=client -o yaml'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('kind: Secret')
        expect(result.value).toContain('name: mysecret')
        expect(result.value).not.toContain('type: Opaque')
        expect(result.value).toContain('password: czNjcjN0')
        const secret = apiServer.findResource('Secret', 'mysecret', 'default')
        expect(secret.ok).toBe(false)
      })

      it('should create secret tls from cert and key files', () => {
        fileSystem.createFile('tls.crt')
        fileSystem.writeFile('tls.crt', 'CERTDATA')
        fileSystem.createFile('tls.key')
        fileSystem.writeFile('tls.key', 'KEYDATA')

        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create secret tls tls-secret --cert=tls.crt --key=tls.key'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        const secret = apiServer.findResource('Secret', 'tls-secret', 'default')
        expect(secret.ok).toBe(true)
        if (!secret.ok) {
          return
        }
        expect(secret.value.type.type).toBe('kubernetes.io/tls')
      })

      it('should return docker-registry secret yaml for dry-run client', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create secret docker-registry regcred --docker-server=docker.io --docker-username=alice --docker-password=s3cr3t --dry-run=client -o yaml'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('kind: Secret')
        expect(result.value).toContain('name: regcred')
        expect(result.value).toContain('type: kubernetes.io/dockerconfigjson')
      })
    })

    describe('create deployment (imperative)', () => {
      it('should create a deployment with one image', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('deployment.apps/my-dep created')
        const deployment = apiServer.findResource(
          'Deployment',
          'my-dep',
          'default'
        )
        expect(deployment.ok).toBe(true)
      })

      it('should expose app label on deployment metadata after imperative create', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const created = executor.execute(
          'kubectl create deployment my-app --image=nginx'
        )
        expect(created.ok).toBe(true)

        const labels = executor.execute(
          "kubectl get deployment my-app -o jsonpath='{.metadata.labels}'"
        )
        expect(labels.ok).toBe(true)
        if (!labels.ok) {
          return
        }
        expect(labels.value).toBe('{"app":"my-app"}')
      })

      it('should label deployment after imperative create', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const created = executor.execute(
          'kubectl create deployment label-demo --image=nginx'
        )
        expect(created.ok).toBe(true)

        const labeled = executor.execute(
          'kubectl label deployment label-demo tier=experiment'
        )
        expect(labeled.ok).toBe(true)
        if (!labeled.ok) {
          return
        }
        expect(labeled.value).toBe('deployment/label-demo labeled')

        const labels = executor.execute(
          "kubectl get deployment label-demo -o jsonpath='{.metadata.labels}'"
        )
        expect(labels.ok).toBe(true)
        if (!labels.ok) {
          return
        }
        expect(labels.value).toBe('{"app":"label-demo","tier":"experiment"}')
      })

      it('should reject plural resource token in imperative create', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create deployments my-dep --dry-run=client -o json'
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain(
            'Unexpected args: [deployments my-dep]'
          )
        }
      })

      it('should create a deployment with command after --', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox -- date'
        )

        expect(result.ok).toBe(true)
        const deployment = apiServer.findResource(
          'Deployment',
          'my-dep',
          'default'
        )
        expect(deployment.ok).toBe(true)
        if (!deployment.ok) {
          return
        }

        expect(
          deployment.value.spec.template.spec.containers[0].command
        ).toEqual(['date'])
      })

      it('should create a deployment with replicas', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create deployment my-dep --image=nginx --replicas=3'
        )

        expect(result.ok).toBe(true)
        const deployment = apiServer.findResource(
          'Deployment',
          'my-dep',
          'default'
        )
        expect(deployment.ok).toBe(true)
        if (!deployment.ok) {
          return
        }

        expect(deployment.value.spec.replicas).toBe(3)
      })

      it('should return deployment yaml for create deployment dry-run client', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create deployment myapp --image=nginx --replicas=3 --dry-run=client -o yaml'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('apiVersion: apps/v1')
        expect(result.value).toContain('kind: Deployment')
        expect(result.value).toContain('name: myapp')
        expect(result.value).toContain('replicas: 3')
        expect(result.value).not.toContain('creationTimestamp: null')
        expect(result.value).toContain('status: {}')
        expect(result.value).not.toContain('readyReplicas: 0')

        const deployment = apiServer.findResource(
          'Deployment',
          'myapp',
          'default'
        )
        expect(deployment.ok).toBe(false)
      })

      it('should create a deployment with exposed container port', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox --port=5701'
        )

        expect(result.ok).toBe(true)
        const deployment = apiServer.findResource(
          'Deployment',
          'my-dep',
          'default'
        )
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox:latest --image=ubuntu:latest --image=nginx'
        )

        expect(result.ok).toBe(true)
        const deployment = apiServer.findResource(
          'Deployment',
          'my-dep',
          'default'
        )
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create deployment my-dep --image busybox'
        )

        expect(result.ok).toBe(true)
        const deployment = apiServer.findResource(
          'Deployment',
          'my-dep',
          'default'
        )
        expect(deployment.ok).toBe(true)
        if (!deployment.ok) {
          return
        }

        expect(deployment.value.spec.template.spec.containers[0].image).toBe(
          'busybox'
        )
      })

      it('should create deployment in a specific namespace', () => {
        apiServer.createResource(
          'Namespace',
          createNamespace({ name: 'staging' })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create deployment my-dep --image=busybox -n staging'
        )

        expect(result.ok).toBe(true)
        const deployment = apiServer.findResource(
          'Deployment',
          'my-dep',
          'staging'
        )
        expect(deployment.ok).toBe(true)
      })

      it('should parse name correctly when namespace flag is before name', () => {
        apiServer.createResource(
          'Namespace',
          createNamespace({ name: 'staging' })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl create deployment -n staging my-dep --image=busybox'
        )

        expect(result.ok).toBe(true)
        const deployment = apiServer.findResource(
          'Deployment',
          'my-dep',
          'staging'
        )
        expect(deployment.ok).toBe(true)
      })
    })

    describe('get command with different resources', () => {
      it('should handle "kubectl get pods"', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get pods')

        expect(result.ok).toBe(true)
      })

      it('should handle kubectl get pod with jsonpath output', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          "kubectl get pod nginx-pod -o jsonpath='{.metadata.uid}'"
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value.length).toBeGreaterThan(10)
        expect(result.value).toContain('-')
      })

      it('should fail kubectl get with invalid output format', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get pods -o banana')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain(
            '--output must be one of: json|yaml|wide|name|jsonpath'
          )
        }
      })

      it('should handle "kubectl get all"', () => {
        apiServer.createResource(
          'Service',
          createService({
            name: 'kubernetes',
            namespace: 'default',
            clusterIP: '10.96.0.1',
            ports: [{ port: 443, protocol: 'TCP' }]
          })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get all')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('service/kubernetes')
        }
      })

      it('should handle "kubectl get deployments"', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get deployments')

        expect(result.ok).toBe(true)
      })

      it('should report not found per extra positional name in get', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const created = executor.execute(
          'kubectl create deployment my-app --image=nginx'
        )
        expect(created.ok).toBe(true)

        const result = executor.execute(
          "kubectl get deployments my-app o jsonpath='{.metadata.labels}'"
        )
        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        expect(result.value).toContain('my-app')
        expect(result.value).toContain(
          'Error from server (NotFound): deployments.apps "o" not found'
        )
        expect(result.value).toContain(
          `Error from server (NotFound): deployments.apps "jsonpath='{.metadata.labels}'" not found`
        )
      })

      it('should handle "kubectl get services"', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get services')

        expect(result.ok).toBe(true)
      })

      it('should handle "kubectl get namespaces"', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get namespaces')

        expect(result.ok).toBe(true)
      })

      it('should support kubectl get nodes with filtered jsonpath', () => {
        apiServer.createResource(
          'Node',
          createNode({
            name: 'sim-worker-ext',
            status: {
              nodeInfo: {
                architecture: 'amd64',
                containerRuntimeVersion: 'containerd://2.2.0',
                kernelVersion: '6.6.87.2-microsoft-standard-WSL2',
                kubeletVersion: 'v1.35.0',
                operatingSystem: 'linux',
                osImage: 'Debian GNU/Linux 12 (bookworm)'
              },
              addresses: [
                {
                  type: 'InternalIP',
                  address: '172.18.0.4'
                },
                {
                  type: 'ExternalIP',
                  address: '35.1.1.9'
                },
                {
                  type: 'Hostname',
                  address: 'sim-worker-ext'
                }
              ],
              allocatable: {
                cpu: '4000m',
                memory: '8Gi'
              },
              conditions: [
                {
                  type: 'Ready',
                  status: 'True'
                }
              ]
            }
          })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl get nodes -o jsonpath=\'{.items[*].status.addresses[?(@.type=="ExternalIP")].address}\''
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        expect(result.value).toBe('35.1.1.9')
      })

      it('should support kubectl get nodes with nested range template', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          "kubectl get nodes -o jsonpath='{range .items[*]}{@.metadata.name}:{range @.status.conditions[*]}{@.type}={@.status};{end}{end}'"
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        expect(result.value).toContain('sim-worker:Ready=True;')
      })

      it('should support kubectl get pods initContainerStatuses range template', () => {
        apiServer.createResource(
          'Pod',
          createPod({
            name: 'pod-with-init',
            namespace: 'default',
            initContainers: [{ name: 'init-db', image: 'busybox:1.36' }],
            containers: [{ name: 'app', image: 'nginx:latest' }],
            phase: 'Running'
          })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl get pods -o jsonpath=\'{range .items[*].status.initContainerStatuses[*]}{.containerID}{"\\n"}{end}\''
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        expect(result.value).toContain('containerd://')
      })
    })

    describe('namespace handling', () => {
      it('should handle namespace lifecycle create duplicate delete and not found', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)

        const created = executor.execute('kubectl create namespace my-team')
        expect(created.ok).toBe(true)
        if (!created.ok) {
          return
        }
        expect(created.value).toContain('namespace/my-team created')

        const listResult = executor.execute('kubectl get namespaces')
        expect(listResult.ok).toBe(true)
        if (!listResult.ok) {
          return
        }
        expect(listResult.value).toContain('my-team')

        const duplicate = executor.execute('kubectl create namespace my-team')
        expect(duplicate.ok).toBe(false)
        if (!duplicate.ok) {
          expect(duplicate.error).toContain('Error from server (AlreadyExists)')
          expect(duplicate.error).toContain(
            'namespaces "my-team" already exists'
          )
        }

        const deleted = executor.execute('kubectl delete namespace my-team')
        expect(deleted.ok).toBe(true)
        if (!deleted.ok) {
          return
        }
        expect(deleted.value).toContain('namespace "my-team" deleted')

        const afterDelete = executor.execute('kubectl get namespace my-team')
        expect(afterDelete.ok).toBe(false)
        if (!afterDelete.ok) {
          expect(afterDelete.error).toContain(
            'Error from server (NotFound): namespaces "my-team" not found'
          )
        }
      })

      it('should pass namespace to get handler from -n flag', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get pods -n kube-system')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('redis-pod')
          expect(result.value).not.toContain('nginx-pod')
        }
      })

      it('should parse get when namespace flag is before resource', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get -n kube-system pods')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('redis-pod')
          expect(result.value).not.toContain('nginx-pod')
        }
      })

      it('should pass namespace to describe handler', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl describe pod redis-pod -n kube-system'
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('redis-pod')
        }
      })

      it('should parse describe when namespace flag is before pod name', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl describe pod -n kube-system redis-pod'
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('redis-pod')
        }
      })

      it('should use default namespace when not specified', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('invalid command')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toBeTruthy()
        }
      })

      it('should return error for empty command', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('empty')
        }
      })

      it('should return error when pod not found', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl describe pod nonexistent')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('not found')
        }
      })

      it('should return error for pod in wrong namespace', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl delete pod nginx-pod')

        expect(result.ok).toBe(true)

        // Verify pod is marked for deletion (kubernetes-like two-phase deletion)
        const pods = apiServer.listResources('Pod', 'default')
        const remainingPod = pods.find((p) => p.metadata.name === 'nginx-pod')
        expect(remainingPod).toBeDefined()
        if (remainingPod == null) {
          return
        }
        expect(remainingPod.metadata.deletionTimestamp).toBeDefined()
      })

      it('should delete pod with namespace specified', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl delete pod redis-pod -n kube-system'
        )

        expect(result.ok).toBe(true)

        const pods = apiServer.listResources('Pod', 'kube-system')
        const remainingPod = pods.find((p) => p.metadata.name === 'redis-pod')
        expect(remainingPod).toBeDefined()
        if (remainingPod == null) {
          return
        }
        expect(remainingPod.metadata.deletionTimestamp).toBeDefined()
      })

      it('should delete pod when namespace flag is before resource', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl delete -n kube-system pod redis-pod'
        )

        expect(result.ok).toBe(true)

        const pods = apiServer.listResources('Pod', 'kube-system')
        const remainingPod = pods.find((p) => p.metadata.name === 'redis-pod')
        expect(remainingPod).toBeDefined()
        if (remainingPod == null) {
          return
        }
        expect(remainingPod.metadata.deletionTimestamp).toBeDefined()
      })

      it('should delete pod from manifest file with -f', () => {
        fileSystem.createFile('delete-pod.yaml')
        fileSystem.writeFile(
          'delete-pod.yaml',
          `apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  namespace: default
spec:
  containers:
    - name: nginx
      image: nginx:latest
`
        )

        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl delete -f delete-pod.yaml')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        expect(result.value).toContain(
          'pod "nginx-pod" deleted from default namespace'
        )

        const pods = apiServer.listResources('Pod', 'default')
        const remainingPod = pods.find((p) => p.metadata.name === 'nginx-pod')
        expect(remainingPod).toBeDefined()
        if (remainingPod == null) {
          return
        }
        expect(remainingPod.metadata.deletionTimestamp).toBeDefined()
      })

      it('should return error when deleting nonexistent pod', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl delete pod nonexistent')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('not found')
        }
      })

      it('should support delete all from label selector', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const created = executor.execute(
          'kubectl create deployment label-demo --image=nginx'
        )
        expect(created.ok).toBe(true)
        const labeled = executor.execute(
          'kubectl label deployment label-demo tier=experiment'
        )
        expect(labeled.ok).toBe(true)

        const deleted = executor.execute(
          'kubectl delete all -l tier=experiment'
        )
        expect(deleted.ok).toBe(true)
        if (!deleted.ok) {
          return
        }
        expect(deleted.value).toContain('deployment.apps "label-demo" deleted')
      })

      it('should return "No resources found" for delete all label with no match', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl delete all -l tier=experiment')
        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        expect(result.value).toBe('No resources found')
      })
    })

    describe('resource aliases', () => {
      it('should handle "kubectl get po" (pods alias)', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get po')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('nginx-pod')
        }
      })

      it('should handle "kubectl describe po nginx-pod" (pod alias)', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl describe po nginx-pod')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('nginx-pod')
        }
      })

      it('should handle "kubectl describe no sim-worker" (node alias)', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl describe no sim-worker')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('sim-worker')
        }
      })

      it('should handle "kubectl describe rs web-rs" (replicaset alias)', () => {
        apiServer.createResource(
          'ReplicaSet',
          createReplicaSet({
            name: 'web-rs',
            namespace: 'default',
            replicas: 2,
            selector: { matchLabels: { app: 'web' } },
            template: {
              metadata: { labels: { app: 'web' } },
              spec: {
                containers: [{ name: 'nginx', image: 'nginx:1.28' }]
              }
            }
          })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl describe rs web-rs')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('Name:         web-rs')
          expect(result.value).toContain('Replicas:     0 current / 2 desired')
        }
      })

      it('should handle "kubectl describe replicaset web-rs" (singular alias)', () => {
        apiServer.createResource(
          'ReplicaSet',
          createReplicaSet({
            name: 'web-rs',
            namespace: 'default',
            replicas: 1,
            selector: { matchLabels: { app: 'web' } },
            template: {
              metadata: { labels: { app: 'web' } },
              spec: {
                containers: [{ name: 'nginx', image: 'nginx:1.28' }]
              }
            }
          })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl describe replicaset web-rs')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('Name:         web-rs')
          expect(result.value).toContain('Replicas:     0 current / 1 desired')
        }
      })

      it('should handle "kubectl delete po nginx-pod" (pod alias)', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl delete po nginx-pod')

        expect(result.ok).toBe(true)
      })
    })

    describe('integration with parser', () => {
      const seedConfigCommandKubeconfig = (): void => {
        const kubeconfig = [
          'apiVersion: v1',
          'kind: Config',
          'clusters:',
          '- cluster:',
          '    certificate-authority-data: DATA+OMITTED',
          '    server: https://127.0.0.1:34001',
          '  name: kind-conformance',
          'contexts:',
          '- context:',
          '    cluster: kind-conformance',
          '    user: kind-conformance',
          '  name: kind-conformance',
          'current-context: kind-conformance',
          'users:',
          '- name: kind-conformance',
          '  user:',
          '    client-certificate-data: DATA+OMITTED',
          '    client-key-data: DATA+OMITTED',
          '- name: e2e',
          '  user:',
          '    username: admin',
          '    password: secret'
        ].join('\n')
        const writeResult = fileSystem.writeFile(
          '/home/kube/.kube/config',
          kubeconfig
        )
        expect(writeResult.ok).toBe(true)
      }

      it('should return root help for kubectl -h', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get --help')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('Display one or many resources.')
        expect(result.value).toContain('Usage:')
      })

      it('should return create deployment help without executing command', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const before = apiServer.listResources('Deployment', 'default').length
        const result = executor.execute('kubectl create deployment --help')
        const after = apiServer.listResources('Deployment', 'default').length

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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get pods -n default')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toBeTruthy()
          expect(result.value).toContain('nginx-pod')
        }
      })

      it('should execute kubectl get --raw / and return discovery root JSON', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get --raw / -o json')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain(
            '--raw and --output are mutually exclusive'
          )
        }
      })

      it('should propagate parser errors correctly', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl get invalidresource')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toBeTruthy()
        }
      })

      it('should handle kubectl version --client command', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl version --client')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('Client Version: v1.35.0')
          expect(result.value).toContain('Kustomize Version: v5.7.1')
          expect(result.value).not.toContain('Server Version')
        }
      })

      it('should handle kubectl version command without --client flag', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl version')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('Client Version: v1.35.0')
          expect(result.value).toContain('Kustomize Version: v5.7.1')
          expect(result.value).toContain('Server Version: v1.35.0')
        }
      })

      it('should handle kubectl version --output json', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl version --output yaml')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('clientVersion:')
          expect(result.value).toContain('kustomizeVersion: v5.7.1')
          expect(result.value).toContain('serverVersion:')
        }
      })

      it('should return error for invalid --output value', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl version --output table')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain("--output must be 'yaml' or 'json'")
        }
      })

      it('should handle kubectl cluster-info command', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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

      it('should handle kubectl config current-context command', () => {
        seedConfigCommandKubeconfig()
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl config current-context')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('kind-conformance')
      })

      it('should handle kubectl config get-contexts command', () => {
        seedConfigCommandKubeconfig()
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl config get-contexts')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('CURRENT')
        expect(result.value).toContain('kind-conformance')
        expect(result.value).toContain('*')
      })

      it('should handle kubectl config view --minify command', () => {
        seedConfigCommandKubeconfig()
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl config view --minify')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('current-context: kind-conformance')
        expect(result.value).toContain(
          'certificate-authority-data: DATA+OMITTED'
        )
      })

      it('should redact kubeconfig certificate fields in config view --minify', () => {
        const kubeconfigWithCertificates = [
          'apiVersion: v1',
          'kind: Config',
          'clusters:',
          '- cluster:',
          '    certificate-authority-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t',
          '    server: https://127.0.0.1:34001',
          '  name: kind-conformance',
          'contexts:',
          '- context:',
          '    cluster: kind-conformance',
          '    user: kind-conformance',
          '  name: kind-conformance',
          'current-context: kind-conformance',
          'users:',
          '- name: kind-conformance',
          '  user:',
          '    client-certificate-data: LS0tLS1CRUdJTiBDTElFTlQtQ0VSVC0tLS0t',
          '    client-key-data: LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t'
        ].join('\n')
        const writeResult = fileSystem.writeFile(
          '/home/kube/.kube/config',
          kubeconfigWithCertificates
        )
        expect(writeResult.ok).toBe(true)
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl config view --minify')

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain(
          'certificate-authority-data: DATA+OMITTED'
        )
        expect(result.value).toContain('client-certificate-data: DATA+OMITTED')
        expect(result.value).toContain('client-key-data: DATA+OMITTED')
        expect(result.value).not.toContain(
          'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t'
        )
        expect(result.value).not.toContain(
          'LS0tLS1CRUdJTiBDTElFTlQtQ0VSVC0tLS0t'
        )
        expect(result.value).not.toContain(
          'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t'
        )
      })

      it('should handle kubectl config view with jsonpath output', () => {
        seedConfigCommandKubeconfig()
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          "kubectl config view -o jsonpath='{.current-context}'"
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toBe('kind-conformance')
      })

      it('should support kubectl config view jsonpath first-user shortcut', () => {
        seedConfigCommandKubeconfig()
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          "kubectl config view -o jsonpath='{.users[].name}'"
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toBe('kind-conformance')
      })

      it('should support kubectl config view jsonpath wildcard users list', () => {
        seedConfigCommandKubeconfig()
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          "kubectl config view -o jsonpath='{.users[*].name}'"
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toBe('kind-conformance e2e')
      })

      it('should set current context namespace and use it implicitly', () => {
        seedConfigCommandKubeconfig()
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)

        const setContextResult = executor.execute(
          'kubectl config set-context --current --namespace=kube-system'
        )
        expect(setContextResult.ok).toBe(true)
        if (!setContextResult.ok) {
          return
        }
        expect(setContextResult.value).toContain(
          'Context "kind-conformance" modified.'
        )
        const kubeconfigReadResult = fileSystem.readFile(
          '/home/kube/.kube/config'
        )
        expect(kubeconfigReadResult.ok).toBe(true)
        if (kubeconfigReadResult.ok) {
          expect(kubeconfigReadResult.value).toContain('namespace: kube-system')
        }

        const getPodsResult = executor.execute('kubectl get pods')
        expect(getPodsResult.ok).toBe(true)
        if (!getPodsResult.ok) {
          return
        }
        expect(getPodsResult.value).toContain('redis-pod')
        expect(getPodsResult.value).not.toContain('nginx-pod')
      })

      it('should handle kubectl cluster-info dump command', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl cluster-info dump --all-namespaces'
        )

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('"kind": "NodeList"')
        }
      })

      it('should handle kubectl api-versions command', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl api-versions')

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('apps/v1')
          expect(result.value).toContain('rbac.authorization.k8s.io/v1')
          expect(result.value).toContain('v1')
        }
      })

      it('should handle kubectl explain pod.spec.containers command', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
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
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute('kubectl explain pod.spec.unknownField')

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('field "unknownField" does not exist')
        }
      })

      it('should create pod with command for kubectl run', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run test-pod --image=busybox --command -- sleep 3600'
        )

        expect(result.ok).toBe(true)

        const podResult = apiServer.findResource('Pod', 'test-pod', 'default')
        expect(podResult.ok).toBe(true)
        if (!podResult.ok) {
          return
        }

        expect(podResult.value.spec.containers[0].image).toBe('busybox')
        expect(podResult.value.spec.containers[0].command).toEqual([
          'sleep',
          '3600'
        ])
      })

      it('should create pod in provided namespace for kubectl run', () => {
        apiServer.createResource(
          'Namespace',
          createNamespace({ name: 'tools' })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run test-pod-ns --image=busybox --command -n tools -- sleep 3600'
        )

        expect(result.ok).toBe(true)

        const podResult = apiServer.findResource('Pod', 'test-pod-ns', 'tools')
        expect(podResult.ok).toBe(true)
      })

      it('should create pod with args when --command is not set', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run test-pod-args --image=busybox -- sleep 3600'
        )

        expect(result.ok).toBe(true)
        const podResult = apiServer.findResource(
          'Pod',
          'test-pod-args',
          'default'
        )
        expect(podResult.ok).toBe(true)
        if (!podResult.ok) {
          return
        }

        expect(podResult.value.spec.containers[0].args).toEqual([
          'sleep',
          '3600'
        ])
      })

      it('should create pod with positional args when separator is omitted', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run test-typo --image=nginx pod'
        )

        expect(result.ok).toBe(true)
        const podResult = apiServer.findResource('Pod', 'test-typo', 'default')
        expect(podResult.ok).toBe(true)
        if (!podResult.ok) {
          return
        }

        expect(podResult.value.spec.containers[0].args).toEqual(['pod'])
      })

      it('should create pod with labels env and port for kubectl run', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run hazelcast --image=hazelcast/hazelcast --port=5701 --env=DNS_DOMAIN=cluster --env=POD_NAMESPACE=default --labels=app=hazelcast,env=prod'
        )

        expect(result.ok).toBe(true)
        const podResult = apiServer.findResource('Pod', 'hazelcast', 'default')
        expect(podResult.ok).toBe(true)
        if (!podResult.ok) {
          return
        }

        expect(podResult.value.metadata.labels).toEqual({
          run: 'hazelcast',
          app: 'hazelcast',
          env: 'prod'
        })
        expect(
          podResult.value.spec.containers[0].ports?.[0]?.containerPort
        ).toBe(5701)
        expect(podResult.value.spec.containers[0].env).toEqual([
          {
            name: 'DNS_DOMAIN',
            source: { type: 'value', value: 'cluster' }
          },
          {
            name: 'POD_NAMESPACE',
            source: { type: 'value', value: 'default' }
          }
        ])
      })

      it('should include run env in kubectl get pod -o yaml output', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const runResult = executor.execute(
          'kubectl run edit-demo --image=nginx:1.28 --env=LOG_LEVEL=info'
        )
        expect(runResult.ok).toBe(true)

        const getResult = executor.execute('kubectl get pod edit-demo -o yaml')
        expect(getResult.ok).toBe(true)
        if (!getResult.ok) {
          return
        }

        expect(getResult.value).toContain('name: LOG_LEVEL')
        expect(getResult.value).toContain('value: info')
      })

      it('should render configmap yaml with metadata after data', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const createResult = executor.execute(
          'kubectl create configmap demo-cm --from-literal=key=value'
        )
        expect(createResult.ok).toBe(true)

        const getResult = executor.execute(
          'kubectl get configmap demo-cm -o yaml'
        )
        expect(getResult.ok).toBe(true)
        if (!getResult.ok) {
          return
        }

        const output = getResult.value
        const apiVersionIndex = output.indexOf('apiVersion: v1')
        const dataIndex = output.indexOf('\ndata:\n')
        const kindIndex = output.indexOf('\nkind: ConfigMap\n')
        const metadataIndex = output.indexOf('\nmetadata:\n')
        const creationTimestampIndex = output.indexOf('creationTimestamp:')
        const nameIndex = output.indexOf('name: demo-cm')
        const namespaceIndex = output.indexOf('namespace: default')

        expect(apiVersionIndex).toBeGreaterThanOrEqual(0)
        expect(dataIndex).toBeGreaterThan(apiVersionIndex)
        expect(kindIndex).toBeGreaterThan(dataIndex)
        expect(metadataIndex).toBeGreaterThan(kindIndex)
        expect(creationTimestampIndex).toBeGreaterThan(metadataIndex)
        expect(nameIndex).toBeGreaterThan(creationTimestampIndex)
        expect(namespaceIndex).toBeGreaterThan(nameIndex)
      })

      it('should parse quoted --env value for kubectl run', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const runResult = executor.execute(
          'kubectl run edit-demo-quoted --image=nginx:1.28 --env="LOG_LEVEL=info"'
        )
        expect(runResult.ok).toBe(true)
        if (!runResult.ok) {
          return
        }

        const podResult = apiServer.findResource(
          'Pod',
          'edit-demo-quoted',
          'default'
        )
        expect(podResult.ok).toBe(true)
        if (!podResult.ok) {
          return
        }

        expect(podResult.value.spec.containers[0].env).toEqual([
          {
            name: 'LOG_LEVEL',
            source: { type: 'value', value: 'info' }
          }
        ])
      })

      it('should return dry-run message without creating pod', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run dry-run-pod --image=busybox --dry-run=client'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        expect(result.value).toContain('pod/dry-run-pod created (dry run)')

        const podResult = apiServer.findResource(
          'Pod',
          'dry-run-pod',
          'default'
        )
        expect(podResult.ok).toBe(false)
      })

      it('should succeed kubectl wait when pod is already Ready', () => {
        apiServer.createResource(
          'Pod',
          createPod({
            name: 'web',
            namespace: 'default',
            containers: [{ name: 'web', image: 'busybox' }],
            phase: 'Running'
          })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl wait --for=condition=Ready pod/web --timeout=60s'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        expect(result.value).toContain('condition met')
      })

      it('should reject kubectl run with invalid pod name', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run My_App --image=busybox --dry-run=client -o yaml'
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain(
            'metadata.name: Invalid value: "My_App"'
          )
        }
      })

      it('should return yaml manifest for kubectl run dry-run client output yaml', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run mypod --image=nginx --dry-run=client -o yaml'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('apiVersion: v1')
        expect(result.value).toContain('kind: Pod')
        expect(result.value).toContain('name: mypod')
        expect(result.value).toContain('image: nginx')
        expect(result.value).toContain('restartPolicy: Always')

        const podResult = apiServer.findResource('Pod', 'mypod', 'default')
        expect(podResult.ok).toBe(false)
      })

      it('should return jsonpath value for kubectl run dry-run client', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          "kubectl run mypod --image=nginx --dry-run=client -o jsonpath='{.metadata.name}'"
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toBe('mypod')
        const podResult = apiServer.findResource('Pod', 'mypod', 'default')
        expect(podResult.ok).toBe(false)
      })

      it('should fail kubectl run when env format is invalid', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run bad-env --image=busybox --env INVALID'
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('error: invalid env: INVALID')
        }
      })

      it('should support kubectl run with -i -t --restart=Never --rm', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run -i -t busybox --image=busybox --restart=Never --rm'
        )

        expect(result.ok).toBe(true)
        const podResult = apiServer.findResource('Pod', 'busybox', 'default')
        expect(podResult.ok).toBe(true)
        if (!podResult.ok) {
          return
        }
        expect(podResult.value.spec.restartPolicy).toBe('Never')
      })

      it('should execute nslookup in kubectl run --rm -it flow', () => {
        const networkRuntime = initializeSimNetworkRuntime(apiServer)
        const executor = createKubectlExecutor(
          apiServer,
          fileSystem,
          logger,
          networkRuntime
        )
        executor.execute(
          'kubectl create deployment web --image=nginx --port=8080'
        )
        executor.execute('kubectl expose deployment web --port=80')

        const result = executor.execute(
          'kubectl run dns-test --image=busybox -it --restart=Never --rm --command -- nslookup web.default.svc.cluster.local'
        )
        expect(result.ok).toBe(true)
        if (!result.ok) {
          networkRuntime.controller.stop()
          return
        }
        expect(result.value).toContain('Name:\tweb.default.svc.cluster.local')
        expect(result.value).toContain(
          'pod "dns-test" deleted from default namespace'
        )
        const podResult = apiServer.findResource('Pod', 'dns-test', 'default')
        expect(podResult.ok).toBe(false)
        networkRuntime.controller.stop()
      })

      it('should execute nslookup in kubectl run --rm -it flow without --command', () => {
        const networkRuntime = initializeSimNetworkRuntime(apiServer)
        const executor = createKubectlExecutor(
          apiServer,
          fileSystem,
          logger,
          networkRuntime
        )
        executor.execute(
          'kubectl create deployment web --image=nginx --port=8080'
        )
        executor.execute('kubectl expose deployment web --port=80')

        const result = executor.execute(
          'kubectl run dns-test-args --image=busybox -it --restart=Never --rm -- nslookup web.default.svc.cluster.local'
        )
        expect(result.ok).toBe(true)
        if (!result.ok) {
          networkRuntime.controller.stop()
          return
        }
        expect(result.value).toContain('Name:\tweb.default.svc.cluster.local')
        expect(result.value).toContain(
          'pod "dns-test-args" deleted from default namespace'
        )
        const podResult = apiServer.findResource(
          'Pod',
          'dns-test-args',
          'default'
        )
        expect(podResult.ok).toBe(false)
        networkRuntime.controller.stop()
      })

      it('should reject kubectl run --rm without attached mode', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run dns-test-no-attach --image=busybox --restart=Never --rm -- nslookup web.default.svc.cluster.local'
        )

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toBe(
            'error: --rm should only be used for attached containers'
          )
        }
      })

      it('should allow kubectl run when restart is Always', () => {
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)
        const result = executor.execute(
          'kubectl run nginx --image=nginx --restart=Always'
        )

        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }
        const podResult = apiServer.findResource('Pod', 'nginx', 'default')
        expect(podResult.ok).toBe(true)
      })

      it('should display restart age in get pods output', () => {
        const lastRestartAt = new Date(Date.now() - 75_000).toISOString()
        apiServer.createResource(
          'Pod',
          createPod({
            name: 'crashy',
            namespace: 'default',
            phase: 'Pending',
            nodeName: 'sim-worker',
            containers: [{ name: 'nginx', image: 'nginx:latest' }],
            containerStatusOverrides: [
              {
                name: 'nginx',
                ready: false,
                restartCount: 5,
                stateDetails: { state: 'Waiting', reason: 'CrashLoopBackOff' },
                lastRestartAt
              }
            ]
          })
        )
        const executor = createKubectlExecutor(apiServer, fileSystem, logger)

        const result = executor.execute('kubectl get pods')
        expect(result.ok).toBe(true)
        if (!result.ok) {
          return
        }

        expect(result.value).toContain('CrashLoopBackOff')
        expect(result.value).toMatch(/\b5 \(\d+m\d+s ago\)/)
      })
    })
  })
})
