import { describe, expect, it } from 'vitest'
import { parseCommand } from '../../../../src/core/kubectl/commands/parser'

describe('kubectl parser - create deployment', () => {
  it('should parse replicas and port for imperative create', () => {
    const result = parseCommand(
      'kubectl create deployment my-dep --image=nginx --replicas=3 --port=8080'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('my-dep')
    expect(result.value.replicas).toBe(3)
    expect(result.value.port).toBe(8080)
  })

  it('should parse namespace for imperative create', () => {
    const result = parseCommand(
      'kubectl create deployment my-dep --image=nginx -n staging'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.namespace).toBe('staging')
  })

  it('should parse repeated image flags and command after separator', () => {
    const result = parseCommand(
      'kubectl create deployment my-dep --image=busybox --image=nginx -- date'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.createImages).toEqual(['busybox', 'nginx'])
    expect(result.value.createCommand).toEqual(['date'])
  })

  it('should parse name when namespace flag is before the name', () => {
    const result = parseCommand(
      'kubectl create deployment -n staging my-dep --image=busybox'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.name).toBe('my-dep')
    expect(result.value.namespace).toBe('staging')
  })

  it('should parse imperative namespace creation', () => {
    const result = parseCommand('kubectl create namespace my-team')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('create')
    expect(result.value.resource).toBe('namespaces')
    expect(result.value.name).toBe('my-team')
  })

  it('should reject plural resource token for imperative create deployment', () => {
    const result = parseCommand(
      'kubectl create deployments my-dep --dry-run=client -o json'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Unexpected args: [deployments my-dep]')
      expect(result.error).toContain(
        "See 'kubectl create -h' for help and examples"
      )
    }
  })

  it('should reject unknown create subcommand with kubectl usage error', () => {
    const result = parseCommand('kubectl create cluster-info')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Unexpected args: [cluster-info]')
      expect(result.error).toContain(
        "See 'kubectl create -h' for help and examples"
      )
    }
  })

  it('should reject create when dry-run value is invalid', () => {
    const result = parseCommand(
      'kubectl create deployment my-dep --image=nginx --dry-run=local'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'error: Invalid dry-run value (local). Must be "none", "server", or "client".'
      )
    }
  })

  it('should parse imperative create service clusterip', () => {
    const result = parseCommand(
      'kubectl create service clusterip my-svc --tcp=80:8080 -n staging'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('services')
    expect(result.value.createServiceType).toBe('clusterip')
    expect(result.value.name).toBe('my-svc')
    expect(result.value.namespace).toBe('staging')
  })

  it('should reject create service when subtype is missing', () => {
    const result = parseCommand('kubectl create service my-svc --tcp=80:8080')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'create service requires one of: clusterip, nodeport, loadbalancer, externalname'
      )
    }
  })

  it('should reject create service externalname without external-name flag', () => {
    const result = parseCommand('kubectl create service externalname my-svc')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'create service externalname requires flag --external-name'
      )
    }
  })

  it('should parse imperative create ingress with class and repeated rules', () => {
    const result = parseCommand(
      'kubectl create ingress demo-ingress --class=nginx --rule=demo.example.com/api=api-service:5678 --rule=demo.example.com/=frontend-service:80'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('ingresses')
    expect(result.value.name).toBe('demo-ingress')
    expect(result.value.createIngressClassName).toBe('nginx')
    expect(result.value.createIngressRules).toEqual([
      'demo.example.com/api=api-service:5678',
      'demo.example.com/=frontend-service:80'
    ])
  })

  it('should reject create ingress when --rule is missing', () => {
    const result = parseCommand(
      'kubectl create ingress demo-ingress --class=nginx'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'create ingress requires at least one --rule'
      )
    }
  })

  it('should parse create configmap from literals', () => {
    const result = parseCommand(
      'kubectl create configmap app-config --from-literal=LOG_LEVEL=info --from-literal=MODE=prod --dry-run=client -o yaml'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('configmaps')
    expect(result.value.name).toBe('app-config')
    expect(result.value.createFromLiterals).toEqual([
      'LOG_LEVEL=info',
      'MODE=prod'
    ])
  })

  it('should parse create secret generic with mixed sources', () => {
    const result = parseCommand(
      'kubectl create secret generic mysecret --from-literal=password=s3cr3t --from-file=username=creds.txt --from-env-file=app.env --dry-run=client -o yaml'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('secrets')
    expect(result.value.createSecretType).toBe('generic')
    expect(result.value.name).toBe('mysecret')
    expect(result.value.createFromLiterals).toEqual(['password=s3cr3t'])
    expect(result.value.createFromFiles).toEqual(['username=creds.txt'])
    expect(result.value.createFromEnvFiles).toEqual(['app.env'])
  })

  it('should parse create secret tls', () => {
    const result = parseCommand(
      'kubectl create secret tls tls-secret --cert=tls.crt --key=tls.key'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('secrets')
    expect(result.value.createSecretType).toBe('tls')
    expect(result.value.name).toBe('tls-secret')
  })

  it('should reject create secret without subtype', () => {
    const result = parseCommand(
      'kubectl create secret mysecret --from-literal=a=b'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'create secret requires one of: generic, tls, docker-registry'
      )
    }
  })

  it('should reject create secret tls when cert is missing', () => {
    const result = parseCommand(
      'kubectl create secret tls tls-secret --key=tls.key'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('create secret tls requires flag --cert')
    }
  })

  it('should reject create secret generic when no source flags are provided', () => {
    const result = parseCommand('kubectl create secret generic mysecret')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'create secret generic requires at least one of: --from-literal, --from-file, --from-env-file'
      )
    }
  })

  it('should reject create secret docker-registry when required flags are missing', () => {
    const result = parseCommand(
      'kubectl create secret docker-registry regcred --docker-server=docker.io --docker-username=alice'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'create secret docker-registry requires flag --docker-password'
      )
    }
  })
})

