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
      expect(result.error).toContain("See 'kubectl create -h' for help and examples")
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
    const result = parseCommand('kubectl create secret mysecret --from-literal=a=b')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'create secret requires one of: generic, tls, docker-registry'
      )
    }
  })

  it('should reject create secret tls when cert is missing', () => {
    const result = parseCommand('kubectl create secret tls tls-secret --key=tls.key')

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
})

describe('kubectl parser - get and delete flag positions', () => {
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
      "kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{\"\\n\"}{end}'"
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.flags.o).toBe(
      "jsonpath='{range .items[*]}{.metadata.name}{\"\\n\"}{end}'"
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
    expect(result.value.selector).toEqual({ tier: 'control-plane' })
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
    expect(result.value.selector).toEqual({ tier: 'control-plane' })
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
