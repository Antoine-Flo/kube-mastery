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
    const result = parseCommand('kubectl run test-pod --image=busybox -- sleep 3600')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.runUseCommand).toBe(false)
    expect(result.value.runArgs).toEqual(['sleep', '3600'])
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

  it('should parse run with dry-run client', () => {
    const result = parseCommand('kubectl run test-pod --image=busybox --dry-run=client')

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
      expect(result.error).toContain('run requires flag --image')
    }
  })

  it('should reject run when --command has no command after separator', () => {
    const result = parseCommand('kubectl run test-pod --image=busybox --command --')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('run requires command after --')
    }
  })

  it('should reject run when separator is present without args', () => {
    const result = parseCommand('kubectl run test-pod --image=busybox --')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('run requires arguments after --')
    }
  })

  it('should reject run when dry-run value is invalid', () => {
    const result = parseCommand('kubectl run test-pod --image=busybox --dry-run=local')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'run dry-run must be one of: none, server, client'
      )
    }
  })

  it('should reject run when restart value is invalid', () => {
    const result = parseCommand(
      'kubectl run test-pod --image=busybox --restart=Sometimes'
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'run restart must be one of: Always, OnFailure, Never'
      )
    }
  })
})

describe('kubectl parser - expose', () => {
  it('should parse expose deployment with required port', () => {
    const result = parseCommand('kubectl expose deployment web --port=80 -n dev')

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
    const result = parseCommand('kubectl describe pod -n kube-system coredns-abc')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.resource).toBe('pods')
    expect(result.value.name).toBe('coredns-abc')
    expect(result.value.namespace).toBe('kube-system')
  })

  it('should parse resource and name when namespace flag is before resource', () => {
    const result = parseCommand('kubectl describe -n kube-system pod coredns-abc')

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
    expect(result.value.namespace).toBe('kube-system')
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
      expect(result.error).toContain('--raw and --output are mutually exclusive')
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
    const result = parseCommand('kubectl explain pod.spec.containers --recursive')

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
      expect(result.error).toContain('you must specify the type of resource to explain')
    }
  })

  it('should reject explain command with multiple positional arguments', () => {
    const result = parseCommand('kubectl explain pod spec')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('We accept only this format: explain RESOURCE')
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
      expect(result.error).toContain('config set-context requires flag --namespace')
    }
  })
})