describe('kubectl parser - run', () => {
  it('should parse run with image and command separator', () => {
    const result = parseCommand(
      'kubectl run test-pod --image=busybox --command -- sleep 3600'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('run')
    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('test-pod')
    expect(result.value.runImage).toBe('busybox')
    expect(result.value.runUseCommand).toBe(true)
    expect(result.value.runCommand).toEqual(['sleep', '3600'])
  })

  it('should parse run namespace flag', () => {
    const result = parseCommand(
      'kubectl run test-pod --image=busybox --command -n tools -- sleep 3600'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.namespace).toBe('tools')
  })

  it('should parse run args without --command', () => {
    const result = parseCommand(
      'kubectl run test-pod --image=busybox -- sleep 3600'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.runUseCommand).toBe(false)
    expect(result.value.runArgs).toEqual(['sleep', '3600'])
  })

  it('should parse positional run args without separator', () => {
    const result = parseCommand('kubectl run test-pod pod --image=nginx')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.name).toBe('test-pod')
    expect(result.value.runUseCommand).toBe(false)
    expect(result.value.runArgs).toEqual(['pod'])
  })

  it('should parse run labels/env/port flags', () => {
    const result = parseCommand(
      'kubectl run test-pod --image=busybox --port=5701 --env=DNS_DOMAIN=cluster --env=POD_NAMESPACE=default --labels=app=hazelcast,env=prod'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.port).toBe(5701)
    expect(result.value.runEnv).toEqual([
      'DNS_DOMAIN=cluster',
      'POD_NAMESPACE=default'
    ])
    expect(result.value.runLabels).toEqual({ app: 'hazelcast', env: 'prod' })
  })

  it('should parse run labels with quoted value', () => {
    const result = parseCommand(
      'kubectl run intruder --image=nginx:1.28 --labels="app=web"'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.name).toBe('intruder')
    expect(result.value.runLabels).toEqual({ app: 'web' })
  })

  it('should reject run labels when label spec is malformed', () => {
    const result = parseCommand(
      'kubectl run web --image=nginx:1.28 --labels=app==web,tier=frontend --dry-run=client -o yaml'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('error: unexpected label spec: app==web')
    }
  })

  it('should parse run with dry-run client', () => {
    const result = parseCommand(
      'kubectl run test-pod --image=busybox --dry-run=client'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.runDryRunClient).toBe(true)
  })

  it('should parse run interactive flags with restart Never and rm', () => {
    const result = parseCommand(
      'kubectl run -i -t busybox --image=busybox --restart=Never --rm'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.name).toBe('busybox')
    expect(result.value.runStdin).toBe(true)
    expect(result.value.runTty).toBe(true)
    expect(result.value.runRemove).toBe(true)
    expect(result.value.runRestart).toBe('Never')
  })

  it('should parse bundled short interactive flags -it for run', () => {
    const result = parseCommand(
      'kubectl run -it busybox --image=busybox --restart=Never --rm'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.name).toBe('busybox')
    expect(result.value.runStdin).toBe(true)
    expect(result.value.runTty).toBe(true)
    expect(result.value.runRemove).toBe(true)
    expect(result.value.runRestart).toBe('Never')
  })

  it('should parse run with --attach flag', () => {
    const result = parseCommand('kubectl run test-pod --image=busybox --attach')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.flags.attach).toBe(true)
  })

  it('should parse run with --image-pull-policy flag', () => {
    const result = parseCommand(
      'kubectl run test-pod --image=busybox --image-pull-policy=IfNotPresent'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.flags['image-pull-policy']).toBe('IfNotPresent')
  })

  it('should reject run when image is missing', () => {
    const result = parseCommand('kubectl run test-pod --command -- sleep 3600')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('error: required flag(s) "image" not set')
    }
  })

  it('should accept run when --command has no command after separator', () => {
    const result = parseCommand(
      'kubectl run test-pod --image=busybox --command --'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.runUseCommand).toBe(true)
    expect(result.value.runCommand).toBeUndefined()
  })

  it('should accept run when separator is present without args', () => {
    const result = parseCommand('kubectl run test-pod --image=busybox --')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.runUseCommand).toBe(false)
    expect(result.value.runArgs).toBeUndefined()
  })

  it('should reject run when dry-run value is invalid', () => {
    const result = parseCommand(
      'kubectl run test-pod --image=busybox --dry-run=local'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'error: Invalid dry-run value (local). Must be "none", "server", or "client".'
      )
    }
  })

  it('should reject run when restart value is invalid', () => {
    const result = parseCommand(
      'kubectl run test-pod --image=busybox --restart=Sometimes'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('error: invalid restart policy: Sometimes')
    }
  })
})

