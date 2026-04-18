import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createHostFileSystem } from '../../../../../src/core/filesystem/debianFileSystem'
import {
  createFileSystem,
  type FileSystem
} from '../../../../../src/core/filesystem/FileSystem'
import { parseCommand } from '../../../../../src/core/kubectl/commands/parser'
import { handleApply } from '../../../../../src/core/kubectl/commands/handlers/apply'
import { handleCreate } from '../../../../../src/core/kubectl/commands/handlers/create'
import { handleRun } from '../../../../../src/core/kubectl/commands/handlers/run'

describe('applyCreate handler', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>
  let fileSystem: FileSystem

  beforeEach(() => {
    apiServer = createApiServerFacade()
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('deployment.apps/my-dep created')
    const deployment = apiServer.findResource('Deployment', 'my-dep', 'default')
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)

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

    const result = handleCreate(fileSystem, apiServer, parsed.value)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('required flag(s) "image" not set')
    }
  })

  it('should not mutate cluster state on apply --dry-run=client', () => {
    const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: dry-run-only
data:
  key: value
`
    fileSystem.createFile('dry-run-only.yaml')
    fileSystem.writeFile('dry-run-only.yaml', yaml)

    const parsed = parseCommand('kubectl apply -f dry-run-only.yaml --dry-run=client')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleApply(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)

    const configMap = apiServer.findResource('ConfigMap', 'dry-run-only', 'default')
    expect(configMap.ok).toBe(false)
  })

  it('should return error when multiple images are used with command', () => {
    const parsed = parseCommand(
      'kubectl create deployment my-dep --image=busybox --image=nginx -- date'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)

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

    const result = handleCreate(fileSystem, apiServer, parsed.value)

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
      apiServer,
      createNamespaceParsed.value
    )
    expect(createNamespaceResult.ok).toBe(true)

    const parsed = parseCommand(
      'kubectl create deployment my-dep --image=busybox -n staging'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)

    expect(result.ok).toBe(true)
    const deployment = apiServer.findResource('Deployment', 'my-dep', 'staging')
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('metadata.name: Invalid value: "My_App"')
      expect(result.error).toContain('regex used for validation')
    }
  })

  it('should generate deployment dry-run yaml without null creationTimestamp and apply it', () => {
    const parsedCreate = parseCommand(
      'kubectl create deployment demo-app --image=nginx --replicas=2 --dry-run=client -o yaml'
    )
    expect(parsedCreate.ok).toBe(true)
    if (!parsedCreate.ok) {
      return
    }

    const dryRunResult = handleCreate(fileSystem, apiServer, parsedCreate.value)
    expect(dryRunResult.ok).toBe(true)
    if (!dryRunResult.ok) {
      return
    }

    expect(dryRunResult.value).not.toContain('creationTimestamp: null')

    fileSystem.createFile('demo-app.yaml')
    fileSystem.writeFile('demo-app.yaml', dryRunResult.value)

    const parsedApply = parseCommand('kubectl apply -f demo-app.yaml')
    expect(parsedApply.ok).toBe(true)
    if (!parsedApply.ok) {
      return
    }

    const applyResult = handleApply(fileSystem, apiServer, parsedApply.value)
    expect(applyResult.ok).toBe(true)
    if (!applyResult.ok) {
      return
    }

    const deployment = apiServer.findResource(
      'Deployment',
      'demo-app',
      'default'
    )
    expect(deployment.ok).toBe(true)
  })

  it('should reject service with invalid metadata.name in dry-run client', () => {
    const parsed = parseCommand(
      'kubectl create service clusterip My_App --tcp=80:80 --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)

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

    const result = handleCreate(fileSystem, apiServer, parsed.value)

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

    const result = handleCreate(fileSystem, apiServer, parsed.value)

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

    const result = handleCreate(fileSystem, apiServer, parsed.value)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Error from server (NotFound)')
      expect(result.error).toContain('namespaces "staging" not found')
    }
  })

  it('should reject ReplicaSet apply when selector does not match template labels', () => {
    const yaml = `apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: broken-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: different-app
    spec:
      containers:
      - name: web
        image: nginx:1.28
`
    fileSystem.createFile('broken-rs.yaml')
    fileSystem.writeFile('broken-rs.yaml', yaml)

    const parsed = parseCommand('kubectl apply -f broken-rs.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleApply(fileSystem, apiServer, parsed.value)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('The ReplicaSet "broken-rs" is invalid')
      expect(result.error).toContain(
        'spec.template.metadata.labels: Invalid value: {"app":"different-app"}'
      )
      expect(result.error).toContain(
        '`selector` does not match template `labels`'
      )
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('created')
  })

  it('should create event from yaml and make it queryable', () => {
    const yaml = `apiVersion: v1
kind: Event
metadata:
  name: pod-started.12345
  namespace: default
involvedObject:
  apiVersion: v1
  kind: Pod
  name: nginx-pod
  namespace: default
reason: Started
message: Started container nginx
type: Normal
count: 1
firstTimestamp: "2026-04-06T09:00:00.000Z"
lastTimestamp: "2026-04-06T09:00:00.000Z"
`

    fileSystem.createFile('event.yaml')
    fileSystem.writeFile('event.yaml', yaml)

    const parsed = parseCommand('kubectl apply -f event.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleApply(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('event/pod-started.12345 created')

    const createdEvent = apiServer.findResource(
      'Event',
      'pod-started.12345',
      'default'
    )
    expect(createdEvent.ok).toBe(true)
    if (!createdEvent.ok) {
      return
    }
    expect(createdEvent.value.reason).toBe('Started')
    expect(createdEvent.value.message).toBe('Started container nginx')
  })

  it('should return unchanged when applying same deployment manifest twice', () => {
    const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-unchanged
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo-unchanged
  template:
    metadata:
      labels:
        app: demo-unchanged
    spec:
      containers:
      - name: nginx
        image: nginx
`

    fileSystem.createFile('demo-unchanged.yaml')
    fileSystem.writeFile('demo-unchanged.yaml', yaml)

    const parsedFirstApply = parseCommand(
      'kubectl apply -f demo-unchanged.yaml'
    )
    expect(parsedFirstApply.ok).toBe(true)
    if (!parsedFirstApply.ok) {
      return
    }

    const firstApplyResult = handleApply(
      fileSystem,
      apiServer,
      parsedFirstApply.value
    )
    expect(firstApplyResult.ok).toBe(true)
    if (!firstApplyResult.ok) {
      return
    }
    expect(firstApplyResult.value).toContain(
      'deployment.apps/demo-unchanged created'
    )
    const createdDeployment = apiServer.findResource(
      'Deployment',
      'demo-unchanged',
      'default'
    )
    expect(createdDeployment.ok).toBe(true)
    if (!createdDeployment.ok) {
      return
    }
    expect(
      createdDeployment.value.metadata.annotations?.[
        'kubectl.kubernetes.io/last-applied-configuration'
      ]
    ).toBeUndefined()

    const parsedSecondApply = parseCommand(
      'kubectl apply -f demo-unchanged.yaml'
    )
    expect(parsedSecondApply.ok).toBe(true)
    if (!parsedSecondApply.ok) {
      return
    }

    const secondApplyResult = handleApply(
      fileSystem,
      apiServer,
      parsedSecondApply.value
    )
    expect(secondApplyResult.ok).toBe(true)
    if (!secondApplyResult.ok) {
      return
    }
    expect(secondApplyResult.value).toContain(
      'deployment.apps/demo-unchanged unchanged'
    )
  })

  it('should apply pod annotations from manifest and persist them on resource metadata', () => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: annotated-pod
  annotations:
    contact: platform-team@example.com
    runbook: https://wiki.example.com/runbooks/web
spec:
  containers:
    - name: nginx
      image: nginx:1.28
`
    fileSystem.createFile('annotated-pod.yaml')
    fileSystem.writeFile('annotated-pod.yaml', yaml)

    const parsed = parseCommand('kubectl apply -f annotated-pod.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const applyResult = handleApply(fileSystem, apiServer, parsed.value)
    expect(applyResult.ok).toBe(true)
    if (!applyResult.ok) {
      return
    }
    expect(applyResult.value).toContain('pod/annotated-pod created')

    const pod = apiServer.findResource('Pod', 'annotated-pod', 'default')
    expect(pod.ok).toBe(true)
    if (!pod.ok) {
      return
    }

    expect(pod.value.metadata.annotations?.contact).toBe(
      'platform-team@example.com'
    )
    expect(pod.value.metadata.annotations?.runbook).toBe(
      'https://wiki.example.com/runbooks/web'
    )
    expect(
      pod.value.metadata.annotations?.[
        'kubectl.kubernetes.io/last-applied-configuration'
      ]
    ).toBeUndefined()
  })

  it('should apply sorted manifests from a directory with one line per file', () => {
    const dirResult = fileSystem.createDirectory('manifests-apply-dir')
    expect(dirResult.ok).toBe(true)

    const deploymentTemplate = (name: string) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: nginx
        image: nginx
`

    fileSystem.createFile('manifests-apply-dir/z-dep.yaml')
    fileSystem.writeFile(
      'manifests-apply-dir/z-dep.yaml',
      deploymentTemplate('zulu-dep')
    )
    fileSystem.createFile('manifests-apply-dir/a-dep.yaml')
    fileSystem.writeFile(
      'manifests-apply-dir/a-dep.yaml',
      deploymentTemplate('alpha-dep')
    )

    const parsedFirst = parseCommand('kubectl apply -f manifests-apply-dir')
    expect(parsedFirst.ok).toBe(true)
    if (!parsedFirst.ok) {
      return
    }

    const first = handleApply(fileSystem, apiServer, parsedFirst.value)
    expect(first.ok).toBe(true)
    if (!first.ok) {
      return
    }
    expect(first.value.split('\n')).toEqual([
      'deployment.apps/alpha-dep created',
      'deployment.apps/zulu-dep created'
    ])

    const parsedSecond = parseCommand('kubectl apply -f manifests-apply-dir')
    expect(parsedSecond.ok).toBe(true)
    if (!parsedSecond.ok) {
      return
    }
    const second = handleApply(fileSystem, apiServer, parsedSecond.value)
    expect(second.ok).toBe(true)
    if (!second.ok) {
      return
    }
    expect(second.value.split('\n')).toEqual([
      'deployment.apps/alpha-dep unchanged',
      'deployment.apps/zulu-dep unchanged'
    ])
  })

  it('should error when apply directory has no manifest files', () => {
    const dirResult = fileSystem.createDirectory('empty-apply-dir')
    expect(dirResult.ok).toBe(true)

    const parsed = parseCommand('kubectl apply -f empty-apply-dir')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleApply(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('error: no objects passed to apply')
    }
  })

  it('should error when apply directory has only non-manifest files', () => {
    const dirResult = fileSystem.createDirectory('txt-only-apply-dir')
    expect(dirResult.ok).toBe(true)
    fileSystem.createFile('txt-only-apply-dir/readme.txt')
    fileSystem.writeFile('txt-only-apply-dir/readme.txt', 'hello')

    const parsed = parseCommand('kubectl apply -f txt-only-apply-dir')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleApply(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('error: no objects passed to apply')
    }
  })

  it('should return kubectl-like path error when apply file is missing', () => {
    const parsed = parseCommand('kubectl apply -f servr.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleApply(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('error: the path "servr.yaml" does not exist')
      expect(result.error).not.toContain('ls:')
      expect(result.error).not.toContain('cat:')
    }
  })

  it('should return kubectl-like path error when create file is missing', () => {
    const parsed = parseCommand('kubectl create -f servr.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('error: the path "servr.yaml" does not exist')
      expect(result.error).not.toContain('cat:')
    }
  })

  it('should return configured when applying changed deployment manifest', () => {
    const initialYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-configured
spec:
  replicas: 1
  selector:
    matchLabels:
      app: demo-configured
  template:
    metadata:
      labels:
        app: demo-configured
    spec:
      containers:
      - name: nginx
        image: nginx
`
    const updatedYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-configured
spec:
  replicas: 3
  selector:
    matchLabels:
      app: demo-configured
  template:
    metadata:
      labels:
        app: demo-configured
    spec:
      containers:
      - name: nginx
        image: nginx
`

    fileSystem.createFile('demo-configured.yaml')
    fileSystem.writeFile('demo-configured.yaml', initialYaml)

    const parsedFirstApply = parseCommand(
      'kubectl apply -f demo-configured.yaml'
    )
    expect(parsedFirstApply.ok).toBe(true)
    if (!parsedFirstApply.ok) {
      return
    }

    const firstApplyResult = handleApply(
      fileSystem,
      apiServer,
      parsedFirstApply.value
    )
    expect(firstApplyResult.ok).toBe(true)
    if (!firstApplyResult.ok) {
      return
    }
    expect(firstApplyResult.value).toContain(
      'deployment.apps/demo-configured created'
    )

    fileSystem.writeFile('demo-configured.yaml', updatedYaml)

    const parsedSecondApply = parseCommand(
      'kubectl apply -f demo-configured.yaml'
    )
    expect(parsedSecondApply.ok).toBe(true)
    if (!parsedSecondApply.ok) {
      return
    }

    const secondApplyResult = handleApply(
      fileSystem,
      apiServer,
      parsedSecondApply.value
    )
    expect(secondApplyResult.ok).toBe(true)
    if (!secondApplyResult.ok) {
      return
    }
    expect(secondApplyResult.value).toContain(
      'deployment.apps/demo-configured configured'
    )
  })

  it('should apply all resources from a multi document yaml file', () => {
    const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: nginx:1.28
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
spec:
  selector:
    app: backend
  ports:
    - port: 80
      targetPort: 80
`

    fileSystem.createFile('backend.yaml')
    fileSystem.writeFile('backend.yaml', yaml)

    const parsed = parseCommand('kubectl apply -f backend.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const applyResult = handleApply(fileSystem, apiServer, parsed.value)
    expect(applyResult.ok).toBe(true)
    if (!applyResult.ok) {
      return
    }

    expect(applyResult.value.split('\n')).toEqual([
      'deployment.apps/backend created',
      'service/backend-service created'
    ])

    const deployment = apiServer.findResource(
      'Deployment',
      'backend',
      'default'
    )
    expect(deployment.ok).toBe(true)
    const service = apiServer.findResource(
      'Service',
      'backend-service',
      'default'
    )
    expect(service.ok).toBe(true)
  })

  it('should create namespace imperatively with name', () => {
    const parsed = parseCommand('kubectl create namespace my-team')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)

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

    const result = handleCreate(fileSystem, apiServer, parsed.value)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain(
      'ingress.networking.k8s.io/demo-ingress created'
    )
    const ingress = apiServer.findResource('Ingress', 'demo-ingress', 'default')
    expect(ingress.ok).toBe(true)
  })

  it('should create ingress imperatively from --rule flags', () => {
    const parsed = parseCommand(
      'kubectl create ingress demo-ingress --class=nginx --rule=demo.example.com/api=api-service:5678 --rule=demo.example.com/=frontend-service:80'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain(
      'ingress.networking.k8s.io/demo-ingress created'
    )
    const ingress = apiServer.findResource('Ingress', 'demo-ingress', 'default')
    expect(ingress.ok).toBe(true)
    if (!ingress.ok) {
      return
    }
    expect(ingress.value.spec.ingressClassName).toBe('nginx')
    const ingressRules = ingress.value.spec.rules
    expect(ingressRules).toBeDefined()
    if (ingressRules == null) {
      return
    }
    expect(ingressRules).toHaveLength(1)
    expect(ingressRules[0].host).toBe('demo.example.com')
    expect(ingressRules[0].http?.paths).toHaveLength(2)
  })

  it('should return error for invalid ingress --rule backend format', () => {
    const parsed = parseCommand(
      'kubectl create ingress demo-ingress --rule=demo.example.com/api=api-service'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('invalid ingress backend')
    }
  })

  it('should return ingress manifest in dry-run client mode', () => {
    const parsed = parseCommand(
      'kubectl create ingress demo-ingress --class=nginx --rule=demo.example.com/=frontend-service:80 --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('kind: Ingress')
    expect(result.value).toContain('name: demo-ingress')
    expect(result.value).toContain('ingressClassName: nginx')

    const ingress = apiServer.findResource('Ingress', 'demo-ingress', 'default')
    expect(ingress.ok).toBe(false)
  })

  it('should return AlreadyExists error when namespace already exists', () => {
    const first = parseCommand('kubectl create namespace my-team')
    expect(first.ok).toBe(true)
    if (!first.ok) {
      return
    }

    const firstResult = handleCreate(fileSystem, apiServer, first.value)
    expect(firstResult.ok).toBe(true)

    const second = parseCommand('kubectl create namespace my-team')
    expect(second.ok).toBe(true)
    if (!second.ok) {
      return
    }

    const secondResult = handleCreate(fileSystem, apiServer, second.value)
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)
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

  it('should not create role on create role --dry-run=client', () => {
    const parsed = parseCommand(
      'kubectl create role pod-reader --verb=get,list --resource=pods --dry-run=client'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)

    const role = apiServer.findResource('Role', 'pod-reader', 'default')
    expect(role.ok).toBe(false)
  })

  it('should reject create service when --tcp targetPort is empty', () => {
    const parsed = parseCommand('kubectl create service clusterip my-svc --tcp=80:')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'error: invalid --tcp format, expected port[:targetPort]'
      )
    }
  })

  it('should return yaml for create service nodeport dry-run client', () => {
    const parsed = parseCommand(
      'kubectl create service nodeport my-svc --tcp=80:8080 --node-port=30080 --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)
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
    const createdService = apiServer.findResource(
      'Service',
      'my-svc',
      'default'
    )
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)
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

  it('should return pod yaml for run dry-run client without null creationTimestamp and implicit default namespace', () => {
    const parsed = parseCommand(
      'kubectl run run-dry-run --image=busybox --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleRun(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('kind: Pod')
    expect(result.value).not.toContain('namespace: default')
    expect(result.value).not.toContain('creationTimestamp: null')
  })

  it('should match kubectl pod yaml shape for run dry-run with args', () => {
    const parsed = parseCommand(
      'kubectl run app -n my-db --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleRun(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toBe(
      `${[
        'apiVersion: v1',
        'kind: Pod',
        'metadata:',
        '  labels:',
        '    run: app',
        '  name: app',
        '  namespace: my-db',
        'spec:',
        '  containers:',
        '  - args:',
        '    - sleep',
        '    - "3600"',
        '    image: busybox:1.36',
        '    name: app',
        '    resources: {}',
        '  dnsPolicy: ClusterFirst',
        '  restartPolicy: Always',
        'status: {}'
      ].join('\n')}\n`
    )
  })

  it('should keep explicit run labels without injecting default run label', () => {
    const parsed = parseCommand(
      'kubectl run app --image=busybox:1.36 --labels=app=demo --dry-run=client -o yaml -- sleep 3600'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleRun(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('    app: demo')
    expect(result.value).not.toContain('    run: app')
  })

  it('should include target namespace in run dry-run client yaml', () => {
    const parsed = parseCommand(
      'kubectl run run-dry-run-ns --image=busybox -n exercice-01 --dry-run=client -o yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleRun(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('namespace: exercice-01')
  })

  it('should return jsonpath value for create configmap dry-run client', () => {
    const parsed = parseCommand(
      "kubectl create configmap app-config --from-literal=LOG_LEVEL=info --dry-run=client -o jsonpath='{.metadata.name}'"
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toBe('app-config')
    const configMap = apiServer.findResource(
      'ConfigMap',
      'app-config',
      'default'
    )
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)
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

    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const secret = apiServer.findResource('Secret', 'app-secret', 'default')
    expect(secret.ok).toBe(true)
    if (!secret.ok) {
      return
    }
    expect(secret.value.data.username).toBe('YWRtaW4=')
    expect(secret.value.data.LOG_LEVEL).toBe('ZGVidWc=')
    expect(secret.value.data.FEATURE_X).toBe('dHJ1ZQ==')
  })

  it('should return kubectl-like path error for missing --from-file source', () => {
    const parsed = parseCommand(
      'kubectl create secret generic app-secret --from-file=username=missing.txt'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('error: the path "missing.txt" does not exist')
      expect(result.error).not.toContain('cat:')
    }
  })

  it('should create gateway when gatewayclass reference is missing', () => {
    fileSystem.createFile('gateway.yaml')
    fileSystem.writeFile(
      'gateway.yaml',
      [
        'apiVersion: gateway.networking.k8s.io/v1',
        'kind: Gateway',
        'metadata:',
        '  name: demo-gw',
        '  namespace: default',
        'spec:',
        '  gatewayClassName: missing-class'
      ].join('\n')
    )
    const parsed = parseCommand('kubectl create -f gateway.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)
    const gateway = apiServer.findResource('Gateway', 'demo-gw', 'default')
    expect(gateway.ok).toBe(true)
    if (gateway.ok) {
      expect(gateway.value.status?.conditions?.[0]?.status).toBe('False')
    }
  })

  it('should create gateway when gatewayclass exists and set programmed condition', () => {
    fileSystem.createFile('gateway-class.yaml')
    fileSystem.writeFile(
      'gateway-class.yaml',
      [
        'apiVersion: gateway.networking.k8s.io/v1',
        'kind: GatewayClass',
        'metadata:',
        '  name: demo-class',
        'spec:',
        '  controllerName: gateway.envoyproxy.io/gatewayclass-controller'
      ].join('\n')
    )
    fileSystem.createFile('gateway.yaml')
    fileSystem.writeFile(
      'gateway.yaml',
      [
        'apiVersion: gateway.networking.k8s.io/v1',
        'kind: Gateway',
        'metadata:',
        '  name: demo-gw',
        '  namespace: default',
        'spec:',
        '  gatewayClassName: demo-class'
      ].join('\n')
    )
    const parsedGatewayClass = parseCommand(
      'kubectl create -f gateway-class.yaml'
    )
    expect(parsedGatewayClass.ok).toBe(true)
    if (!parsedGatewayClass.ok) {
      return
    }
    const createGatewayClassResult = handleCreate(
      fileSystem,
      apiServer,
      parsedGatewayClass.value
    )
    expect(createGatewayClassResult.ok).toBe(true)

    const parsedGateway = parseCommand('kubectl create -f gateway.yaml')
    expect(parsedGateway.ok).toBe(true)
    if (!parsedGateway.ok) {
      return
    }
    const createGatewayResult = handleCreate(
      fileSystem,
      apiServer,
      parsedGateway.value
    )
    expect(createGatewayResult.ok).toBe(true)
    const gateway = apiServer.findResource('Gateway', 'demo-gw', 'default')
    expect(gateway.ok).toBe(true)
    if (!gateway.ok) {
      return
    }
    expect(gateway.value.status?.conditions?.[0]?.type).toBe('Programmed')
    expect(gateway.value.status?.conditions?.[0]?.status).toBe('False')
  })

  it('should create httproute when parent gateway is missing', () => {
    fileSystem.createFile('httproute.yaml')
    fileSystem.writeFile(
      'httproute.yaml',
      [
        'apiVersion: gateway.networking.k8s.io/v1',
        'kind: HTTPRoute',
        'metadata:',
        '  name: demo-route',
        '  namespace: default',
        'spec:',
        '  parentRefs:',
        '    - name: missing-gw'
      ].join('\n')
    )
    const parsed = parseCommand('kubectl create -f httproute.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    const result = handleCreate(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)
    const httpRoute = apiServer.findResource(
      'HTTPRoute',
      'demo-route',
      'default'
    )
    expect(httpRoute.ok).toBe(true)
    if (httpRoute.ok) {
      const parentCondition =
        httpRoute.value.status?.parents?.[0]?.conditions?.find((condition) => {
          return condition.type === 'Accepted'
        })
      expect(parentCondition?.status).toBe('False')
    }
  })
})
