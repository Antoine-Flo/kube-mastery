import { beforeEach, describe, expect, it } from 'vitest'
import { createClusterState } from '../../../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../../../src/core/cluster/events/EventBus'
import { createHostFileSystem } from '../../../../../src/core/filesystem/debianFileSystem'
import {
  createFileSystem,
  type FileSystem
} from '../../../../../src/core/filesystem/FileSystem'
import { parseCommand } from '../../../../../src/core/kubectl/commands/parser'
import { handleCreate } from '../../../../../src/core/kubectl/commands/handlers/applyCreate'

describe('applyCreate handler', () => {
  let fileSystem: FileSystem
  let eventBus: ReturnType<typeof createEventBus>
  let clusterState: ReturnType<typeof createClusterState>

  beforeEach(() => {
    eventBus = createEventBus()
    clusterState = createClusterState(eventBus)
    fileSystem = createFileSystem(createHostFileSystem())
  })

  it('should create deployment imperatively with --image', () => {
    const parsed = parseCommand(
      'kubectl create deployment my-dep --image=busybox'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('deployment.apps/my-dep created')
    const deployment = clusterState.findDeployment('my-dep', 'default')
    expect(deployment.ok).toBe(true)
    if (!deployment.ok) {
      return
    }
    expect(deployment.value.metadata.labels).toEqual({ app: 'my-dep' })
  })

  it('should return explicit error when image is missing', () => {
    const parsed = parseCommand('kubectl create deployment my-dep')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('required flag(s) "image" not set')
    }
  })

  it('should return explicit error when image is missing in dry-run client mode', () => {
    const parsed = parseCommand(
      'kubectl create deployment my-dep --dry-run=client -o json'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('required flag(s) "image" not set')
    }
  })

  it('should return error when multiple images are used with command', () => {
    const parsed = parseCommand(
      'kubectl create deployment my-dep --image=busybox --image=nginx -- date'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'cannot specify multiple --image options and command'
      )
    }
  })

  it('should return explicit error when deployment name is missing', () => {
    const parsed = parseCommand('kubectl create deployment --image=busybox')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('requires a name')
    }
  })

  it('should create deployment in provided namespace', () => {
    const createNamespaceParsed = parseCommand(
      'kubectl create namespace staging'
    )
    expect(createNamespaceParsed.ok).toBe(true)
    if (!createNamespaceParsed.ok) {
      return
    }
    const createNamespaceResult = handleCreate(
      fileSystem,
      clusterState,
      createNamespaceParsed.value,
      eventBus
    )
    expect(createNamespaceResult.ok).toBe(true)

    const parsed = parseCommand(
      'kubectl create deployment my-dep --image=busybox -n staging'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(true)
    const deployment = clusterState.findDeployment('my-dep', 'staging')
    expect(deployment.ok).toBe(true)
  })

  it('should reject deployment with invalid metadata.name for dry-run client', () => {
    const parsed = parseCommand(
      'kubectl create deployment My_App --image=nginx --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('metadata.name: Invalid value: "My_App"')
      expect(result.error).toContain('regex used for validation')
    }
  })

  it('should reject service with invalid metadata.name in dry-run client', () => {
    const parsed = parseCommand(
      'kubectl create service clusterip My_App --tcp=80:80 --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('metadata.name: Invalid value: "My_App"')
    }
  })

  it('should reject namespace with invalid metadata.name in dry-run client', () => {
    const parsed = parseCommand(
      'kubectl create namespace My_App --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('metadata.name: Invalid value: "My_App"')
    }
  })

  it('should reject deployment with invalid metadata.name in dry-run server', () => {
    const parsed = parseCommand(
      'kubectl create deployment My_App --image=nginx --dry-run=server'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('metadata.name: Invalid value: "My_App"')
    }
  })

  it('should fail when deployment namespace does not exist', () => {
    const parsed = parseCommand(
      'kubectl create deployment my-dep --image=busybox -n staging'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Error from server (NotFound)')
      expect(result.error).toContain('namespaces "staging" not found')
    }
  })

  it('should keep create from file flow', () => {
    const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
data:
  key: value
`

    fileSystem.createFile('config.yaml')
    fileSystem.writeFile('config.yaml', yaml)

    const parsed = parseCommand('kubectl create -f config.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('created')
  })

  it('should create namespace imperatively with name', () => {
    const parsed = parseCommand('kubectl create namespace my-team')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('namespace/my-team created')
  })

  it('should create ingress from file', () => {
    const yaml = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-ingress
  namespace: default
spec:
  rules:
    - host: demo.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
`

    fileSystem.createFile('ingress.yaml')
    fileSystem.writeFile('ingress.yaml', yaml)
    const parsed = parseCommand('kubectl create -f ingress.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain(
      'ingress.networking.k8s.io/demo-ingress created'
    )
    const ingress = clusterState.findIngress('demo-ingress', 'default')
    expect(ingress.ok).toBe(true)
  })

  it('should return AlreadyExists error when namespace already exists', () => {
    const first = parseCommand('kubectl create namespace my-team')
    expect(first.ok).toBe(true)
    if (!first.ok) {
      return
    }

    const firstResult = handleCreate(
      fileSystem,
      clusterState,
      first.value,
      eventBus
    )
    expect(firstResult.ok).toBe(true)

    const second = parseCommand('kubectl create namespace my-team')
    expect(second.ok).toBe(true)
    if (!second.ok) {
      return
    }

    const secondResult = handleCreate(
      fileSystem,
      clusterState,
      second.value,
      eventBus
    )
    expect(secondResult.ok).toBe(false)
    if (!secondResult.ok) {
      expect(secondResult.error).toContain('Error from server (AlreadyExists)')
      expect(secondResult.error).toContain(
        'namespaces "my-team" already exists'
      )
    }
  })

  it('should create service clusterip imperatively', () => {
    const parsed = parseCommand(
      'kubectl create service clusterip my-svc --tcp=80:8080'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('service/my-svc created')
    const service = clusterState.findService('my-svc', 'default')
    expect(service.ok).toBe(true)
    if (!service.ok) {
      return
    }
    expect(service.value.spec.type).toBe('ClusterIP')
    expect(service.value.spec.selector).toEqual({ app: 'my-svc' })
    expect(service.value.spec.ports[0].port).toBe(80)
    expect(service.value.spec.ports[0].targetPort).toBe(8080)
  })

  it('should return yaml for create service nodeport dry-run client', () => {
    const parsed = parseCommand(
      'kubectl create service nodeport my-svc --tcp=80:8080 --node-port=30080 --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('kind: Service')
    expect(result.value).toContain('type: NodePort')
    expect(result.value).toContain('labels:')
    expect(result.value).toContain('app: my-svc')
    expect(result.value).toContain('name: 80-8080')
    expect(result.value).toContain('loadBalancer: {}')
    const createdService = clusterState.findService('my-svc', 'default')
    expect(createdService.ok).toBe(false)
  })

  it('should create service externalname imperatively', () => {
    const parsed = parseCommand(
      'kubectl create service externalname ext-svc --external-name=example.com'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const service = clusterState.findService('ext-svc', 'default')
    expect(service.ok).toBe(true)
    if (!service.ok) {
      return
    }
    expect(service.value.spec.type).toBe('ExternalName')
    expect(service.value.spec.externalName).toBe('example.com')
    expect(service.value.spec.ports).toEqual([])
  })

  it('should return configmap yaml for dry-run client from-literal', () => {
    const parsed = parseCommand(
      'kubectl create configmap app-config --from-literal=LOG_LEVEL=info --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('kind: ConfigMap')
    expect(result.value).toContain('name: app-config')
    expect(result.value).toContain('creationTimestamp: null')
    expect(result.value).toContain('LOG_LEVEL: info')

    const configMap = clusterState.findConfigMap('app-config', 'default')
    expect(configMap.ok).toBe(false)
  })

  it('should return jsonpath value for create configmap dry-run client', () => {
    const parsed = parseCommand(
      "kubectl create configmap app-config --from-literal=LOG_LEVEL=info --dry-run=client -o jsonpath='{.metadata.name}'"
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toBe('app-config')
    const configMap = clusterState.findConfigMap('app-config', 'default')
    expect(configMap.ok).toBe(false)
  })

  it('should return secret generic yaml for dry-run client', () => {
    const parsed = parseCommand(
      'kubectl create secret generic mysecret --from-literal=password=s3cr3t --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('kind: Secret')
    expect(result.value).toContain('name: mysecret')
    expect(result.value).not.toContain('type: Opaque')
    expect(result.value).toContain('password: czNjcjN0')

    const secret = clusterState.findSecret('mysecret', 'default')
    expect(secret.ok).toBe(false)
  })

  it('should create secret tls imperatively from cert and key files', () => {
    fileSystem.createFile('tls.crt')
    fileSystem.writeFile('tls.crt', 'CERTDATA')
    fileSystem.createFile('tls.key')
    fileSystem.writeFile('tls.key', 'KEYDATA')

    const parsed = parseCommand(
      'kubectl create secret tls tls-secret --cert=tls.crt --key=tls.key'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const secret = clusterState.findSecret('tls-secret', 'default')
    expect(secret.ok).toBe(true)
    if (!secret.ok) {
      return
    }
    expect(secret.value.type.type).toBe('kubernetes.io/tls')
    expect(secret.value.data['tls.crt']).toBe('Q0VSVERBVEE=')
    expect(secret.value.data['tls.key']).toBe('S0VZREFUQQ==')
  })

  it('should return docker-registry secret yaml for dry-run client', () => {
    const parsed = parseCommand(
      'kubectl create secret docker-registry regcred --docker-server=docker.io --docker-username=alice --docker-password=s3cr3t --docker-email=alice@example.com --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('kind: Secret')
    expect(result.value).toContain('name: regcred')
    expect(result.value).toContain('type: kubernetes.io/dockerconfigjson')
    expect(result.value).toContain('.dockerconfigjson:')
  })

  it('should create secret generic from file and env file', () => {
    fileSystem.createFile('username.txt')
    fileSystem.writeFile('username.txt', 'admin')
    fileSystem.createFile('app.env')
    fileSystem.writeFile('app.env', 'LOG_LEVEL=debug\nFEATURE_X=true\n')

    const parsed = parseCommand(
      'kubectl create secret generic app-secret --from-file=username=username.txt --from-env-file=app.env'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const secret = clusterState.findSecret('app-secret', 'default')
    expect(secret.ok).toBe(true)
    if (!secret.ok) {
      return
    }
    expect(secret.value.data.username).toBe('YWRtaW4=')
    expect(secret.value.data.LOG_LEVEL).toBe('ZGVidWc=')
    expect(secret.value.data.FEATURE_X).toBe('dHJ1ZQ==')
  })
})