describe('kubectl parser - rollout', () => {
  it('should parse rollout status using type/name syntax', () => {
    const result = parseCommand(
      'kubectl rollout status deployment/web-app --timeout=45s --watch=false'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('rollout')
    expect(result.value.rolloutSubcommand).toBe('status')
    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('web-app')
    expect(result.value.rolloutTimeoutSeconds).toBe(45)
    expect(result.value.rolloutWatch).toBe(false)
  })

  it('should parse rollout history revision flag', () => {
    const result = parseCommand(
      'kubectl rollout history statefulset web --revision=2'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.rolloutSubcommand).toBe('history')
    expect(result.value.resource).toBe('statefulsets')
    expect(result.value.name).toBe('web')
    expect(result.value.rolloutRevision).toBe(2)
  })

  it('should parse rollout undo to-revision flag as rolloutRevision', () => {
    const result = parseCommand(
      'kubectl rollout undo deployment/web-app --to-revision=1'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.rolloutSubcommand).toBe('undo')
    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('web-app')
    expect(result.value.rolloutRevision).toBe(1)
  })

  it('should reject invalid rollout subcommand', () => {
    const result = parseCommand('kubectl rollout pause deployment/web-app')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('invalid subcommand for rollout')
    }
  })
})

describe('kubectl parser - expose', () => {
  it('should parse expose deployment with required port', () => {
    const result = parseCommand(
      'kubectl expose deployment web --port=80 -n dev'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('expose')
    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('web')
    expect(result.value.port).toBe(80)
    expect(result.value.namespace).toBe('dev')
  })

  it('should parse expose type and target-port flags', () => {
    const result = parseCommand(
      'kubectl expose deployment web --port=80 --target-port=8080 --type=NodePort'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.flags['target-port']).toBe('8080')
    expect(result.value.flags.type).toBe('NodePort')
  })

  it('should parse expose with dry-run client and yaml output', () => {
    const result = parseCommand(
      'kubectl expose deployment web --port=80 --target-port=80 --dry-run=client -o yaml'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.flags['dry-run']).toBe('client')
    expect(result.value.output).toBe('yaml')
  })

  it('should reject expose when dry-run value is invalid', () => {
    const result = parseCommand(
      'kubectl expose deployment web --port=80 --dry-run=local'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'error: Invalid dry-run value (local). Must be "none", "server", or "client".'
      )
    }
  })

  it('should reject expose without name', () => {
    const result = parseCommand('kubectl expose deployment --port=80')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('expose requires a resource name')
    }
  })
})

