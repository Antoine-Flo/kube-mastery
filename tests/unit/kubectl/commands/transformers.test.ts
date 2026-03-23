import { describe, expect, it } from 'vitest'
import {
  getTransformerForAction,
  type ParseContext
} from '../../../../src/core/kubectl/commands/transformers'

describe('kubectl transformers', () => {
  const createContext = (
    overrides: Partial<ParseContext> = {}
  ): ParseContext => ({
    input: 'kubectl get pods',
    tokens: ['kubectl', 'get', 'pods'],
    ...overrides
  })

  describe('getTransformerForAction', () => {
    it('should return identity transformer for undefined action', () => {
      const transformer = getTransformerForAction(undefined)
      const ctx = createContext()

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(ctx)
      }
    })

    it('should return identity transformer for unknown action', () => {
      const transformer = getTransformerForAction('get')
      const ctx = createContext()

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
    })
  })

  describe('exec transformer', () => {
    it('should set resource to pods', () => {
      const transformer = getTransformerForAction('exec')
      const ctx = createContext({
        input: 'kubectl exec my-pod -- ls',
        tokens: ['kubectl', 'exec', 'my-pod', '--', 'ls']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('pods')
      }
    })

    it('should extract exec command after -- separator', () => {
      const transformer = getTransformerForAction('exec')
      const ctx = createContext({
        input: 'kubectl exec my-pod -- ls -la',
        tokens: ['kubectl', 'exec', 'my-pod', '--', 'ls', '-la']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.execCommand).toEqual(['ls', '-la'])
        expect(result.value.tokens).toEqual(['kubectl', 'exec', 'my-pod'])
      }
    })

    it('should handle exec without -- separator', () => {
      const transformer = getTransformerForAction('exec')
      const ctx = createContext({
        input: 'kubectl exec my-pod',
        tokens: ['kubectl', 'exec', 'my-pod']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.execCommand).toBeUndefined()
      }
    })

    it('should handle exec with complex command', () => {
      const transformer = getTransformerForAction('exec')
      const ctx = createContext({
        input: 'kubectl exec my-pod -c nginx -- sh -c "echo hello"',
        tokens: [
          'kubectl',
          'exec',
          'my-pod',
          '-c',
          'nginx',
          '--',
          'sh',
          '-c',
          'echo hello'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.execCommand).toEqual(['sh', '-c', 'echo hello'])
        expect(result.value.tokens).toEqual([
          'kubectl',
          'exec',
          'my-pod',
          '-c',
          'nginx'
        ])
      }
    })

    it('should handle missing tokens gracefully', () => {
      const transformer = getTransformerForAction('exec')
      const ctx = createContext({ tokens: undefined })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
    })
  })

  describe('logs transformer', () => {
    it('should set resource to pods', () => {
      const transformer = getTransformerForAction('logs')
      const ctx = createContext({
        input: 'kubectl logs my-pod',
        tokens: ['kubectl', 'logs', 'my-pod']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('pods')
      }
    })
  })

  describe('apply transformer', () => {
    it('should set resource to pods', () => {
      const transformer = getTransformerForAction('apply')
      const ctx = createContext({
        input: 'kubectl apply -f pod.yaml',
        tokens: ['kubectl', 'apply', '-f', 'pod.yaml']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('pods')
      }
    })
  })

  describe('delete transformer', () => {
    it('should set resource to pods for delete -f', () => {
      const transformer = getTransformerForAction('delete')
      const ctx = createContext({
        input: 'kubectl delete -f pod.yaml',
        tokens: ['kubectl', 'delete', '-f', 'pod.yaml']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('pods')
      }
    })

    it('should keep imperative delete resource unchanged', () => {
      const transformer = getTransformerForAction('delete')
      const ctx = createContext({
        input: 'kubectl delete pod my-pod',
        tokens: ['kubectl', 'delete', 'pod', 'my-pod']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBeUndefined()
      }
    })
  })

  describe('create transformer', () => {
    it('should keep create -f behavior and set resource to pods', () => {
      const transformer = getTransformerForAction('create')
      const ctx = createContext({
        input: 'kubectl create -f pod.yaml',
        tokens: ['kubectl', 'create', '-f', 'pod.yaml']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('pods')
      }
    })

    it('should extract deployment resource and name for imperative create', () => {
      const transformer = getTransformerForAction('create')
      const ctx = createContext({
        input: 'kubectl create deployment my-dep --image=busybox',
        tokens: ['kubectl', 'create', 'deployment', 'my-dep', '--image=busybox']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('deployments')
        expect(result.value.name).toBe('my-dep')
      }
    })

    it('should extract repeated --image flags', () => {
      const transformer = getTransformerForAction('create')
      const ctx = createContext({
        input:
          'kubectl create deployment my-dep --image=busybox --image=ubuntu --image=nginx',
        tokens: [
          'kubectl',
          'create',
          'deployment',
          'my-dep',
          '--image=busybox',
          '--image=ubuntu',
          '--image=nginx'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.createImages).toEqual([
          'busybox',
          'ubuntu',
          'nginx'
        ])
      }
    })

    it('should extract command after -- separator', () => {
      const transformer = getTransformerForAction('create')
      const ctx = createContext({
        input: 'kubectl create deployment my-dep --image=busybox -- date',
        tokens: [
          'kubectl',
          'create',
          'deployment',
          'my-dep',
          '--image=busybox',
          '--',
          'date'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.createCommand).toEqual(['date'])
        expect(result.value.tokens).toEqual([
          'kubectl',
          'create',
          'deployment',
          'my-dep',
          '--image=busybox'
        ])
      }
    })

    it('should support deploy alias', () => {
      const transformer = getTransformerForAction('create')
      const ctx = createContext({
        input: 'kubectl create deploy my-dep --image=busybox',
        tokens: ['kubectl', 'create', 'deploy', 'my-dep', '--image=busybox']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('deployments')
        expect(result.value.name).toBe('my-dep')
      }
    })

    it('should extract image when using --image with separate value', () => {
      const transformer = getTransformerForAction('create')
      const ctx = createContext({
        input: 'kubectl create deployment my-dep --image busybox',
        tokens: [
          'kubectl',
          'create',
          'deployment',
          'my-dep',
          '--image',
          'busybox'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.createImages).toEqual(['busybox'])
      }
    })

    it('should extract name when namespace flag is before name', () => {
      const transformer = getTransformerForAction('create')
      const ctx = createContext({
        input: 'kubectl create deployment -n prod my-dep --image=busybox',
        tokens: [
          'kubectl',
          'create',
          'deployment',
          '-n',
          'prod',
          'my-dep',
          '--image=busybox'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('my-dep')
      }
    })

    it('should keep undefined name when deployment name is missing', () => {
      const transformer = getTransformerForAction('create')
      const ctx = createContext({
        input: 'kubectl create deployment --image=busybox',
        tokens: ['kubectl', 'create', 'deployment', '--image=busybox']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('deployments')
        expect(result.value.name).toBeUndefined()
      }
    })
  })

  describe('label transformer', () => {
    it('should extract resource, name and label changes', () => {
      const transformer = getTransformerForAction('label')
      const ctx = createContext({
        input: 'kubectl label pods my-pod app=web',
        tokens: ['kubectl', 'label', 'pods', 'my-pod', 'app=web']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('pods')
        expect(result.value.name).toBe('my-pod')
        expect(result.value.labelChanges).toEqual({ app: 'web' })
      }
    })

    it('should handle resource aliases', () => {
      const transformer = getTransformerForAction('label')
      const ctx = createContext({
        input: 'kubectl label po my-pod app=web',
        tokens: ['kubectl', 'label', 'po', 'my-pod', 'app=web']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('pods')
      }
    })

    it('should handle configmap alias', () => {
      const transformer = getTransformerForAction('label')
      const ctx = createContext({
        input: 'kubectl label cm my-config env=prod',
        tokens: ['kubectl', 'label', 'cm', 'my-config', 'env=prod']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('configmaps')
      }
    })

    it('should handle label removal syntax', () => {
      const transformer = getTransformerForAction('label')
      const ctx = createContext({
        input: 'kubectl label pods my-pod app-',
        tokens: ['kubectl', 'label', 'pods', 'my-pod', 'app-']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.labelChanges).toEqual({ app: null })
      }
    })

    it('should handle multiple label changes', () => {
      const transformer = getTransformerForAction('label')
      const ctx = createContext({
        input: 'kubectl label pods my-pod app=web env=prod tier=frontend',
        tokens: [
          'kubectl',
          'label',
          'pods',
          'my-pod',
          'app=web',
          'env=prod',
          'tier=frontend'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.labelChanges).toEqual({
          app: 'web',
          env: 'prod',
          tier: 'frontend'
        })
      }
    })

    it('should skip flags in label changes', () => {
      const transformer = getTransformerForAction('label')
      const ctx = createContext({
        input: 'kubectl label pods my-pod app=web --overwrite',
        tokens: ['kubectl', 'label', 'pods', 'my-pod', 'app=web', '--overwrite']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.labelChanges).toEqual({ app: 'web' })
      }
    })

    it('should return error for invalid resource type', () => {
      const transformer = getTransformerForAction('label')
      const ctx = createContext({
        input: 'kubectl label invalid my-pod app=web',
        tokens: ['kubectl', 'label', 'invalid', 'my-pod', 'app=web']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Invalid')
      }
    })

    it('should return error when resource is a flag', () => {
      const transformer = getTransformerForAction('label')
      const ctx = createContext({
        input: 'kubectl label -n default pods',
        tokens: ['kubectl', 'label', '-n', 'default', 'pods']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(false)
    })

    it('should handle missing tokens gracefully', () => {
      const transformer = getTransformerForAction('label')
      const ctx = createContext({ tokens: undefined })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
    })

    it('should handle value with equals sign', () => {
      const transformer = getTransformerForAction('label')
      const ctx = createContext({
        input: 'kubectl label pods my-pod config=key=value',
        tokens: ['kubectl', 'label', 'pods', 'my-pod', 'config=key=value']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.labelChanges).toEqual({ config: 'key=value' })
      }
    })
  })

  describe('annotate transformer', () => {
    it('should extract resource, name and annotation changes', () => {
      const transformer = getTransformerForAction('annotate')
      const ctx = createContext({
        input: 'kubectl annotate pods my-pod description="My app"',
        tokens: ['kubectl', 'annotate', 'pods', 'my-pod', 'description=My app']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('pods')
        expect(result.value.name).toBe('my-pod')
        expect(result.value.annotationChanges).toEqual({
          description: 'My app'
        })
      }
    })

    it('should handle annotation removal syntax', () => {
      const transformer = getTransformerForAction('annotate')
      const ctx = createContext({
        input: 'kubectl annotate pods my-pod description-',
        tokens: ['kubectl', 'annotate', 'pods', 'my-pod', 'description-']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.annotationChanges).toEqual({ description: null })
      }
    })

    it('should handle secrets resource', () => {
      const transformer = getTransformerForAction('annotate')
      const ctx = createContext({
        input: 'kubectl annotate secret my-secret rotated=true',
        tokens: ['kubectl', 'annotate', 'secret', 'my-secret', 'rotated=true']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('secrets')
      }
    })

    it('should return error for invalid resource', () => {
      const transformer = getTransformerForAction('annotate')
      const ctx = createContext({
        input: 'kubectl annotate unknown my-res key=val',
        tokens: ['kubectl', 'annotate', 'unknown', 'my-res', 'key=val']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(false)
    })
  })

  describe('scale transformer', () => {
    it('should extract resource and name from type/name syntax', () => {
      const transformer = getTransformerForAction('scale')
      const ctx = createContext({
        input: 'kubectl scale deployment/nginx --replicas=5',
        tokens: ['kubectl', 'scale', 'deployment/nginx', '--replicas=5']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('deployments')
        expect(result.value.name).toBe('nginx')
      }
    })

    it('should extract resource and name from standard syntax', () => {
      const transformer = getTransformerForAction('scale')
      const ctx = createContext({
        input: 'kubectl scale deployment nginx --replicas=5',
        tokens: ['kubectl', 'scale', 'deployment', 'nginx', '--replicas=5']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('deployments')
        expect(result.value.name).toBe('nginx')
      }
    })

    it('should handle deploy alias in type/name syntax', () => {
      const transformer = getTransformerForAction('scale')
      const ctx = createContext({
        input: 'kubectl scale deploy/nginx --replicas=3',
        tokens: ['kubectl', 'scale', 'deploy/nginx', '--replicas=3']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('deployments')
        expect(result.value.name).toBe('nginx')
      }
    })

    it('should handle rs alias for replicasets', () => {
      const transformer = getTransformerForAction('scale')
      const ctx = createContext({
        input: 'kubectl scale rs/my-rs --replicas=5',
        tokens: ['kubectl', 'scale', 'rs/my-rs', '--replicas=5']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('replicasets')
        expect(result.value.name).toBe('my-rs')
      }
    })

    it('should handle --replicas flag before resource', () => {
      const transformer = getTransformerForAction('scale')
      const ctx = createContext({
        input: 'kubectl scale --replicas=5 deployment/nginx',
        tokens: ['kubectl', 'scale', '--replicas=5', 'deployment/nginx']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('deployments')
        expect(result.value.name).toBe('nginx')
      }
    })

    it('should handle --replicas flag with separate value before resource', () => {
      const transformer = getTransformerForAction('scale')
      const ctx = createContext({
        input: 'kubectl scale --replicas 5 deployment/nginx',
        tokens: ['kubectl', 'scale', '--replicas', '5', 'deployment/nginx']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('deployments')
        expect(result.value.name).toBe('nginx')
      }
    })

    it('should handle namespace flag', () => {
      const transformer = getTransformerForAction('scale')
      const ctx = createContext({
        input: 'kubectl scale deployment/nginx --replicas=5 -n production',
        tokens: [
          'kubectl',
          'scale',
          'deployment/nginx',
          '--replicas=5',
          '-n',
          'production'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.resource).toBe('deployments')
        expect(result.value.name).toBe('nginx')
      }
    })

    it('should return error for invalid resource type', () => {
      const transformer = getTransformerForAction('scale')
      const ctx = createContext({
        input: 'kubectl scale unknown/nginx --replicas=5',
        tokens: ['kubectl', 'scale', 'unknown/nginx', '--replicas=5']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Invalid')
      }
    })

    it('should return error when no resource is provided', () => {
      const transformer = getTransformerForAction('scale')
      const ctx = createContext({
        input: 'kubectl scale --replicas=5',
        tokens: ['kubectl', 'scale', '--replicas=5']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(false)
    })

    it('should handle missing tokens gracefully', () => {
      const transformer = getTransformerForAction('scale')
      const ctx = createContext({ tokens: undefined })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
    })
  })

  describe('run transformer', () => {
    it('should set resource to pods and extract command metadata', () => {
      const transformer = getTransformerForAction('run')
      const ctx = createContext({
        input: 'kubectl run test-pod --image=busybox --command -- sleep 3600',
        tokens: [
          'kubectl',
          'run',
          'test-pod',
          '--image=busybox',
          '--command',
          '--',
          'sleep',
          '3600'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value.resource).toBe('pods')
      expect(result.value.name).toBe('test-pod')
      expect(result.value.runImage).toBe('busybox')
      expect(result.value.runUseCommand).toBe(true)
      expect(result.value.runHasSeparator).toBe(true)
      expect(result.value.runCommand).toEqual(['sleep', '3600'])
      expect(result.value.tokens).toEqual([
        'kubectl',
        'run',
        'test-pod',
        '--image=busybox',
        '--command'
      ])
    })

    it('should extract image from separate value syntax', () => {
      const transformer = getTransformerForAction('run')
      const ctx = createContext({
        input: 'kubectl run test-pod --image busybox --command -- sleep 3600',
        tokens: [
          'kubectl',
          'run',
          'test-pod',
          '--image',
          'busybox',
          '--command',
          '--',
          'sleep',
          '3600'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value.runImage).toBe('busybox')
    })

    it('should extract run args when --command is not set', () => {
      const transformer = getTransformerForAction('run')
      const ctx = createContext({
        input: 'kubectl run test-pod --image=busybox -- sleep 3600',
        tokens: [
          'kubectl',
          'run',
          'test-pod',
          '--image=busybox',
          '--',
          'sleep',
          '3600'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value.runUseCommand).toBe(false)
      expect(result.value.runArgs).toEqual(['sleep', '3600'])
      expect(result.value.runCommand).toBeUndefined()
    })

    it('should extract positional args without separator when provided after name', () => {
      const transformer = getTransformerForAction('run')
      const ctx = createContext({
        input: 'kubectl run test-pod pod --image=nginx',
        tokens: ['kubectl', 'run', 'test-pod', 'pod', '--image=nginx']
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value.name).toBe('test-pod')
      expect(result.value.runUseCommand).toBe(false)
      expect(result.value.runArgs).toEqual(['pod'])
    })

    it('should extract env labels and dry-run client', () => {
      const transformer = getTransformerForAction('run')
      const ctx = createContext({
        input:
          'kubectl run test-pod --image=busybox --env=DNS_DOMAIN=cluster --labels=app=hazelcast,env=prod --dry-run=client',
        tokens: [
          'kubectl',
          'run',
          'test-pod',
          '--image=busybox',
          '--env=DNS_DOMAIN=cluster',
          '--labels=app=hazelcast,env=prod',
          '--dry-run=client'
        ]
      })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value.runEnv).toEqual(['DNS_DOMAIN=cluster'])
      expect(result.value.runLabels).toEqual({ app: 'hazelcast', env: 'prod' })
      expect(result.value.runDryRunClient).toBe(true)
    })

    it('should extract run interactive and restart flags', () => {
      const transformer = getTransformerForAction('run')
      const ctx = createContext({
        input: 'kubectl run -i -t busybox --image=busybox --restart=Never --rm',
        tokens: [
          'kubectl',
          'run',
          '-i',
          '-t',
          'busybox',
          '--image=busybox',
          '--restart=Never',
          '--rm'
        ]
      })

      const result = transformer(ctx)

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

    it('should extract bundled short run interactive flags -it', () => {
      const transformer = getTransformerForAction('run')
      const ctx = createContext({
        input: 'kubectl run -it busybox --image=busybox --restart=Never --rm',
        tokens: [
          'kubectl',
          'run',
          '-it',
          'busybox',
          '--image=busybox',
          '--restart=Never',
          '--rm'
        ]
      })

      const result = transformer(ctx)

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

    it('should handle missing tokens gracefully', () => {
      const transformer = getTransformerForAction('run')
      const ctx = createContext({ tokens: undefined })

      const result = transformer(ctx)

      expect(result.ok).toBe(true)
    })
  })

  describe('expose transformer', () => {
    it('should extract resource and name', () => {
      const transformer = getTransformerForAction('expose')
      const ctx = createContext({
        input: 'kubectl expose deployment web --port=80',
        tokens: ['kubectl', 'expose', 'deployment', 'web', '--port=80']
      })

      const result = transformer(ctx)
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value.resource).toBe('deployments')
      expect(result.value.name).toBe('web')
    })

    it('should support resource/name syntax', () => {
      const transformer = getTransformerForAction('expose')
      const ctx = createContext({
        input: 'kubectl expose deployment/web --port=80',
        tokens: ['kubectl', 'expose', 'deployment/web', '--port=80']
      })

      const result = transformer(ctx)
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value.resource).toBe('deployments')
      expect(result.value.name).toBe('web')
    })
  })

  describe('patch transformer', () => {
    it('should extract resource and name from resource name syntax', () => {
      const transformer = getTransformerForAction('patch')
      const ctx = createContext({
        input: `kubectl patch deployment my-app --type=merge -p '{"spec":{"replicas":4}}'`,
        tokens: [
          'kubectl',
          'patch',
          'deployment',
          'my-app',
          '--type=merge',
          '-p',
          '{"spec":{"replicas":4}}'
        ]
      })

      const result = transformer(ctx)
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value.resource).toBe('deployments')
      expect(result.value.name).toBe('my-app')
    })

    it('should extract resource and name from type/name syntax', () => {
      const transformer = getTransformerForAction('patch')
      const ctx = createContext({
        input: `kubectl patch deployment/my-app --type=merge -p '{"spec":{"replicas":4}}'`,
        tokens: [
          'kubectl',
          'patch',
          'deployment/my-app',
          '--type=merge',
          '-p',
          '{"spec":{"replicas":4}}'
        ]
      })

      const result = transformer(ctx)
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value.resource).toBe('deployments')
      expect(result.value.name).toBe('my-app')
    })
  })
})