describe('kubectl parser - describe', () => {
  it('should parse name when namespace flag is between resource and name', () => {
    const result = parseCommand(
      'kubectl describe pod -n kube-system coredns-abc'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.namespace).toBe('kube-system')
  })

  it('should parse resource and name when namespace flag is before resource', () => {
    const result = parseCommand(
      'kubectl describe -n kube-system pod coredns-abc'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.namespace).toBe('kube-system')
  })

  it('should parse node describe command', () => {
    const result = parseCommand('kubectl describe node sim-worker')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('nodes')
    expect(result.value.name).toBe('sim-worker')
  })

  it('should parse node describe command without name', () => {
    const result = parseCommand('kubectl describe node')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('nodes')
    expect(result.value.name).toBeUndefined()
  })

  it('should parse node alias "no" for describe', () => {
    const result = parseCommand('kubectl describe no sim-worker')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('nodes')
    expect(result.value.name).toBe('sim-worker')
  })

  it('should parse ingress alias "ing" for describe', () => {
    const result = parseCommand('kubectl describe ing demo-ingress')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('ingresses')
    expect(result.value.name).toBe('demo-ingress')
  })

  it('should parse describe command with type/name syntax', () => {
    const result = parseCommand('kubectl describe deployment/web-app')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('web-app')
  })

  it('should parse describe events without name', () => {
    const result = parseCommand('kubectl describe events')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('events')
    expect(result.value.name).toBeUndefined()
  })

  it('should parse describe command with label selector and no name', () => {
    const result = parseCommand('kubectl describe pod -l app=probed')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBeUndefined()
    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'app',
          operator: 'Equals',
          values: ['probed']
        }
      ]
    })
  })

  it('should reject describe command without name or selector', () => {
    const result = parseCommand('kubectl describe pod')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('describe requires a resource name')
    }
  })
})

describe('kubectl parser - get and delete flag positions', () => {
  it('should parse namespace shorthand value that starts with a dash', () => {
    const result = parseCommand('kubectl get pods -n -kube-system')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.namespace).toBe('-kube-system')
    expect(result.value.name).toBeUndefined()
  })

  it('should parse get when namespace flag is before resource', () => {
    const result = parseCommand('kubectl get -n kube-system pods')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.namespace).toBe('kube-system')
    expect(result.value.name).toBeUndefined()
  })

  it('should parse get when namespace flag is between resource and name', () => {
    const result = parseCommand('kubectl get pod -n kube-system coredns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.names).toEqual(['coredns-abc'])
    expect(result.value.namespace).toBe('kube-system')
  })

  it('should parse get with type/name syntax', () => {
    const result = parseCommand('kubectl get pod/coredns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.names).toEqual(['coredns-abc'])
  })

  it('should parse all positional names for get command', () => {
    const result = parseCommand(
      "kubectl get deployments my-app o jsonpath='{.metadata.labels}'"
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('my-app')
    expect(result.value.names).toEqual([
      'my-app',
      'o',
      "jsonpath='{.metadata.labels}'"
    ])
  })

  it('should parse get show-labels flag', () => {
    const result = parseCommand('kubectl get pods --show-labels')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.flags['show-labels']).toBe(true)
  })

  it('should parse get with comma-separated resources', () => {
    const result = parseCommand(
      'kubectl get pod,svc,configmap,secret -n parity-e2e'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.resourceList).toEqual([
      'pods',
      'services',
      'configmaps',
      'secrets'
    ])
    expect(result.value.namespace).toBe('parity-e2e')
  })

  it('should parse get jsonpath output flag', () => {
    const result = parseCommand(
      "kubectl get pod mypod -o jsonpath='{.metadata.uid}'"
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('mypod')
    expect(result.value.flags.o).toBe("jsonpath='{.metadata.uid}'")
  })

  it('should parse get long output jsonpath flag', () => {
    const result = parseCommand(
      "kubectl get pod mypod --output=jsonpath='{.metadata.uid}'"
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.flags.output).toBe("jsonpath='{.metadata.uid}'")
  })

  it('should parse get jsonpath template with spaces', () => {
    const result = parseCommand(
      'kubectl get pods -o jsonpath=\'{range .items[*]}{.metadata.name}{"\\n"}{end}\''
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.flags.o).toBe(
      'jsonpath=\'{range .items[*]}{.metadata.name}{"\\n"}{end}\''
    )
  })

  it('should parse get short label selector flag', () => {
    const result = parseCommand(
      'kubectl get pods -n kube-system -l tier=control-plane'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.namespace).toBe('kube-system')
    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'tier',
          operator: 'Equals',
          values: ['control-plane']
        }
      ]
    })
  })

  it('should parse get long label selector flag', () => {
    const result = parseCommand(
      'kubectl get pods -n kube-system --selector tier=control-plane'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.namespace).toBe('kube-system')
    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'tier',
          operator: 'Equals',
          values: ['control-plane']
        }
      ]
    })
  })

  it('should parse set-based in selector', () => {
    const result = parseCommand(
      'kubectl get pods -l "env in (staging,production)"'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'env',
          operator: 'In',
          values: ['staging', 'production']
        }
      ]
    })
  })

  it('should parse set-based notin selector', () => {
    const result = parseCommand('kubectl get pods -l "track notin (canary)"')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'track',
          operator: 'NotIn',
          values: ['canary']
        }
      ]
    })
  })

  it('should parse exists selector', () => {
    const result = parseCommand('kubectl get pods -l version')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'version',
          operator: 'Exists',
          values: []
        }
      ]
    })
  })

  it('should parse does-not-exist selector', () => {
    const result = parseCommand("kubectl get pods -l '!version'")

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'version',
          operator: 'DoesNotExist',
          values: []
        }
      ]
    })
  })

  it('should reject invalid selector syntax', () => {
    const result = parseCommand('kubectl get pods -l "env in (staging,)"')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('invalid label selector')
    }
  })

  it('should parse delete when namespace flag is before resource', () => {
    const result = parseCommand('kubectl delete -n kube-system pod coredns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.namespace).toBe('kube-system')
  })

  it('should parse delete when namespace flag is between resource and name', () => {
    const result = parseCommand('kubectl delete pod -n kube-system coredns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.namespace).toBe('kube-system')
  })

  it('should parse delete with multiple positional names', () => {
    const result = parseCommand('kubectl delete pod pod-1 pod-2 pod-3')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('pod-1')
    expect(result.value.names).toEqual(['pod-1', 'pod-2', 'pod-3'])
  })

  it('should parse delete with type/name syntax', () => {
    const result = parseCommand('kubectl delete pod/pod-1')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('pod-1')
    expect(result.value.names).toEqual(['pod-1'])
  })

  it('should parse delete all with label selector and no name', () => {
    const result = parseCommand('kubectl delete all -l tier=experiment')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('all')
    expect(result.value.name).toBeUndefined()
    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'tier',
          operator: 'Equals',
          values: ['experiment']
        }
      ]
    })
  })

  it('should parse delete pods with label selector and no name', () => {
    const result = parseCommand('kubectl delete pods -l app=demo')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBeUndefined()
    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'app',
          operator: 'Equals',
          values: ['demo']
        }
      ]
    })
  })

  it('should parse delete with short filename flag', () => {
    const result = parseCommand('kubectl delete -f pod.yaml')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('delete')
    expect(result.value.flags.f).toBe('pod.yaml')
  })

  it('should parse delete with long filename flag', () => {
    const result = parseCommand('kubectl delete --filename pod.yaml')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('delete')
    expect(result.value.flags.filename).toBe('pod.yaml')
  })

  it('should parse delete grace period and force flags', () => {
    const result = parseCommand(
      'kubectl delete pod demo --grace-period=0 --force'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('demo')
    expect(result.value.deleteGracePeriodSeconds).toBe(0)
    expect(result.value.deleteForce).toBe(true)
  })

  it('should parse delete wait flag', () => {
    const result = parseCommand('kubectl delete pods -l app=demo --wait=false')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'app',
          operator: 'Equals',
          values: ['demo']
        }
      ]
    })
    expect(result.value.flags.wait).toBe('false')
  })

  it('should reject delete with invalid grace period value', () => {
    const result = parseCommand('kubectl delete pod demo --grace-period=oops')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('invalid --grace-period value')
    }
  })
})

describe('kubectl parser - metadata commands', () => {
  it('should parse label with type/name syntax', () => {
    const result = parseCommand('kubectl label deployment/web app=api')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('web')
    expect(result.value.labelChanges).toEqual({ app: 'api' })
  })

  it('should parse annotate with type/name syntax', () => {
    const result = parseCommand(
      'kubectl annotate deployment/web kubernetes.io/change-cause="upgrade" --overwrite'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('web')
    expect(result.value.annotationChanges).toEqual({
      'kubernetes.io/change-cause': 'upgrade'
    })
    expect(result.value.flags.overwrite).toBe(true)
  })

  it('should parse label overwrite explicit boolean value', () => {
    const result = parseCommand(
      'kubectl label deployment/web app=api --overwrite=true'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('web')
    expect(result.value.labelChanges).toEqual({ app: 'api' })
    expect(result.value.flags.overwrite).toBe('true')
  })
})

describe('kubectl parser - get raw', () => {
  it('should parse raw root path', () => {
    const result = parseCommand('kubectl get --raw /')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('get')
    expect(result.value.rawPath).toBe('/')
    expect(result.value.resource).toBeUndefined()
  })

  it('should parse raw namespaces path', () => {
    const result = parseCommand('kubectl get --raw /api/v1/namespaces')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.rawPath).toBe('/api/v1/namespaces')
    expect(result.value.resource).toBeUndefined()
  })

  it('should reject arguments when --raw is provided', () => {
    const result = parseCommand('kubectl get pods --raw /')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'arguments may not be passed when --raw is specified'
      )
    }
  })

  it('should reject --raw with output flag', () => {
    const result = parseCommand('kubectl get --raw / -o json')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        '--raw and --output are mutually exclusive'
      )
    }
  })

  it('should reject invalid raw path', () => {
    const result = parseCommand('kubectl get --raw not-a-path')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('--raw must be a valid URL path')
    }
  })
})

describe('kubectl parser - api versions', () => {
  it('should parse api-versions command without resource', () => {
    const result = parseCommand('kubectl api-versions')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('api-versions')
    expect(result.value.resource).toBeUndefined()
  })
})

describe('kubectl parser - get all', () => {
  it('should parse get all as a valid resource', () => {
    const result = parseCommand('kubectl get all')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('get')
    expect(result.value.resource).toBe('all')
  })
})

describe('kubectl parser - get events', () => {
  it('should parse get events command', () => {
    const result = parseCommand('kubectl get events')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('get')
    expect(result.value.resource).toBe('events')
  })

  it('should parse get event alias and all namespaces', () => {
    const result = parseCommand('kubectl get ev -A')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('events')
    expect(result.value.flags.A).toBe(true)
  })
})

describe('kubectl parser - explain', () => {
  it('should parse explain command with resource path', () => {
    const result = parseCommand('kubectl explain pod.spec.containers')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('explain')
    expect(result.value.resource).toBe('pods')
    expect(result.value.explainPath).toEqual(['spec', 'containers'])
  })

  it('should parse explain command with root resource only', () => {
    const result = parseCommand('kubectl explain service')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('explain')
    expect(result.value.resource).toBe('services')
    expect(result.value.explainPath).toEqual([])
  })

  it('should parse explain recursive flag', () => {
    const result = parseCommand(
      'kubectl explain pod.spec.containers --recursive'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.flags.recursive).toBe(true)
  })

  it('should reject explain command without resource argument', () => {
    const result = parseCommand('kubectl explain')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'you must specify the type of resource to explain'
      )
    }
  })

  it('should reject explain command with multiple positional arguments', () => {
    const result = parseCommand('kubectl explain pod spec')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'We accept only this format: explain RESOURCE'
      )
    }
  })
})

describe('kubectl parser - diff', () => {
  it('should parse diff command with filename', () => {
    const result = parseCommand('kubectl diff -f pod.yaml')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('diff')
    expect(result.value.flags.f).toBe('pod.yaml')
  })

  it('should reject diff command without filename', () => {
    const result = parseCommand('kubectl diff')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('diff requires one of -f or --filename')
    }
  })
})

describe('kubectl parser - replace', () => {
  it('should parse replace command with filename', () => {
    const result = parseCommand('kubectl replace -f pod.yaml')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('replace')
    expect(result.value.flags.f).toBe('pod.yaml')
  })

  it('should parse replace command with force and long filename', () => {
    const result = parseCommand('kubectl replace --force --filename pod.yaml')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('replace')
    expect(result.value.flags.force).toBe(true)
    expect(result.value.flags.filename).toBe('pod.yaml')
  })

  it('should reject replace without filename flag', () => {
    const result = parseCommand('kubectl replace')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('replace requires one of -f or --filename')
    }
  })
})

describe('kubectl parser - set image', () => {
  it('should parse set image command with type/name syntax', () => {
    const result = parseCommand('kubectl set image pod/my-pod web=nginx:1.26')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('set')
    expect(result.value.setSubcommand).toBe('image')
    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('my-pod')
    expect(result.value.setImageAssignments).toEqual({
      web: 'nginx:1.26'
    })
  })

  it('should parse set image command with resource name syntax', () => {
    const result = parseCommand(
      'kubectl set image deployment my-deploy app=nginx:1.26 sidecar=busybox:1.36'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('my-deploy')
    expect(result.value.setImageAssignments).toEqual({
      app: 'nginx:1.26',
      sidecar: 'busybox:1.36'
    })
  })

  it('should reject set command without image subcommand', () => {
    const result = parseCommand('kubectl set')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'set currently supports only the image subcommand'
      )
    }
  })

  it('should reject set image command without container assignment', () => {
    const result = parseCommand('kubectl set image pod/my-pod')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'set image requires at least one container=image assignment'
      )
    }
  })
})

describe('kubectl parser - edit', () => {
  it('should parse edit command with resource and name', () => {
    const result = parseCommand('kubectl edit pod edit-demo')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('edit')
    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('edit-demo')
  })

  it('should parse edit command with type/name syntax', () => {
    const result = parseCommand('kubectl edit deployment/my-app -n staging')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('edit')
    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('my-app')
    expect(result.value.namespace).toBe('staging')
  })

  it('should reject edit command without resource name', () => {
    const result = parseCommand('kubectl edit pod')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('edit requires a resource name')
    }
  })
})

describe('kubectl parser - config', () => {
  it('should parse config get-contexts command', () => {
    const result = parseCommand('kubectl config get-contexts')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-get-contexts')
    expect(result.value.configSubcommand).toBe('get-contexts')
  })

  it('should parse config current-context command', () => {
    const result = parseCommand('kubectl config current-context')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-current-context')
    expect(result.value.configSubcommand).toBe('current-context')
  })

  it('should parse config view --minify command', () => {
    const result = parseCommand('kubectl config view --minify')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-view')
    expect(result.value.configMinify).toBe(true)
  })

  it('should parse config set-context --current --namespace command', () => {
    const result = parseCommand(
      'kubectl config set-context --current --namespace=dev'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-set-context')
    expect(result.value.configCurrent).toBe(true)
    expect(result.value.configNamespace).toBe('dev')
  })

  it('should reject config set-context without namespace', () => {
    const result = parseCommand('kubectl config set-context --current')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'config set-context requires flag --namespace'
      )
    }
  })

  it('should reject get when --watch and --watch-only are both set', () => {
    const result = parseCommand('kubectl get pods --watch --watch-only')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        '--watch and --watch-only are mutually exclusive'
      )
    }
  })
})

describe('kubectl parser - config advanced', () => {
  it('should parse config use-context command', () => {
    const result = parseCommand('kubectl config use-context kind-dev')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-use-context')
    expect(result.value.configContextName).toBe('kind-dev')
  })

  it('should parse config get-clusters command', () => {
    const result = parseCommand('kubectl config get-clusters')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-get-clusters')
  })

  it('should parse config get-users command', () => {
    const result = parseCommand('kubectl config get-users')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-get-users')
  })

  it('should parse config set-credentials command', () => {
    const result = parseCommand(
      'kubectl config set-credentials e2e-user --token=abc123'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-set-credentials')
    expect(result.value.configUserName).toBe('e2e-user')
    expect(result.value.configToken).toBe('abc123')
  })

  it('should parse config set-cluster command', () => {
    const result = parseCommand(
      'kubectl config set-cluster kind-dev --server=https://127.0.0.1:6443'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-set-cluster')
    expect(result.value.configClusterName).toBe('kind-dev')
    expect(result.value.configServer).toBe('https://127.0.0.1:6443')
  })

  it('should parse config unset command', () => {
    const result = parseCommand('kubectl config unset contexts.kind-dev.namespace')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-unset')
    expect(result.value.configPath).toBe('contexts.kind-dev.namespace')
  })

  it('should parse config rename-context command', () => {
    const result = parseCommand(
      'kubectl config rename-context kind-dev kind-stage'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('config-rename-context')
    expect(result.value.configContextName).toBe('kind-dev')
    expect(result.value.configRenameContextTo).toBe('kind-stage')
  })
})

describe('kubectl parser - auth and token', () => {
  it('should parse create token command', () => {
    const result = parseCommand('kubectl create token robot')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('create-token')
    expect(result.value.name).toBe('robot')
  })

  it('should parse auth can-i command with --as', () => {
    const result = parseCommand(
      'kubectl auth can-i get pods -n default --as=system:serviceaccount:default:robot'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('auth-can-i')
    expect(result.value.authVerb).toBe('get')
    expect(result.value.authResource).toBe('pods')
    expect(result.value.authSubject).toBe(
      'system:serviceaccount:default:robot'
    )
  })

  it('should parse auth whoami command with --as', () => {
    const result = parseCommand('kubectl auth whoami --as=e2e-user')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('auth-whoami')
    expect(result.value.authSubject).toBe('e2e-user')
  })

  it('should parse auth reconcile command with filename', () => {
    const result = parseCommand('kubectl auth reconcile -f rbac.yaml')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('auth-reconcile')
    expect(result.value.flags.f).toBe('rbac.yaml')
  })
})

describe('kubectl parser - wait', () => {
  it('parses kubectl wait --for=condition=Ready pod/web --timeout=60s', () => {
    const result = parseCommand(
      'kubectl wait --for=condition=Ready pod/web --timeout=60s'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.action).toBe('wait')
    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('web')
    expect(result.value.waitForCondition).toBe('condition=Ready')
    expect(result.value.waitTimeoutSeconds).toBe(60)
  })

  it('parses wait with -n namespace', () => {
    const result = parseCommand(
      'kubectl wait --for=condition=Ready pod/my-pod -n default --timeout=30s'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.action).toBe('wait')
    expect(result.value.name).toBe('my-pod')
    expect(result.value.namespace).toBe('default')
    expect(result.value.waitTimeoutSeconds).toBe(30)
  })
})

describe('kubectl parser - patch', () => {
  it('should parse merge patch payload with --patch', () => {
    const result = parseCommand(
      `kubectl patch deployment my-app --type=merge --patch '{"spec":{"replicas":4}}'`
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('patch')
    expect(result.value.resource).toBe('deployments')
    expect(result.value.name).toBe('my-app')
    expect(result.value.patchType).toBe('merge')
    expect(result.value.patchPayload).toBe('{"spec":{"replicas":4}}')
  })

  it('should parse merge patch payload with -p shorthand', () => {
    const result = parseCommand(
      `kubectl patch deployment my-app -p '{"spec":{"replicas":4}}'`
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.patchPayload).toBe('{"spec":{"replicas":4}}')
  })

  it('should reject patch command without payload', () => {
    const result = parseCommand('kubectl patch deployment my-app --type=merge')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('required flag(s) "patch" not set')
    }
  })

  it('should reject patch command with unsupported --type', () => {
    const result = parseCommand(
      `kubectl patch deployment my-app --type=json -p '{"spec":{"replicas":4}}'`
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('--type must be "merge"')
    }
  })
})

describe('kubectl parser - logs', () => {
  it('should parse logs with label selector and without pod name', () => {
    const result = parseCommand(
      'kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail=30'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.action).toBe('logs')
    expect(result.value.name).toBeUndefined()
    expect(result.value.namespace).toBe('ingress-nginx')
    expect(result.value.flags.l).toBe('app.kubernetes.io/component=controller')
    expect(result.value.flags.tail).toBe('30')
  })
})

describe('kubectl parser - unknown flags', () => {
  it('should return kubectl-like shorthand error for unknown flag', () => {
    const result = parseCommand('kubectl get -toto')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe(
        "error: unknown shorthand flag: 't' in -toto\nSee 'kubectl get --help' for usage."
      )
    }
  })

  it('should return kubectl-like long flag error for unknown flag', () => {
    const result = parseCommand(
      'kubectl describe pod nginx-pod --totally-unknown'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe(
        "error: unknown flag: --totally-unknown\nSee 'kubectl describe --help' for usage."
      )
    }
  })

  it('should return kubectl-like unknown command at root level', () => {
    const result = parseCommand('kubectl coocococo')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe(
        'error: unknown command "coocococo" for "kubectl"'
      )
    }
  })

  it('should parse kubectl options as action without resource', () => {
    const result = parseCommand('kubectl options')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.action).toBe('options')
  })

  it('should keep rollout subcommand errors handled by semantics', () => {
    const result = parseCommand('kubectl rollout magic')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('error: invalid subcommand for rollout')
    }
  })

  it('should parse top pods with namespace and selector', () => {
    const result = parseCommand(
      'kubectl top pods -n kube-system -l k8s-app=kube-dns'
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.action).toBe('top-pods')
    expect(result.value.namespace).toBe('kube-system')
    expect(result.value.selector).toEqual({
      requirements: [
        {
          key: 'k8s-app',
          operator: 'Equals',
          values: ['kube-dns']
        }
      ]
    })
  })

  it('should parse top pod alias with explicit name', () => {
    const result = parseCommand('kubectl top pod dns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.action).toBe('top-pods')
    expect(result.value.name).toBe('dns-abc')
  })

  it('should parse top nodes command', () => {
    const result = parseCommand('kubectl top nodes')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.action).toBe('top-nodes')
  })

  it('should reject invalid top subcommand', () => {
    const result = parseCommand('kubectl top services')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('error: invalid subcommand for top')
    }
  })
})

describe('kubectl parser - apply', () => {
  it('should reject unexpected positional args', () => {
    const result = parseCommand('kubectl apply extra')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Unexpected args: [extra]')
      expect(result.error).toContain(
        "See 'kubectl apply -h' for help and examples"
      )
    }
  })
})
